import { Server } from 'socket.io';
import { pool } from './db/pool.js';
import { cargarSesion } from './middleware/auth.js';
import { ABIERTOS, cargarIntento } from './services/intentos.js';
import { evidencia, registrarIncidente } from './services/incidentes.js';

// Presencia del alumno durante el examen (RF-27): cada pestaña del examen abre un socket ligado a su intento.
// Si el intento se queda sin sockets más tiempo que la tolerancia, se marca ABANDONADO.
// shortcut: estado en memoria de un solo proceso; con varios procesos o servidores, mover a Redis o a la BD.

let activo = false;
let toleranciaMs = 20_000;
const conectados = new Map(); // intentoId → sockets abiertos
const pendientes = new Map(); // intentoId → temporizador de abandono

// IP del cliente igual que req.ip de Express: detrás de Nginx (TRUST_PROXY=1) es la última de X-Forwarded-For.
function ipDe(socket) {
  const reenviada = socket.handshake.headers['x-forwarded-for'];
  return process.env.TRUST_PROXY && reenviada ? reenviada.split(',').at(-1).trim() : socket.handshake.address;
}

// Si nadie se conecta al intento antes de la tolerancia, se abandona. Sin sockets (pruebas HTTP) no hace nada.
export function programarAbandono(intentoId, alumnoId, ev) {
  if (!activo) return;
  clearTimeout(pendientes.get(intentoId));
  pendientes.set(intentoId, setTimeout(() => {
    pendientes.delete(intentoId);
    registrarIncidente(intentoId, alumnoId, 'CONEXION_PERDIDA', ev).catch((err) => console.error('Abandono por desconexión:', err));
  }, toleranciaMs).unref());
}

export function iniciarSockets(servidor, opciones = {}) {
  toleranciaMs = opciones.toleranciaMs ?? toleranciaMs;
  activo = true;
  // Latidos cada 10 s: una red caída se nota en ~20 s en vez de los ~45 s por defecto.
  const io = new Server(servidor, { pingInterval: 10_000, pingTimeout: 10_000, serveClient: true });

  // Autenticación con la misma cookie de sesión de la API; solo alumnos con ese intento abierto.
  io.use(async (socket, next) => {
    try {
      const req = socket.request;
      await cargarSesion(req, null, () => {});
      if (req.usuario?.rol !== 'ALUMNO') return next(new Error('sin-sesion'));
      const intentoId = Number(socket.handshake.auth?.intento);
      const i = Number.isSafeInteger(intentoId) && intentoId > 0 ? await cargarIntento(pool, intentoId, req.usuario.id) : null;
      if (!i || !ABIERTOS.includes(i.estado)) return next(new Error('cerrado'));
      socket.data = { intentoId, alumnoId: req.usuario.id, ev: evidencia(ipDe(socket), socket.handshake.headers['user-agent']) };
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const { intentoId, alumnoId, ev } = socket.data;
    conectados.set(intentoId, (conectados.get(intentoId) || 0) + 1);
    clearTimeout(pendientes.get(intentoId));
    pendientes.delete(intentoId);
    socket.on('disconnect', () => {
      const quedan = conectados.get(intentoId) - 1;
      if (quedan > 0) return conectados.set(intentoId, quedan);
      conectados.delete(intentoId);
      programarAbandono(intentoId, alumnoId, ev);
    });
  });
  return io;
}

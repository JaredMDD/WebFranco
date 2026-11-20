// Ayudantes de las pruebas de integración: levantan la app en un puerto libre contra la BD local.
// Todos los usuarios de prueba se llaman "prueba_*" y limpiarPrueba() los borra con todo lo que crearon.
import { once } from 'node:events';
import { readdir, rm } from 'node:fs/promises';
import { DIR_IMAGENES } from '../server/routes/imagenes.js';
import { app } from '../server/app.js';
import { iniciarSockets } from '../server/sockets.js';
import { pool } from '../server/db/pool.js';
import { hashContrasena } from '../server/services/contrasenas.js';

export { pool };
export const CLAVE = 'clave1234';
export const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// sockets: { toleranciaMs } también levanta Socket.IO (como en producción) con una tolerancia corta.
export async function arrancar({ sockets } = {}) {
  const servidor = app.listen(0);
  await once(servidor, 'listening');
  const io = sockets && iniciarSockets(servidor, sockets);
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return { ...cliente(base), cerrar: () => (io ? io.close() : servidor.close()) };
}

// Peticiones a un servidor ya levantado (en este proceso o en otro).
export function cliente(base) {
  async function pedir(metodo, ruta, { datos, cookie } = {}) {
    const res = await fetch(base + ruta, {
      method: metodo,
      redirect: 'manual',
      headers: { ...(datos && { 'Content-Type': 'application/json' }), ...(cookie && { Cookie: cookie }) },
      body: datos && JSON.stringify(datos),
    });
    const cuerpo = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
    const sid = res.headers.getSetCookie().find((c) => c.startsWith('sid='));
    return { estado: res.status, cuerpo, ubicacion: res.headers.get('location'), cookie: sid?.split(';')[0] };
  }
  const entrar = (usuario, contrasena = CLAVE) => pedir('POST', '/api/auth/entrar', { datos: { usuario, contrasena } });
  const cookieDe = async (usuario) => (await entrar(usuario)).cookie;
  return { base, pedir, entrar, cookieDe };
}

export async function crearUsuario(nombre, rol) {
  await pool.query('INSERT INTO usuario (nombre_usuario, contrasena_hash, rol) VALUES ($1, $2, $3)', [nombre, await hashContrasena(CLAVE), rol]);
}

// Nombre de usuario de prueba con el sufijo de este archivo: cada archivo de prueba corre en paralelo y limpia solo lo suyo.
export const nombre = (base) => `prueba_${base}_${sufijo}`;

export async function limpiarPrueba() {
  const patron = `prueba\\_%\\_${sufijo}`;
  const ids = '(SELECT id FROM usuario WHERE nombre_usuario LIKE $1)';
  const intentos = `(SELECT id FROM intento WHERE alumno_id IN ${ids} OR examen_id IN (SELECT id FROM examen WHERE docente_id IN ${ids}))`;
  await pool.query(`DELETE FROM respuesta WHERE intento_id IN ${intentos}`, [patron]);
  await pool.query(`DELETE FROM intento WHERE id IN ${intentos}`, [patron]); // en cascada: incidentes
  await pool.query(`DELETE FROM tiempo_extra WHERE alumno_id IN ${ids}`, [patron]);
  await pool.query(`DELETE FROM examen WHERE docente_id IN ${ids}`, [patron]); // en cascada: preguntas, opciones, grupos, tiempo extra
  const { rows } = await pool.query(`SELECT id FROM usuario WHERE nombre_usuario LIKE $1`, [patron]);
  for (const archivo of await readdir(DIR_IMAGENES)) {
    if (rows.some((u) => archivo.startsWith(`${u.id}-`))) await rm(DIR_IMAGENES + archivo);
  }
  await pool.query(`DELETE FROM inscripcion WHERE alumno_id IN ${ids}`, [patron]);
  await pool.query(`DELETE FROM materia WHERE docente_id IN ${ids}`, [patron]); // en cascada: grupos e inscripciones
  await pool.query(`DELETE FROM bitacora_auditoria WHERE usuario_id IN ${ids} OR (entidad = 'usuario' AND entidad_id IN ${ids})`, [patron]);
  await pool.query(`DELETE FROM sesion WHERE usuario_id IN ${ids}`, [patron]);
  await pool.query('DELETE FROM usuario WHERE nombre_usuario LIKE $1', [patron]);
  await pool.end();
}

import { pool } from '../db/pool.js';
import { ABIERTOS, GRACIA_MS, cargarIntento, finalizarIntento } from './intentos.js';

// Incidentes de seguridad (RF-27, RF-30 a RF-37 · CU-27, CU-28, CU-30).

// Tipos que el navegador puede reportar; los otros dos los detecta el servidor.
export const REPORTABLES = ['CAMBIO_PESTANA', 'INACTIVIDAD'];

// "Chrome · Android" a partir del user agent guardado como evidencia (para leerlo de un vistazo).
export function resumenDispositivo(ua = '') {
  const navegador = [[/Edg\//, 'Edge'], [/OPR\//, 'Opera'], [/Firefox\//, 'Firefox'], [/Chrome\//, 'Chrome'], [/Safari\//, 'Safari']].find(([r]) => r.test(ua))?.[1];
  const sistema = [[/Android/, 'Android'], [/iPhone|iPad/, 'iOS'], [/Windows/, 'Windows'], [/Mac OS X/, 'macOS'], [/Linux/, 'Linux']].find(([r]) => r.test(ua))?.[1];
  return [navegador, sistema].filter(Boolean).join(' · ') || 'Desconocido';
}

export const evidencia = (ip, userAgent) => ({ ip: String(ip || '').slice(0, 45), dispositivo: String(userAgent || '').slice(0, 255) });

// Registra el incidente con su evidencia y cierra el intento: ANULADO (en revisión del docente) o ABANDONADO si se perdió la conexión.
// Si el intento ya estaba cerrado no hace nada; si el tiempo ya se había agotado, solo lo envía (no fue trampa, terminó el tiempo).
// Devuelve null si el intento no es de ese alumno; si no, { estado, registrado }.
export async function registrarIncidente(intentoId, alumnoId, tipo, { ip, dispositivo }) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const i = await cargarIntento(cliente, intentoId, alumnoId, { bloquear: true });
    let resultado = i && { estado: i.estado, registrado: false };
    if (i && ABIERTOS.includes(i.estado)) {
      if (Number(i.restante_ms) < -GRACIA_MS) {
        await finalizarIntento(cliente, i.id);
        resultado = { estado: 'ENVIADO', registrado: false };
      } else {
        const estado = tipo === 'CONEXION_PERDIDA' ? 'ABANDONADO' : 'ANULADO';
        await cliente.query('INSERT INTO incidente (intento_id, tipo, ip, dispositivo) VALUES ($1, $2, $3, $4)', [i.id, tipo, ip, dispositivo]);
        await finalizarIntento(cliente, i.id, estado);
        resultado = { estado, registrado: true };
      }
    }
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

// Al iniciar sesión un alumno que ya tenía otra sesión viva y un examen abierto: otra persona o dispositivo entró (RF-34).
// Debe llamarse antes de crear la sesión nueva, que cierra las anteriores.
export async function detectarSesionDuplicada(alumnoId, ev) {
  const { rows } = await pool.query(
    `SELECT id FROM intento WHERE alumno_id = $1 AND estado = ANY($2)
        AND EXISTS (SELECT 1 FROM sesion WHERE usuario_id = $1 AND activa AND expira_en > now())`,
    [alumnoId, ABIERTOS],
  );
  for (const { id } of rows) await registrarIncidente(id, alumnoId, 'SESION_DUPLICADA', ev);
}

// Borra las evidencias vencidas (7 días). Las calificaciones viven en intento y respuesta, que no se tocan (RF-37, RNF-09).
export async function purgarIncidentesVencidos() {
  const { rowCount } = await pool.query('DELETE FROM incidente WHERE expira_en <= now()');
  return rowCount;
}

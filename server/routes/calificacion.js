import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requiereRol } from '../middleware/auth.js';
import { registrarAuditoria } from '../services/auditoria.js';
import { recalcularCalificacion } from '../services/intentos.js';
import { resumenDispositivo } from '../services/incidentes.js';
import { datosReporte, reporteExcel, reportePdf } from '../services/reportes.js';

// Revisión de incidentes, calificación manual y publicación (RF-17, RF-33, RF-39 a RF-41 · CU-12 a CU-16).
// Todo se limita a exámenes del docente en sesión (RF-45): lo ajeno responde 404, igual que lo inexistente.
export const calificacion = Router();
calificacion.use(requiereRol('DOCENTE'));

const idValido = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const EN_REVISION = ['ANULADO', 'ABANDONADO'];

// Ejecuta fn en una transacción con el intento (de un examen del docente) bloqueado; null si no es suyo.
async function conIntentoPropio(intentoId, docenteId, fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const { rows: [i] } = await cliente.query(
      `SELECT i.id, i.examen_id, i.estado, i.plagio_confirmado, u.nombre_usuario AS alumno
         FROM intento i JOIN examen e ON e.id = i.examen_id JOIN usuario u ON u.id = i.alumno_id
        WHERE i.id = $1 AND e.docente_id = $2 FOR UPDATE OF i`,
      [intentoId, docenteId],
    );
    const resultado = i ? await fn(cliente, i) : null;
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

const sinIntento = (res) => res.status(404).json({ ok: false, error: 'No existe ese intento.' });
const yaRevisado = { http: 409, error: 'Este examen ya no está en revisión.' };

// Exámenes anulados o abandonados pendientes de decisión, con su evidencia más reciente si aún existe (RF-40 · CU-12).
calificacion.get('/revision', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.id, i.estado, u.nombre_usuario AS alumno, e.titulo AS examen,
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM (i.inicio_en + make_interval(mins => e.duracion_min + i.tiempo_extra_min) - i.fin_en)) / 60))::int AS restante_min,
            inc.tipo, inc.ocurrio_en, inc.ip, inc.dispositivo
       FROM intento i
       JOIN examen e ON e.id = i.examen_id
       JOIN usuario u ON u.id = i.alumno_id
       LEFT JOIN LATERAL (SELECT tipo, ocurrio_en, ip, dispositivo FROM incidente WHERE intento_id = i.id ORDER BY ocurrio_en DESC LIMIT 1) inc ON true
      WHERE e.docente_id = $1 AND i.estado = ANY($2) AND NOT i.plagio_confirmado
      ORDER BY i.fin_en DESC`,
    [req.usuario.id, EN_REVISION],
  );
  res.json({ ok: true, data: rows.map((r) => ({ ...r, dispositivo_resumen: r.dispositivo && resumenDispositivo(r.dispositivo) })) });
});

// Confirmar el plagio: la anulación queda definitiva (RF-33 · CU-13).
calificacion.post('/intentos/:id/confirmar', async (req, res) => {
  const r = await conIntentoPropio(idValido(req.params.id), req.usuario.id, async (db, i) => {
    if (!EN_REVISION.includes(i.estado) || i.plagio_confirmado) return yaRevisado;
    await db.query('UPDATE intento SET plagio_confirmado = true WHERE id = $1', [i.id]);
    await db.query("UPDATE incidente SET decision = 'CONFIRMADO', revisado_por = $2, revisado_en = now() WHERE intento_id = $1 AND decision = 'PENDIENTE'", [i.id, req.usuario.id]);
    return { alumno: i.alumno };
  });
  if (!r) return sinIntento(res);
  if (r.error) return res.status(r.http).json({ ok: false, error: r.error });
  await registrarAuditoria(req.usuario.id, 'CONFIRMAR_PLAGIO', 'intento', Number(req.params.id), r.alumno);
  res.json({ ok: true, data: { estado: 'ANULADO', plagio_confirmado: true } });
});

// Descartar el incidente y reabrir (RF-41 · CU-14). El alumno recupera el tiempo que le quedaba al anularse,
// más el extra que dé el docente; el tiempo vuelve a correr desde este momento.
calificacion.post('/intentos/:id/reabrir', async (req, res) => {
  const extra = req.body?.tiempo_extra_min ?? 0;
  if (!Number.isInteger(extra) || extra < 0 || extra > 240) return res.status(400).json({ ok: false, error: 'El tiempo extra debe ser un número entero de 0 a 240 minutos.' });
  const r = await conIntentoPropio(idValido(req.params.id), req.usuario.id, async (db, i) => {
    if (!EN_REVISION.includes(i.estado) || i.plagio_confirmado) return yaRevisado;
    // El tiempo en pausa (desde la anulación hasta ahora) se suma al extra, redondeado al minuto hacia arriba.
    await db.query(
      `UPDATE intento SET estado = 'REABIERTO', fin_en = NULL, calificacion = NULL,
              tiempo_extra_min = tiempo_extra_min + CEIL(EXTRACT(EPOCH FROM now() - fin_en) / 60)::int + $2
        WHERE id = $1`,
      [i.id, extra],
    );
    await db.query("UPDATE incidente SET decision = 'DESCARTADO', revisado_por = $2, revisado_en = now() WHERE intento_id = $1 AND decision = 'PENDIENTE'", [i.id, req.usuario.id]);
    return { alumno: i.alumno };
  });
  if (!r) return sinIntento(res);
  if (r.error) return res.status(r.http).json({ ok: false, error: r.error });
  await registrarAuditoria(req.usuario.id, 'REABRIR_EXAMEN', 'intento', Number(req.params.id), `${r.alumno} · tiempo extra: ${extra} min`);
  res.json({ ok: true, data: { estado: 'REABIERTO' } });
});

// Respuestas abiertas con texto y sin puntos todavía.
const PENDIENTES = `(SELECT count(*) FROM respuesta r JOIN pregunta p ON p.id = r.pregunta_id
                      WHERE r.intento_id = i.id AND p.tipo = 'ABIERTA' AND r.puntos_obtenidos IS NULL AND COALESCE(r.texto_respuesta, '') <> '')::int`;

// Intentos de un examen para calificar y publicar (CU-15, CU-16).
calificacion.get('/examenes/:id/calificar', async (req, res) => {
  const { rows: [e] } = await pool.query(
    'SELECT id, titulo, mostrar_respuestas FROM examen WHERE id = $1 AND docente_id = $2',
    [idValido(req.params.id), req.usuario.id],
  );
  if (!e) return res.status(404).json({ ok: false, error: 'No existe ese examen.' });
  const { rows: intentos } = await pool.query(
    `SELECT i.id, u.nombre_usuario AS alumno, i.estado, i.plagio_confirmado, i.publicado, i.calificacion::float AS calificacion, ${PENDIENTES} AS pendientes
       FROM intento i JOIN usuario u ON u.id = i.alumno_id
      WHERE i.examen_id = $1 ORDER BY u.nombre_usuario`,
    [e.id],
  );
  res.json({ ok: true, data: { ...e, intentos } });
});

// Respuestas de un intento cerrado, en el orden del examen, con la correcta para el docente.
calificacion.get('/intentos/:id/respuestas', async (req, res) => {
  const { rows: [i] } = await pool.query(
    `SELECT i.id, i.estado, i.calificacion::float AS calificacion, u.nombre_usuario AS alumno, e.titulo AS examen, e.id AS examen_id
       FROM intento i JOIN examen e ON e.id = i.examen_id JOIN usuario u ON u.id = i.alumno_id
      WHERE i.id = $1 AND e.docente_id = $2`,
    [idValido(req.params.id), req.usuario.id],
  );
  if (!i) return sinIntento(res);
  if (['EN_CURSO', 'REABIERTO'].includes(i.estado)) return res.status(409).json({ ok: false, error: 'El alumno aún está presentando este examen.' });
  const { rows: preguntas } = await pool.query(
    `SELECT p.id AS pregunta_id, p.tipo, p.enunciado, p.puntos::float AS puntos,
            r.texto_respuesta, r.puntos_obtenidos::float AS puntos_obtenidos, r.comentario_docente AS comentario,
            elegida.texto AS opcion_elegida, correcta.texto AS opcion_correcta
       FROM pregunta p
       LEFT JOIN respuesta r ON r.pregunta_id = p.id AND r.intento_id = $1
       LEFT JOIN opcion elegida ON elegida.id = r.opcion_id
       LEFT JOIN opcion correcta ON correcta.pregunta_id = p.id AND correcta.es_correcta
      WHERE p.examen_id = $2 ORDER BY p.orden`,
    [i.id, i.examen_id],
  );
  res.json({ ok: true, data: { ...i, preguntas } });
});

// Calificación manual de abiertas con comentario; recalcula la nota (RF-39 · CU-15).
calificacion.put('/intentos/:id/calificacion', async (req, res) => {
  const lista = req.body?.calificaciones;
  if (!Array.isArray(lista) || !lista.length || lista.length > 200) return res.status(400).json({ ok: false, error: 'No hay calificaciones que guardar.' });
  const r = await conIntentoPropio(idValido(req.params.id), req.usuario.id, async (db, i) => {
    if (i.estado !== 'ENVIADO') return { http: 409, error: 'Solo se califican exámenes enviados.' };
    const { rows: abiertas } = await db.query("SELECT id, puntos::float AS puntos FROM pregunta WHERE examen_id = $1 AND tipo = 'ABIERTA'", [i.examen_id]);
    for (const c of lista) {
      const p = abiertas.find((a) => a.id === Number(c?.pregunta_id));
      if (!p) return { http: 400, error: 'Solo se califican preguntas abiertas de este examen.' };
      const puntos = c.puntos;
      if (typeof puntos !== 'number' || !Number.isFinite(puntos) || puntos < 0 || puntos > p.puntos || Math.round(puntos * 100) !== puntos * 100) {
        return { http: 400, error: `Los puntos deben ir de 0 a ${p.puntos}, con hasta dos decimales.` };
      }
      const comentario = c.comentario == null ? '' : c.comentario;
      if (typeof comentario !== 'string' || comentario.length > 1000) return { http: 400, error: 'El comentario admite hasta 1000 caracteres.' };
      // Si el alumno no respondió, la fila se crea para guardar puntos y comentario.
      await db.query(
        `INSERT INTO respuesta (intento_id, pregunta_id, puntos_obtenidos, comentario_docente) VALUES ($1, $2, $3, $4)
         ON CONFLICT (intento_id, pregunta_id) DO UPDATE SET puntos_obtenidos = EXCLUDED.puntos_obtenidos, comentario_docente = EXCLUDED.comentario_docente`,
        [i.id, p.id, puntos, comentario.trim() || null],
      );
    }
    await recalcularCalificacion(db, i.id);
    const { rows: [n] } = await db.query('SELECT calificacion::float AS calificacion FROM intento WHERE id = $1', [i.id]);
    return { alumno: i.alumno, calificacion: n.calificacion };
  });
  if (!r) return sinIntento(res);
  if (r.error) return res.status(r.http).json({ ok: false, error: r.error });
  await registrarAuditoria(req.usuario.id, 'CALIFICAR', 'intento', Number(req.params.id), `${r.alumno} · calificación: ${r.calificacion}`);
  res.json({ ok: true, data: { calificacion: r.calificacion } });
});

// Publica los resultados de los exámenes enviados; exige que no falten abiertas por calificar (RF-29 · CU-16).
// Los que se envíen después se publican volviendo a usar esta acción.
calificacion.post('/examenes/:id/publicar', async (req, res) => {
  const { rows: [e] } = await pool.query('SELECT id FROM examen WHERE id = $1 AND docente_id = $2', [idValido(req.params.id), req.usuario.id]);
  if (!e) return res.status(404).json({ ok: false, error: 'No existe ese examen.' });
  const { rows: [{ pendientes }] } = await pool.query(
    `SELECT COALESCE(sum(${PENDIENTES}), 0)::int AS pendientes FROM intento i WHERE i.examen_id = $1 AND i.estado = 'ENVIADO'`,
    [e.id],
  );
  if (pendientes) return res.status(409).json({ ok: false, error: pendientes === 1 ? 'Falta 1 respuesta abierta por calificar.' : `Faltan ${pendientes} respuestas abiertas por calificar.` });
  const { rowCount } = await pool.query("UPDATE intento SET publicado = true WHERE examen_id = $1 AND estado = 'ENVIADO' AND NOT publicado", [e.id]);
  if (!rowCount) return res.status(409).json({ ok: false, error: 'No hay resultados nuevos que publicar.' });
  await registrarAuditoria(req.usuario.id, 'PUBLICAR_RESULTADOS', 'examen', e.id, `${rowCount} resultados`);
  res.json({ ok: true, data: { publicados: rowCount } });
});

// Reportes del examen: JSON para la pantalla, Excel y PDF para descargar (RF-43, RF-44 · CU-17).
calificacion.get('/examenes/:id/reporte', async (req, res) => {
  const datos = await datosReporte(idValido(req.params.id), req.usuario.id);
  if (!datos) return res.status(404).json({ ok: false, error: 'No existe ese examen.' });
  res.json({ ok: true, data: datos });
});

for (const [ext, tipo, generar] of [
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', reporteExcel],
  ['pdf', 'application/pdf', reportePdf],
]) {
  calificacion.get(`/examenes/:id/reporte.${ext}`, async (req, res) => {
    const datos = await datosReporte(idValido(req.params.id), req.usuario.id);
    if (!datos) return res.status(404).json({ ok: false, error: 'No existe ese examen.' });
    res.type(tipo).attachment(`reporte-examen-${datos.examen.id}.${ext}`).send(await generar(datos));
  });
}

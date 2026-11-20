import { barajar } from './aleatorio.js';

// Lógica del intento compartida por las rutas del alumno (y, en fases siguientes, de seguridad y calificación).

export const ABIERTOS = ['EN_CURSO', 'REABIERTO'];
// Tolerancia para respuestas que salen justo al terminar el tiempo y llegan con retraso de red.
export const GRACIA_MS = 5000;

// Carga el intento del alumno con el tiempo restante calculado por la BD (RF-25: nunca el reloj del navegador).
// restante_ms puede ser negativo (tiempo vencido). null si el intento no es de ese alumno.
export async function cargarIntento(db, intentoId, alumnoId, { bloquear = false } = {}) {
  const { rows: [i] } = await db.query(
    `SELECT i.id, i.examen_id, i.estado, i.posicion, i.semilla_aleatoria, i.tiempo_extra_min, i.plagio_confirmado,
            e.titulo, e.duracion_min, e.umbral_inactividad_min, e.permite_herramienta,
            (EXTRACT(EPOCH FROM (i.inicio_en + make_interval(mins => e.duracion_min + i.tiempo_extra_min) - now())) * 1000)::bigint AS restante_ms
       FROM intento i JOIN examen e ON e.id = i.examen_id
      WHERE i.id = $1 AND i.alumno_id = $2 ${bloquear ? 'FOR UPDATE OF i' : ''}`,
    [intentoId, alumnoId],
  );
  return i || null;
}

// Orden barajado de las preguntas de este intento: lista de IDs.
export async function ordenPreguntas(db, examenId, semilla) {
  const { rows } = await db.query('SELECT id FROM pregunta WHERE examen_id = $1 ORDER BY orden', [examenId]);
  return barajar(rows.map((r) => r.id), semilla);
}

// Calificación en escala 0–10 sobre el total de puntos del examen; las abiertas sin calificar cuentan 0 por ahora.
export function recalcularCalificacion(db, intentoId) {
  return db.query(
    `UPDATE intento SET calificacion = (
        SELECT CASE WHEN sum(p.puntos) > 0 THEN round(10 * COALESCE(sum(r.puntos_obtenidos), 0) / sum(p.puntos), 2) END
          FROM pregunta p LEFT JOIN respuesta r ON r.pregunta_id = p.id AND r.intento_id = $1
         WHERE p.examen_id = intento.examen_id)
      WHERE id = $1`,
    [intentoId],
  );
}

// Cierra el intento y califica automáticamente las preguntas cerradas (RF-38, CU-29).
export async function finalizarIntento(db, intentoId, estado = 'ENVIADO') {
  await db.query(
    `UPDATE respuesta r SET puntos_obtenidos = CASE WHEN o.es_correcta THEN p.puntos ELSE 0 END
       FROM pregunta p, opcion o
      WHERE r.intento_id = $1 AND p.id = r.pregunta_id AND o.id = r.opcion_id AND p.tipo <> 'ABIERTA'`,
    [intentoId],
  );
  await db.query('UPDATE intento SET estado = $2, fin_en = now() WHERE id = $1', [intentoId, estado]);
  await recalcularCalificacion(db, intentoId);
}

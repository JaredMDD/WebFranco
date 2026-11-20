import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requiereRol, extenderSesion } from '../middleware/auth.js';
import { semillaNueva, barajar, semillaOpciones } from '../services/aleatorio.js';
import { ABIERTOS, GRACIA_MS, cargarIntento, ordenPreguntas, finalizarIntento } from '../services/intentos.js';
import { REPORTABLES, evidencia, registrarIncidente } from '../services/incidentes.js';
import { programarAbandono } from '../sockets.js';

// Presentación del examen por el alumno (RF-19 a RF-26, RF-38 · CU-21 a CU-26, CU-29).
// Regla de oro: las respuestas correctas nunca salen de aquí mientras el intento está abierto (RNF-07).
export const presentacion = Router();
presentacion.use(requiereRol('ALUMNO'));

const idValido = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
// El examen está asignado a un grupo donde el alumno está inscrito.
const ASIGNADO = `EXISTS (SELECT 1 FROM examen_grupo eg JOIN inscripcion ins ON ins.grupo_id = eg.grupo_id
                           WHERE eg.examen_id = e.id AND ins.alumno_id = $2)`;

// Respuesta estándar cuando el intento ya no admite cambios.
const cerrado = (res, estado, tiempoAgotado = false) => res.status(409).json({
  ok: false,
  error: tiempoAgotado ? 'Se agotó el tiempo. Tu examen se cerró y se guardó lo que respondiste.' : 'Este examen ya no está en curso.',
  estado, tiempo_agotado: tiempoAgotado,
});

// Lista de exámenes del alumno con su disponibilidad y el estado de su intento (RF-20, CU-21).
presentacion.get('/examenes', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (e.id) e.id, e.titulo, e.abre_en, e.cierra_en, e.duracion_min, m.nombre AS materia,
              COALESCE(te.minutos, 0) AS tiempo_extra,
              CASE WHEN now() < e.abre_en THEN 'PENDIENTE' WHEN now() < e.cierra_en THEN 'ABIERTO' ELSE 'CERRADO' END AS disponibilidad,
              i.id AS intento_id, i.estado AS intento_estado, i.publicado, i.plagio_confirmado,
              CASE WHEN i.publicado THEN i.calificacion::float END AS calificacion
         FROM examen e
         JOIN examen_grupo eg ON eg.examen_id = e.id
         JOIN inscripcion ins ON ins.grupo_id = eg.grupo_id AND ins.alumno_id = $1
         JOIN grupo g ON g.id = eg.grupo_id
         JOIN materia m ON m.id = g.materia_id
         LEFT JOIN intento i ON i.examen_id = e.id AND i.alumno_id = $1
         LEFT JOIN tiempo_extra te ON te.examen_id = e.id AND te.alumno_id = $1
        WHERE e.estado = 'PROGRAMADO' OR i.id IS NOT NULL
        ORDER BY e.id) x
     ORDER BY x.cierra_en DESC`,
    [req.usuario.id],
  );
  res.json({ ok: true, data: rows });
});

// Datos para la pantalla de instrucciones (RF-21, CU-22).
presentacion.get('/examenes/:id', async (req, res) => {
  const { rows: [e] } = await pool.query(
    `SELECT e.id, e.titulo, e.instrucciones, e.duracion_min, e.umbral_inactividad_min, e.permite_herramienta, e.abre_en, e.cierra_en,
            (SELECT count(*) FROM pregunta p WHERE p.examen_id = e.id)::int AS preguntas,
            COALESCE((SELECT minutos FROM tiempo_extra te WHERE te.examen_id = e.id AND te.alumno_id = $2), 0) AS tiempo_extra,
            (now() >= e.abre_en AND now() < e.cierra_en) AS abierto,
            i.id AS intento_id, i.estado AS intento_estado
       FROM examen e LEFT JOIN intento i ON i.examen_id = e.id AND i.alumno_id = $2
      WHERE e.id = $1 AND e.estado = 'PROGRAMADO' AND ${ASIGNADO}`,
    [idValido(req.params.id), req.usuario.id],
  );
  if (!e) return res.status(404).json({ ok: false, error: 'No tienes asignado ese examen.' });
  res.json({ ok: true, data: e });
});

// Inicia el intento tras aceptar las reglas (RF-21, RF-22, RF-32): una sola oportunidad, dentro de la ventana.
presentacion.post('/examenes/:id/iniciar', async (req, res) => {
  if (req.body?.acepto !== true) return res.status(400).json({ ok: false, error: 'Debes aceptar las reglas para comenzar.' });
  const examenId = idValido(req.params.id);
  const cliente = await pool.connect();
  let intentoId, minutos;
  try {
    await cliente.query('BEGIN');
    // FOR SHARE: el docente no puede reemplazar el examen mientras se crea el intento.
    const { rows: [e] } = await cliente.query(
      `SELECT e.id, e.duracion_min, (now() >= e.abre_en AND now() < e.cierra_en) AS abierto,
              (SELECT count(*) FROM pregunta p WHERE p.examen_id = e.id)::int AS preguntas,
              COALESCE((SELECT minutos FROM tiempo_extra te WHERE te.examen_id = e.id AND te.alumno_id = $2), 0) AS tiempo_extra
         FROM examen e WHERE e.id = $1 AND e.estado = 'PROGRAMADO' AND ${ASIGNADO} FOR SHARE OF e`,
      [examenId, req.usuario.id],
    );
    if (!e) { await cliente.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'No tienes asignado ese examen.' }); }

    const { rows: [previo] } = await cliente.query('SELECT id, estado FROM intento WHERE examen_id = $1 AND alumno_id = $2', [examenId, req.usuario.id]);
    if (previo) {
      await cliente.query('ROLLBACK');
      // Un intento abierto se retoma (p. ej. recargó la página); si se quedó sin conexión más de la tolerancia, ya está ABANDONADO.
      if (ABIERTOS.includes(previo.estado)) return res.json({ ok: true, data: { intento_id: previo.id } });
      return res.status(409).json({ ok: false, error: 'Ya presentaste este examen. Solo hay una oportunidad.' });
    }
    if (!e.abierto) { await cliente.query('ROLLBACK'); return res.status(409).json({ ok: false, error: 'El examen no está disponible en este momento.' }); }
    if (!e.preguntas) { await cliente.query('ROLLBACK'); return res.status(409).json({ ok: false, error: 'El examen aún no tiene preguntas. Avísale a tu docente.' }); }

    ({ rows: [{ id: intentoId }] } = await cliente.query(
      `INSERT INTO intento (examen_id, alumno_id, semilla_aleatoria, ip_inicio, tiempo_extra_min)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [examenId, req.usuario.id, semillaNueva(), String(req.ip || '').slice(0, 45), e.tiempo_extra],
    ));
    minutos = e.duracion_min + e.tiempo_extra;
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ya presentaste este examen. Solo hay una oportunidad.' });
    throw err;
  } finally {
    cliente.release();
  }
  await extenderSesion(req, res, new Date(Date.now() + (minutos + 15) * 60_000));
  programarAbandono(intentoId, req.usuario.id, evidencia(req.ip, req.get('user-agent'))); // se cancela cuando la página del examen se conecta
  res.status(201).json({ ok: true, data: { intento_id: intentoId } });
});

// Pregunta actual y tiempo restante. Si el tiempo se agotó, cierra el intento (RF-25, RF-26).
presentacion.get('/intentos/:id', async (req, res) => {
  const intentoId = idValido(req.params.id);
  let i = await cargarIntento(pool, intentoId, req.usuario.id);
  if (!i) return res.status(404).json({ ok: false, error: 'No existe ese intento.' });
  if (ABIERTOS.includes(i.estado) && i.restante_ms <= 0) {
    await conIntentoBloqueado(intentoId, req.usuario.id, async (db, bloqueado) => {
      if (ABIERTOS.includes(bloqueado.estado)) await finalizarIntento(db, intentoId);
    });
    i = await cargarIntento(pool, intentoId, req.usuario.id);
    return res.json({ ok: true, data: { estado: i.estado, titulo: i.titulo, tiempo_agotado: true } });
  }
  if (!ABIERTOS.includes(i.estado)) {
    // Para la pantalla de bloqueo (RF-28): motivo (si la evidencia no ha expirado) y cuántas respondió.
    const { rows: [x] } = await pool.query(
      `SELECT (SELECT count(*) FROM respuesta WHERE intento_id = $1 AND (opcion_id IS NOT NULL OR texto_respuesta <> ''))::int AS respondidas,
              (SELECT count(*) FROM pregunta WHERE examen_id = $2)::int AS total,
              (SELECT json_build_object('tipo', tipo, 'ocurrio_en', ocurrio_en) FROM incidente
                WHERE intento_id = $1 ORDER BY ocurrio_en DESC LIMIT 1) AS incidente`,
      [intentoId, i.examen_id],
    );
    return res.json({ ok: true, data: { estado: i.estado, titulo: i.titulo, plagio_confirmado: i.plagio_confirmado, ...x } });
  }

  const orden = await ordenPreguntas(pool, i.examen_id, Number(i.semilla_aleatoria));
  const preguntaId = orden[i.posicion];
  const [{ rows: [p] }, { rows: opciones }, { rows: [r] }] = await Promise.all([
    pool.query('SELECT id, tipo, enunciado, imagen_ruta FROM pregunta WHERE id = $1', [preguntaId]),
    pool.query('SELECT id, texto FROM opcion WHERE pregunta_id = $1 ORDER BY orden', [preguntaId]), // sin es_correcta (RNF-07)
    pool.query('SELECT opcion_id, texto_respuesta FROM respuesta WHERE intento_id = $1 AND pregunta_id = $2', [intentoId, preguntaId]),
  ]);
  res.json({
    ok: true,
    data: {
      estado: i.estado, titulo: i.titulo, posicion: i.posicion, total: orden.length,
      restante_ms: Math.max(0, Number(i.restante_ms)),
      umbral_inactividad_min: i.umbral_inactividad_min, permite_herramienta: i.permite_herramienta,
      pregunta: {
        id: p.id, tipo: p.tipo, enunciado: p.enunciado, imagen_ruta: p.imagen_ruta,
        // V/F conserva su orden natural; las de opción múltiple se barajan por alumno (RF-19).
        opciones: p.tipo === 'OPCION_MULTIPLE' ? barajar(opciones, semillaOpciones(Number(i.semilla_aleatoria), p.id)) : opciones,
      },
      respuesta: r ? { opcion_id: r.opcion_id, texto: r.texto_respuesta } : null,
    },
  });
});

// Resultados publicados (RF-29 · CU-24). El detalle (respuesta correcta y comentarios) solo si el docente lo permite (RF-17).
presentacion.get('/intentos/:id/resultado', async (req, res) => {
  const { rows: [i] } = await pool.query(
    `SELECT i.id, i.examen_id, i.semilla_aleatoria, i.fin_en, i.calificacion::float AS calificacion, e.titulo, e.mostrar_respuestas,
            (SELECT count(*) FROM pregunta p WHERE p.examen_id = e.id)::int AS total
       FROM intento i JOIN examen e ON e.id = i.examen_id
      WHERE i.id = $1 AND i.alumno_id = $2 AND i.estado = 'ENVIADO' AND i.publicado`,
    [idValido(req.params.id), req.usuario.id],
  );
  if (!i) return res.status(404).json({ ok: false, error: 'Tu docente aún no publica los resultados de este examen.' });
  const { semilla_aleatoria: semilla, examen_id: examenId, ...resultado } = i;
  if (!i.mostrar_respuestas) return res.json({ ok: true, data: resultado });
  const { rows } = await pool.query(
    `SELECT p.id, p.tipo, p.enunciado, p.puntos::float AS puntos, r.puntos_obtenidos::float AS puntos_obtenidos,
            r.texto_respuesta, r.comentario_docente AS comentario, elegida.texto AS opcion_elegida, correcta.texto AS opcion_correcta
       FROM pregunta p
       LEFT JOIN respuesta r ON r.pregunta_id = p.id AND r.intento_id = $1
       LEFT JOIN opcion elegida ON elegida.id = r.opcion_id
       LEFT JOIN opcion correcta ON correcta.pregunta_id = p.id AND correcta.es_correcta
      WHERE p.examen_id = $2`,
    [i.id, examenId],
  );
  // En el mismo orden en que el alumno las vio.
  const orden = await ordenPreguntas(pool, examenId, Number(semilla));
  res.json({ ok: true, data: { ...resultado, preguntas: orden.map((id) => rows.find((p) => p.id === id)) } });
});

// El navegador avisa un cambio de pestaña o inactividad: se registra la evidencia y se anula el intento (RF-30, RF-31, RF-36 · CU-27).
presentacion.post('/intentos/:id/incidente', async (req, res) => {
  if (!REPORTABLES.includes(req.body?.tipo)) return res.status(400).json({ ok: false, error: 'Tipo de incidente no válido.' });
  const r = await registrarIncidente(idValido(req.params.id), req.usuario.id, req.body.tipo, evidencia(req.ip, req.get('user-agent')));
  if (!r) return res.status(404).json({ ok: false, error: 'No existe ese intento.' });
  res.json({ ok: true, data: r });
});

// Ejecuta fn dentro de una transacción con el intento bloqueado (evita dobles envíos y carreras con el reloj).
async function conIntentoBloqueado(intentoId, alumnoId, fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const i = await cargarIntento(cliente, intentoId, alumnoId, { bloquear: true });
    const resultado = await fn(cliente, i);
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

// Valida y guarda (upsert) la respuesta de la pregunta ACTUAL. Devuelve un error de usuario o null.
async function guardarRespuesta(db, i, orden, cuerpo) {
  const preguntaId = orden[i.posicion];
  if (Number(cuerpo?.pregunta_id) !== preguntaId) return { estado: 409, error: 'Esa pregunta ya no está disponible: las preguntas se responden en orden.' };
  const { rows: [p] } = await db.query('SELECT tipo FROM pregunta WHERE id = $1', [preguntaId]);
  let opcionId = null;
  let texto = null;
  if (p.tipo === 'ABIERTA') {
    if (cuerpo.texto === undefined || cuerpo.texto === null) return null; // sin respuesta: no hay nada que guardar
    if (typeof cuerpo.texto !== 'string' || cuerpo.texto.length > 10000) return { estado: 400, error: 'La respuesta es demasiado larga (máximo 10 000 caracteres).' };
    texto = cuerpo.texto;
  } else {
    if (cuerpo.opcion_id === undefined || cuerpo.opcion_id === null) return null;
    opcionId = idValido(cuerpo.opcion_id);
    const { rowCount } = await db.query('SELECT 1 FROM opcion WHERE id = $1 AND pregunta_id = $2', [opcionId, preguntaId]);
    if (!rowCount) return { estado: 400, error: 'Esa opción no pertenece a la pregunta.' };
  }
  await db.query(
    `INSERT INTO respuesta (intento_id, pregunta_id, opcion_id, texto_respuesta) VALUES ($1, $2, $3, $4)
     ON CONFLICT (intento_id, pregunta_id) DO UPDATE SET opcion_id = EXCLUDED.opcion_id, texto_respuesta = EXCLUDED.texto_respuesta, guardada_en = now()`,
    [i.id, preguntaId, opcionId, texto],
  );
  return null;
}

// Común a autoguardar y avanzar: intento propio, abierto y con tiempo (más la gracia por latencia).
async function operarSobreIntento(req, res, accion) {
  const intentoId = idValido(req.params.id);
  const resultado = await conIntentoBloqueado(intentoId, req.usuario.id, async (db, i) => {
    if (!i) return { http: 404, cuerpo: { ok: false, error: 'No existe ese intento.' } };
    if (!ABIERTOS.includes(i.estado)) return { cerrado: [i.estado, false] };
    if (Number(i.restante_ms) < -GRACIA_MS) {
      await finalizarIntento(db, i.id);
      return { cerrado: ['ENVIADO', true] };
    }
    const orden = await ordenPreguntas(db, i.examen_id, Number(i.semilla_aleatoria));
    const error = await guardarRespuesta(db, i, orden, req.body);
    if (error) return { http: error.estado, cuerpo: { ok: false, error: error.error } };
    return accion(db, i, orden);
  });
  if (resultado.cerrado) return cerrado(res, ...resultado.cerrado);
  res.status(resultado.http || 200).json(resultado.cuerpo);
}

// Autoguardado (RF-24, CU-26).
presentacion.put('/intentos/:id/respuesta', (req, res) => operarSobreIntento(req, res, () => ({ cuerpo: { ok: true, data: { guardada: true } } })));

// Guarda y pasa a la siguiente; en la última, envía y califica (RF-23, RF-38).
presentacion.post('/intentos/:id/avanzar', (req, res) => operarSobreIntento(req, res, async (db, i, orden) => {
  if (i.posicion + 1 >= orden.length) {
    await finalizarIntento(db, i.id);
    return { cuerpo: { ok: true, data: { estado: 'ENVIADO' } } };
  }
  await db.query('UPDATE intento SET posicion = posicion + 1 WHERE id = $1', [i.id]);
  return { cuerpo: { ok: true, data: { estado: i.estado, posicion: i.posicion + 1 } } };
}));

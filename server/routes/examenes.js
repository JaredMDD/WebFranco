import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requiereRol } from '../middleware/auth.js';
import { validarExamen } from '../services/examenes.js';
import { registrarAuditoria } from '../services/auditoria.js';

// Exámenes del docente (RF-10 a RF-19 · CU-08 a CU-11). Siempre filtrado por docente_id (RF-45).
export const examenes = Router();
examenes.use(requiereRol('DOCENTE'));

const idValido = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const noExiste = (res) => res.status(404).json({ ok: false, error: 'No existe ese examen.' });

examenes.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.id, e.titulo, e.abre_en, e.cierra_en, e.estado, e.duracion_min,
            COALESCE((SELECT string_agg(g.nombre, ', ' ORDER BY g.nombre) FROM examen_grupo eg JOIN grupo g ON g.id = eg.grupo_id WHERE eg.examen_id = e.id), '') AS grupos,
            (SELECT count(*) FROM pregunta p WHERE p.examen_id = e.id)::int AS preguntas,
            (SELECT count(*) FROM intento i WHERE i.examen_id = e.id)::int AS intentos
       FROM examen e WHERE e.docente_id = $1 ORDER BY e.creado_en DESC`,
    [req.usuario.id],
  );
  res.json({ ok: true, data: rows });
});

examenes.get('/:id', async (req, res) => {
  const id = idValido(req.params.id);
  const { rows: [e] } = await pool.query(
    `SELECT id, titulo, instrucciones, abre_en, cierra_en, duracion_min, umbral_inactividad_min,
            mostrar_respuestas, permite_herramienta, estado,
            EXISTS (SELECT 1 FROM intento i WHERE i.examen_id = examen.id) AS bloqueado
       FROM examen WHERE id = $1 AND docente_id = $2`,
    [id, req.usuario.id],
  );
  if (!e) return noExiste(res);
  const [grupos, preguntas, extra] = await Promise.all([
    pool.query('SELECT grupo_id FROM examen_grupo WHERE examen_id = $1', [id]),
    pool.query(
      `SELECT p.id, p.tipo, p.enunciado, p.imagen_ruta, p.puntos::float AS puntos,
              COALESCE(json_agg(json_build_object('texto', o.texto, 'es_correcta', o.es_correcta) ORDER BY o.orden)
                       FILTER (WHERE o.id IS NOT NULL), '[]') AS opciones
         FROM pregunta p LEFT JOIN opcion o ON o.pregunta_id = p.id
        WHERE p.examen_id = $1 GROUP BY p.id ORDER BY p.orden`,
      [id],
    ),
    pool.query('SELECT t.alumno_id, t.minutos, u.nombre_usuario FROM tiempo_extra t JOIN usuario u ON u.id = t.alumno_id WHERE t.examen_id = $1 ORDER BY u.nombre_usuario', [id]),
  ]);
  res.json({
    ok: true,
    data: {
      ...e,
      grupos: grupos.rows.map((g) => Number(g.grupo_id)),
      preguntas: preguntas.rows.map((p) => (p.tipo === 'VERDADERO_FALSO'
        ? { ...p, correcta: p.opciones.find((o) => o.texto === 'Verdadero')?.es_correcta === true, opciones: [] }
        : p)),
      tiempos_extra: extra.rows,
    },
  });
});

// Crea (POST /) o reemplaza (PUT /:id) el examen completo en una transacción.
async function guardar(req, res, id) {
  const programar = req.body?.programar === true;
  const { errores, datos } = validarExamen(req.body, { programar, docenteId: req.usuario.id });
  if (errores.length) return res.status(400).json({ ok: false, error: 'Revisa el examen antes de guardar.', detalles: errores });

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    if (id) {
      // FOR UPDATE: bloquea el examen para que nadie lo inicie mientras se reemplaza.
      const { rows: [e] } = await cliente.query('SELECT id FROM examen WHERE id = $1 AND docente_id = $2 FOR UPDATE', [id, req.usuario.id]);
      if (!e) { await cliente.query('ROLLBACK'); return noExiste(res); }
      const { rowCount } = await cliente.query('SELECT 1 FROM intento WHERE examen_id = $1 LIMIT 1', [id]);
      if (rowCount) {
        await cliente.query('ROLLBACK');
        return res.status(409).json({ ok: false, error: 'Este examen ya fue iniciado por al menos un alumno y no se puede modificar.' });
      }
    }

    // Grupos propios y alumnos del tiempo extra inscritos en ellos (nunca se confía en los IDs del navegador).
    if (datos.grupos.length) {
      const { rowCount } = await cliente.query(
        'SELECT 1 FROM grupo g JOIN materia m ON m.id = g.materia_id WHERE g.id = ANY($1::bigint[]) AND m.docente_id = $2',
        [datos.grupos, req.usuario.id],
      );
      if (rowCount !== datos.grupos.length) { await cliente.query('ROLLBACK'); return res.status(400).json({ ok: false, error: 'Uno de los grupos no existe.' }); }
    }
    if (datos.tiempos_extra.length) {
      const alumnos = datos.tiempos_extra.map((t) => t.alumno_id);
      const { rows } = await cliente.query(
        'SELECT DISTINCT alumno_id FROM inscripcion WHERE grupo_id = ANY($1::bigint[]) AND alumno_id = ANY($2::bigint[])',
        [datos.grupos, alumnos],
      );
      if (rows.length !== alumnos.length) {
        await cliente.query('ROLLBACK');
        return res.status(400).json({ ok: false, error: 'El tiempo extra solo se asigna a alumnos inscritos en los grupos del examen.' });
      }
    }

    const valores = [datos.titulo, datos.instrucciones, datos.abre_en, datos.cierra_en, datos.duracion_min,
      datos.umbral_inactividad_min, datos.mostrar_respuestas, datos.permite_herramienta, datos.estado];
    if (id) {
      await cliente.query(
        `UPDATE examen SET titulo = $1, instrucciones = $2, abre_en = $3, cierra_en = $4, duracion_min = $5,
                umbral_inactividad_min = $6, mostrar_respuestas = $7, permite_herramienta = $8, estado = $9 WHERE id = $10`,
        [...valores, id],
      );
      await cliente.query('DELETE FROM pregunta WHERE examen_id = $1', [id]); // en cascada: opciones
      await cliente.query('DELETE FROM examen_grupo WHERE examen_id = $1', [id]);
      await cliente.query('DELETE FROM tiempo_extra WHERE examen_id = $1', [id]);
    } else {
      ({ rows: [{ id }] } = await cliente.query(
        `INSERT INTO examen (titulo, instrucciones, abre_en, cierra_en, duracion_min, umbral_inactividad_min,
                             mostrar_respuestas, permite_herramienta, estado, docente_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [...valores, req.usuario.id],
      ));
    }

    for (const [i, p] of datos.preguntas.entries()) {
      const { rows: [{ id: preguntaId }] } = await cliente.query(
        'INSERT INTO pregunta (examen_id, orden, tipo, enunciado, imagen_ruta, puntos) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [id, i + 1, p.tipo, p.enunciado, p.imagen_ruta, p.puntos],
      );
      for (const [j, o] of p.opciones.entries()) {
        await cliente.query('INSERT INTO opcion (pregunta_id, texto, es_correcta, orden) VALUES ($1, $2, $3, $4)', [preguntaId, o.texto, o.es_correcta, j + 1]);
      }
    }
    for (const g of datos.grupos) await cliente.query('INSERT INTO examen_grupo (examen_id, grupo_id) VALUES ($1, $2)', [id, g]);
    for (const t of datos.tiempos_extra) {
      await cliente.query('INSERT INTO tiempo_extra (examen_id, alumno_id, minutos) VALUES ($1, $2, $3)', [id, t.alumno_id, t.minutos]);
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
  if (programar) await registrarAuditoria(req.usuario.id, 'PROGRAMAR_EXAMEN', 'examen', id, datos.titulo);
  res.status(req.method === 'POST' ? 201 : 200).json({ ok: true, data: { id, estado: datos.estado } });
}

examenes.post('/', (req, res) => guardar(req, res, null));
examenes.put('/:id', (req, res) => {
  const id = idValido(req.params.id);
  return id ? guardar(req, res, id) : noExiste(res);
});

// Solo se elimina un examen que nadie ha iniciado.
examenes.delete('/:id', async (req, res) => {
  const id = idValido(req.params.id);
  const { rows } = await pool.query(
    `DELETE FROM examen e WHERE e.id = $1 AND e.docente_id = $2
        AND NOT EXISTS (SELECT 1 FROM intento i WHERE i.examen_id = e.id) RETURNING titulo`,
    [id, req.usuario.id],
  );
  if (!rows.length) return res.status(409).json({ ok: false, error: 'Solo se puede eliminar un examen propio que ningún alumno haya iniciado.' });
  await registrarAuditoria(req.usuario.id, 'ELIMINAR_EXAMEN', 'examen', id, rows[0].titulo);
  res.json({ ok: true, data: { id } });
});

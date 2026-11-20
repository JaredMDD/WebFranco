import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requiereRol } from '../middleware/auth.js';
import { codigoInscripcion } from '../services/codigos.js';

// Toda consulta filtra por el docente de la sesión: un docente nunca ve ni modifica lo de otro (RF-45, RNF-05).
// Un recurso ajeno responde 404, igual que uno inexistente, para no revelar que existe.
export const docente = Router();
docente.use(requiereRol('DOCENTE'));

const idValido = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const nombreValido = (v, max) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length >= 1 && s.length <= max ? s : null;
};

// Materias con sus grupos y número de alumnos inscritos.
docente.get('/materias', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.nombre,
            COALESCE(json_agg(json_build_object(
              'id', g.id, 'nombre', g.nombre, 'codigo', g.codigo_inscripcion, 'activo', g.activo,
              'alumnos', (SELECT count(*) FROM inscripcion i WHERE i.grupo_id = g.id)
            ) ORDER BY g.nombre) FILTER (WHERE g.id IS NOT NULL), '[]') AS grupos
       FROM materia m LEFT JOIN grupo g ON g.materia_id = m.id
      WHERE m.docente_id = $1
      GROUP BY m.id ORDER BY m.nombre`,
    [req.usuario.id],
  );
  res.json({ ok: true, data: rows });
});

docente.post('/materias', async (req, res) => {
  const nombre = nombreValido(req.body?.nombre, 120);
  if (!nombre) return res.status(400).json({ ok: false, error: 'Escribe el nombre de la materia (máximo 120 caracteres).' });
  const { rows: [m] } = await pool.query('INSERT INTO materia (docente_id, nombre) VALUES ($1, $2) RETURNING id, nombre', [req.usuario.id, nombre]);
  res.status(201).json({ ok: true, data: m });
});

// Solo se elimina una materia sin grupos (para corregir una captura); con grupos se perderían inscripciones.
docente.delete('/materias/:id', async (req, res) => {
  const id = idValido(req.params.id);
  const { rows } = await pool.query(
    `DELETE FROM materia m WHERE m.id = $1 AND m.docente_id = $2
        AND NOT EXISTS (SELECT 1 FROM grupo g WHERE g.materia_id = m.id) RETURNING id`,
    [id, req.usuario.id],
  );
  if (!rows.length) return res.status(409).json({ ok: false, error: 'Solo se puede eliminar una materia propia y sin grupos.' });
  res.json({ ok: true, data: { id } });
});

docente.post('/grupos', async (req, res) => {
  const materiaId = idValido(req.body?.materia_id);
  const nombre = nombreValido(req.body?.nombre, 80);
  if (!materiaId || !nombre) return res.status(400).json({ ok: false, error: 'Elige la materia y escribe el nombre del grupo (máximo 80 caracteres).' });
  const { rowCount } = await pool.query('SELECT 1 FROM materia WHERE id = $1 AND docente_id = $2', [materiaId, req.usuario.id]);
  if (!rowCount) return res.status(404).json({ ok: false, error: 'No existe esa materia.' });

  // Reintenta si el código aleatorio ya existe (muy improbable).
  for (let intento = 0; intento < 5; intento++) {
    try {
      const { rows: [g] } = await pool.query(
        'INSERT INTO grupo (materia_id, nombre, codigo_inscripcion) VALUES ($1, $2, $3) RETURNING id, nombre, codigo_inscripcion AS codigo, activo',
        [materiaId, nombre, codigoInscripcion()],
      );
      return res.status(201).json({ ok: true, data: g });
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error('No se pudo generar un código de inscripción único.');
});

// Un grupo inactivo deja de aceptar inscripciones; los alumnos ya inscritos se conservan.
docente.patch('/grupos/:id', async (req, res) => {
  const id = idValido(req.params.id);
  const activo = req.body?.activo;
  if (!id || typeof activo !== 'boolean') return res.status(400).json({ ok: false, error: 'Datos inválidos.' });
  const { rows } = await pool.query(
    `UPDATE grupo g SET activo = $1 FROM materia m
      WHERE g.id = $2 AND m.id = g.materia_id AND m.docente_id = $3 RETURNING g.id, g.activo`,
    [activo, id, req.usuario.id],
  );
  if (!rows.length) return res.status(404).json({ ok: false, error: 'No existe ese grupo.' });
  res.json({ ok: true, data: rows[0] });
});

docente.get('/grupos/:id/alumnos', async (req, res) => {
  const id = idValido(req.params.id);
  const { rowCount } = await pool.query('SELECT 1 FROM grupo g JOIN materia m ON m.id = g.materia_id WHERE g.id = $1 AND m.docente_id = $2', [id, req.usuario.id]);
  if (!rowCount) return res.status(404).json({ ok: false, error: 'No existe ese grupo.' });
  const { rows } = await pool.query(
    'SELECT u.id, u.nombre_usuario, i.creado_en FROM inscripcion i JOIN usuario u ON u.id = i.alumno_id WHERE i.grupo_id = $1 ORDER BY u.nombre_usuario',
    [id],
  );
  res.json({ ok: true, data: rows });
});

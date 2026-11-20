import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { requiereRol } from '../middleware/auth.js';
import { CODIGO_VALIDO, normalizarCodigo } from '../services/codigos.js';

export const alumno = Router();
alumno.use(requiereRol('ALUMNO'));

// Contra adivinar códigos: 20 códigos inválidos cada 15 min por alumno.
const limiteInscripcion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode < 400 || res.statusCode === 409, // "ya inscrito" no es un intento fallido
  keyGenerator: (req) => `alumno:${req.usuario.id}`,
  handler: (req, res) => res.status(429).json({ ok: false, error: 'Demasiados códigos inválidos. Espera 15 minutos e inténtalo de nuevo.' }),
});

alumno.get('/grupos', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT g.id, g.nombre AS grupo, m.nombre AS materia, d.nombre_usuario AS docente
       FROM inscripcion i
       JOIN grupo g ON g.id = i.grupo_id
       JOIN materia m ON m.id = g.materia_id
       JOIN usuario d ON d.id = m.docente_id
      WHERE i.alumno_id = $1 ORDER BY m.nombre, g.nombre`,
    [req.usuario.id],
  );
  res.json({ ok: true, data: rows });
});

// Inscripción con el código que comparte el docente (RF-09, CU-20).
alumno.post('/inscripciones', limiteInscripcion, async (req, res) => {
  const codigo = normalizarCodigo(req.body?.codigo);
  const invalido = () => res.status(404).json({ ok: false, error: 'Ese código no existe o el grupo ya no acepta inscripciones. Revísalo con tu docente.' });
  if (!CODIGO_VALIDO.test(codigo)) return invalido();

  const { rows: [g] } = await pool.query(
    `SELECT g.id, g.nombre AS grupo, m.nombre AS materia
       FROM grupo g JOIN materia m ON m.id = g.materia_id
      WHERE g.codigo_inscripcion = $1 AND g.activo`,
    [codigo],
  );
  if (!g) return invalido();
  try {
    await pool.query('INSERT INTO inscripcion (grupo_id, alumno_id) VALUES ($1, $2)', [g.id, req.usuario.id]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: `Ya estás inscrito en ${g.materia} · ${g.grupo}.` });
    throw err;
  }
  res.status(201).json({ ok: true, data: g });
});

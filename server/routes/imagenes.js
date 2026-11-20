import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { requiereRol } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { IMAGEN_VALIDA } from '../services/examenes.js';

// Imágenes de preguntas (RF-13). No se publican como estáticos: verlas antes del examen filtraría las preguntas.
export const DIR_IMAGENES = fileURLToPath(new URL('../uploads/', import.meta.url));
mkdirSync(DIR_IMAGENES, { recursive: true });

export const imagenes = Router();
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

// El tipo se decide por los primeros bytes, no por lo que declara el navegador.
function tipoReal(buffer) {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  return null;
}

imagenes.post('/', requiereRol('DOCENTE'), (req, res, next) => {
  subida.single('imagen')(req, res, async (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ ok: false, error: 'La imagen pesa más de 2 MB.' });
    if (err) return next(err);
    const ext = req.file && tipoReal(req.file.buffer);
    if (!ext) return res.status(400).json({ ok: false, error: 'Sube una imagen PNG o JPG.' });
    const nombre = `${req.usuario.id}-${randomBytes(8).toString('hex')}.${ext}`;
    await writeFile(DIR_IMAGENES + nombre, req.file.buffer);
    res.status(201).json({ ok: true, data: { ruta: nombre } });
  });
});

// La ve el docente dueño (prefijo del nombre) o un alumno con un intento abierto de un examen que la usa.
imagenes.get('/:archivo', requiereRol('DOCENTE', 'ALUMNO'), async (req, res) => {
  const m = IMAGEN_VALIDA.exec(req.params.archivo);
  const noExiste = () => res.status(404).json({ ok: false, error: 'No existe esa imagen.' });
  if (!m) return noExiste();
  if (req.usuario.rol === 'DOCENTE' && Number(m[1]) !== req.usuario.id) return noExiste();
  if (req.usuario.rol === 'ALUMNO') {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM pregunta p JOIN intento i ON i.examen_id = p.examen_id
        WHERE p.imagen_ruta = $1 AND i.alumno_id = $2 AND i.estado IN ('EN_CURSO', 'REABIERTO') LIMIT 1`,
      [req.params.archivo, req.usuario.id],
    );
    if (!rowCount) return noExiste();
  }
  res.set('Cache-Control', 'private, max-age=3600');
  res.sendFile(req.params.archivo, { root: DIR_IMAGENES }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ ok: false, error: 'No existe esa imagen.' });
  });
});

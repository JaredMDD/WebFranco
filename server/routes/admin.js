import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requiereRol, cerrarSesionesDeUsuario } from '../middleware/auth.js';
import { hashContrasena, contrasenaAleatoria, USUARIO_VALIDO } from '../services/contrasenas.js';
import { registrarAuditoria } from '../services/auditoria.js';

// Solo el administrador crea docentes (RF-03, RF-04): un docente recibe 403 en todo este router.
export const admin = Router();
admin.use(requiereRol('ADMIN'));

admin.get('/estado', async (req, res) => {
  const { rows: [r] } = await pool.query(
    `SELECT (SELECT count(*) FROM intento WHERE estado = 'EN_CURSO')::int AS intentos_en_curso,
            (SELECT count(*) FROM incidente WHERE decision = 'PENDIENTE')::int AS incidentes_pendientes,
            (SELECT count(*) FROM usuario WHERE rol = 'DOCENTE' AND activo)::int AS docentes_activos,
            (SELECT count(*) FROM usuario WHERE rol = 'ALUMNO')::int AS alumnos`,
  );
  res.json({ ok: true, data: r });
});

admin.get('/docentes', async (req, res) => {
  const { rows } = await pool.query("SELECT id, nombre_usuario, activo, creado_en FROM usuario WHERE rol = 'DOCENTE' ORDER BY nombre_usuario");
  res.json({ ok: true, data: rows });
});

admin.post('/docentes', async (req, res) => {
  const usuario = String(req.body?.usuario ?? '').trim().toLowerCase();
  if (!USUARIO_VALIDO.test(usuario)) {
    return res.status(400).json({ ok: false, error: 'El usuario debe tener de 3 a 50 caracteres: letras, números, punto o guion bajo.' });
  }
  const contrasena = contrasenaAleatoria();
  let id;
  try {
    ({ rows: [{ id }] } = await pool.query(
      "INSERT INTO usuario (nombre_usuario, contrasena_hash, rol) VALUES ($1, $2, 'DOCENTE') RETURNING id",
      [usuario, await hashContrasena(contrasena)],
    ));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ese usuario ya existe. Elige otro.' });
    throw err;
  }
  await registrarAuditoria(req.usuario.id, 'CREAR_DOCENTE', 'usuario', id, usuario);
  // La contraseña inicial solo se devuelve aquí, una vez.
  res.status(201).json({ ok: true, data: { id, usuario, contrasena } });
});

admin.patch('/docentes/:id', async (req, res) => {
  const id = Number(req.params.id);
  const activo = req.body?.activo;
  if (!Number.isSafeInteger(id) || typeof activo !== 'boolean') return res.status(400).json({ ok: false, error: 'Datos inválidos.' });
  const { rows } = await pool.query("UPDATE usuario SET activo = $1 WHERE id = $2 AND rol = 'DOCENTE' RETURNING nombre_usuario", [activo, id]);
  if (!rows.length) return res.status(404).json({ ok: false, error: 'No existe ese docente.' });
  if (!activo) await cerrarSesionesDeUsuario(id);
  await registrarAuditoria(req.usuario.id, activo ? 'ACTIVAR_DOCENTE' : 'DESACTIVAR_DOCENTE', 'usuario', id, rows[0].nombre_usuario);
  res.json({ ok: true, data: { id, activo } });
});

// Restablece la contraseña de un docente o alumno (RF-05). Las de administradores no se tocan desde aquí.
admin.post('/restablecer', async (req, res) => {
  const usuario = String(req.body?.usuario ?? '').trim().toLowerCase();
  const contrasena = contrasenaAleatoria();
  const { rows } = await pool.query(
    "UPDATE usuario SET contrasena_hash = $1 WHERE nombre_usuario = $2 AND rol IN ('DOCENTE', 'ALUMNO') RETURNING id, rol",
    [await hashContrasena(contrasena), usuario],
  );
  if (!rows.length) return res.status(404).json({ ok: false, error: 'No existe un docente o alumno con ese usuario.' });
  await cerrarSesionesDeUsuario(rows[0].id);
  await registrarAuditoria(req.usuario.id, 'RESTABLECER_CONTRASENA', 'usuario', rows[0].id, usuario);
  res.json({ ok: true, data: { usuario, rol: rows[0].rol, contrasena } });
});

admin.get('/incidentes', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.id, i.tipo, i.ocurrio_en, i.decision, a.nombre_usuario AS alumno, e.titulo AS examen, d.nombre_usuario AS docente
       FROM incidente i
       JOIN intento t ON t.id = i.intento_id
       JOIN usuario a ON a.id = t.alumno_id
       JOIN examen e ON e.id = t.examen_id
       JOIN usuario d ON d.id = e.docente_id
      ORDER BY i.ocurrio_en DESC LIMIT 20`,
  );
  res.json({ ok: true, data: rows });
});

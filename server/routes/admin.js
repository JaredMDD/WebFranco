import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requiereRol, cerrarSesionesDeUsuario } from '../middleware/auth.js';
import { hashContrasena, contrasenaAleatoria, USUARIO_VALIDO } from '../services/contrasenas.js';
import { registrarAuditoria } from '../services/auditoria.js';
import { CORREO_VALIDO, normalizarCorreo, enviarCorreo, correoContrasena } from '../services/correo.js';

// Solo el administrador gestiona cuentas (RF-03, RF-04): un docente recibe 403 en todo este router.
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

const ROLES_CUENTA = { DOCENTE: 'docente', ADMIN: 'administrador' };

admin.get('/cuentas', async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, nombre_usuario, rol, correo, activo, creado_en FROM usuario WHERE rol IN ('DOCENTE', 'ADMIN') ORDER BY rol DESC, nombre_usuario",
  );
  res.json({ ok: true, data: rows.map((r) => ({ ...r, propia: r.id === req.usuario.id })) });
});

// Si se pudo enviar por correo, la contraseña no viaja a la pantalla; si no, se devuelve una vez como respaldo.
async function entregarContrasena(usuario, correo, contrasena, motivo) {
  const enviado = Boolean(correo) && await enviarCorreo(correo, 'Tu contraseña · Plataforma de exámenes', correoContrasena(usuario, contrasena, motivo));
  return enviado ? { enviado, correo } : { enviado, contrasena };
}

// Crea docentes y otros administradores (RF-03, RF-04). La contraseña inicial se manda a su correo.
admin.post('/cuentas', async (req, res) => {
  const usuario = String(req.body?.usuario ?? '').trim().toLowerCase();
  const correo = normalizarCorreo(req.body?.correo);
  const rol = req.body?.rol ?? 'DOCENTE';
  if (!USUARIO_VALIDO.test(usuario)) {
    return res.status(400).json({ ok: false, error: 'El usuario debe tener de 3 a 50 caracteres: letras, números, punto o guion bajo.' });
  }
  if (correo.length > 254 || !CORREO_VALIDO.test(correo)) return res.status(400).json({ ok: false, error: 'Escribe un correo válido.' });
  if (!ROLES_CUENTA[rol]) return res.status(400).json({ ok: false, error: 'Tipo de cuenta inválido.' });
  const contrasena = contrasenaAleatoria();
  let id;
  try {
    ({ rows: [{ id }] } = await pool.query(
      'INSERT INTO usuario (nombre_usuario, contrasena_hash, rol, correo) VALUES ($1, $2, $3, $4) RETURNING id',
      [usuario, await hashContrasena(contrasena), rol, correo],
    ));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ese usuario o correo ya existe.' });
    throw err;
  }
  await registrarAuditoria(req.usuario.id, `CREAR_${rol}`, 'usuario', id, usuario);
  res.status(201).json({ ok: true, data: { id, usuario, rol, ...await entregarContrasena(usuario, correo, contrasena, `Se creó tu cuenta de ${ROLES_CUENTA[rol]}`) } });
});

// Activa o desactiva una cuenta, o le cambia el correo. Nadie se desactiva a sí mismo: siempre queda un administrador.
admin.patch('/cuentas/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { activo } = req.body ?? {};
  const correo = req.body?.correo === undefined ? undefined : normalizarCorreo(req.body.correo);
  if (!Number.isSafeInteger(id) || (activo === undefined) === (correo === undefined) || (activo !== undefined && typeof activo !== 'boolean')) {
    return res.status(400).json({ ok: false, error: 'Datos inválidos.' });
  }
  if (correo !== undefined && (correo.length > 254 || !CORREO_VALIDO.test(correo))) return res.status(400).json({ ok: false, error: 'Escribe un correo válido.' });
  if (activo === false && id === req.usuario.id) return res.status(400).json({ ok: false, error: 'No puedes desactivar tu propia cuenta.' });

  let rows;
  try {
    ({ rows } = await pool.query(
      `UPDATE usuario SET activo = COALESCE($1, activo), correo = COALESCE($2, correo)
        WHERE id = $3 AND rol IN ('DOCENTE', 'ADMIN') RETURNING nombre_usuario, rol`,
      [activo ?? null, correo ?? null, id],
    ));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ese correo ya lo usa otra cuenta.' });
    throw err;
  }
  if (!rows.length) return res.status(404).json({ ok: false, error: 'No existe esa cuenta.' });
  const [{ nombre_usuario: usuario, rol }] = rows;
  if (activo === false) await cerrarSesionesDeUsuario(id);
  const accion = correo !== undefined ? 'CAMBIAR_CORREO' : `${activo ? 'ACTIVAR' : 'DESACTIVAR'}_${rol}`;
  await registrarAuditoria(req.usuario.id, accion, 'usuario', id, correo ?? usuario);
  res.json({ ok: true, data: { id, activo, correo } });
});

// Restablece la contraseña de un docente o alumno (RF-05); al docente con correo se le envía.
// Las de administradores no se tocan desde aquí: cada uno usa "Olvidé mi contraseña".
admin.post('/restablecer', async (req, res) => {
  const usuario = String(req.body?.usuario ?? '').trim().toLowerCase();
  const contrasena = contrasenaAleatoria();
  const { rows } = await pool.query(
    "UPDATE usuario SET contrasena_hash = $1, recuperacion_hash = NULL WHERE nombre_usuario = $2 AND rol IN ('DOCENTE', 'ALUMNO') RETURNING id, rol, correo",
    [await hashContrasena(contrasena), usuario],
  );
  if (!rows.length) return res.status(404).json({ ok: false, error: 'No existe un docente o alumno con ese usuario.' });
  const [{ id, rol, correo }] = rows;
  await cerrarSesionesDeUsuario(id);
  await registrarAuditoria(req.usuario.id, 'RESTABLECER_CONTRASENA', 'usuario', id, usuario);
  res.json({ ok: true, data: { usuario, rol, ...await entregarContrasena(usuario, correo, contrasena, 'El administrador restableció tu contraseña') } });
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

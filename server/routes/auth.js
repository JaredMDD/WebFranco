import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { detectarSesionDuplicada, evidencia } from '../services/incidentes.js';
import { crearSesion, cerrarSesion, cerrarSesionesDeUsuario, requiereRol, PANEL_POR_ROL } from '../middleware/auth.js';
import { hashContrasena, verificarContrasena, motivoContrasenaDebil, USUARIO_VALIDO } from '../services/contrasenas.js';
import { registrarAuditoria } from '../services/auditoria.js';
import { CORREO_VALIDO, normalizarCorreo, enviarCorreo, enlaceRecuperacion } from '../services/correo.js';

export const auth = Router();

const demasiados = (mensaje) => (req, res) => res.status(429).json({ ok: false, error: mensaje });

// Por IP + usuario, para no bloquear a todo un plantel que sale por la misma IP (RNF-04). Solo cuentan los fallos.
const limiteEntrar = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.usuario ?? '').toLowerCase()}`,
  handler: demasiados('Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.'),
});

// shortcut: límite por IP; si muchos alumnos se registran a la vez desde la red del plantel, subir el límite o agregar captcha.
const limiteRegistro = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  handler: demasiados('Demasiados registros desde esta red. Espera 15 minutos e inténtalo de nuevo.'),
});

const texto = (v) => (typeof v === 'string' ? v : '');
const normalizarUsuario = (v) => texto(v).trim().toLowerCase();

// Hash de relleno: si el usuario no existe se compara igual, para no revelar por tiempo qué usuarios existen.
const hashRelleno = await hashContrasena('relleno-no-es-una-contrasena-1');

auth.post('/registro', limiteRegistro, async (req, res) => {
  const { contrasena, confirmar, sitio_web: trampa } = req.body ?? {};
  if (texto(trampa)) return res.status(400).json({ ok: false, error: 'No se pudo crear la cuenta.' }); // campo oculto: solo lo llenan bots
  const usuario = normalizarUsuario(req.body?.usuario);
  if (!USUARIO_VALIDO.test(usuario)) {
    return res.status(400).json({ ok: false, error: 'El usuario debe tener de 3 a 50 caracteres: letras, números, punto o guion bajo.' });
  }
  const debil = motivoContrasenaDebil(contrasena);
  if (debil) return res.status(400).json({ ok: false, error: debil });
  if (contrasena !== confirmar) return res.status(400).json({ ok: false, error: 'Las contraseñas no coinciden.' });

  try {
    await pool.query("INSERT INTO usuario (nombre_usuario, contrasena_hash, rol) VALUES ($1, $2, 'ALUMNO')", [usuario, await hashContrasena(contrasena)]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ese usuario ya existe. Elige otro.' });
    throw err;
  }
  res.status(201).json({ ok: true, data: { usuario } });
});

auth.post('/entrar', limiteEntrar, async (req, res) => {
  const usuario = normalizarUsuario(req.body?.usuario);
  const contrasena = texto(req.body?.contrasena);
  const { rows } = await pool.query('SELECT id, nombre_usuario, contrasena_hash, rol, activo FROM usuario WHERE nombre_usuario = $1', [usuario]);
  const u = rows[0];
  const correcta = await verificarContrasena(contrasena, u?.contrasena_hash ?? hashRelleno);
  if (!u || !correcta) return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
  if (!u.activo) return res.status(403).json({ ok: false, error: 'Tu cuenta está desactivada. Contacta al administrador.' });

  if (u.rol === 'ALUMNO') await detectarSesionDuplicada(u.id, evidencia(req.ip, req.get('user-agent')));
  await crearSesion(res, u);
  res.json({ ok: true, data: { usuario: u.nombre_usuario, rol: u.rol, panel: PANEL_POR_ROL[u.rol] } });
});

auth.post('/salir', async (req, res) => {
  await cerrarSesion(req, res);
  res.json({ ok: true, data: null });
});

auth.get('/yo', async (req, res) => {
  if (!req.usuario) return res.status(401).json({ ok: false, error: 'Sin sesión.' });
  const { rows: [u] } = await pool.query('SELECT correo FROM usuario WHERE id = $1', [req.usuario.id]);
  res.json({ ok: true, data: { usuario: req.usuario.nombre_usuario, rol: req.usuario.rol, correo: u?.correo ?? null } });
});

// ---- Mi cuenta (docentes y administradores) ----
// Ambos cambios piden la contraseña actual: con una sesión robada no se puede secuestrar la cuenta.
const miCuenta = requiereRol('ADMIN', 'DOCENTE');
async function contrasenaActualCorrecta(req) {
  const { rows: [u] } = await pool.query('SELECT contrasena_hash FROM usuario WHERE id = $1', [req.usuario.id]);
  return verificarContrasena(texto(req.body?.actual), u.contrasena_hash);
}
const ACTUAL_INCORRECTA = { ok: false, error: 'La contraseña actual no es correcta.' };

auth.post('/contrasena', miCuenta, async (req, res) => {
  const { nueva, confirmar } = req.body ?? {};
  const debil = motivoContrasenaDebil(nueva);
  if (debil) return res.status(400).json({ ok: false, error: debil });
  if (nueva !== confirmar) return res.status(400).json({ ok: false, error: 'Las contraseñas no coinciden.' });
  if (!await contrasenaActualCorrecta(req)) return res.status(400).json(ACTUAL_INCORRECTA);

  await pool.query('UPDATE usuario SET contrasena_hash = $1, recuperacion_hash = NULL WHERE id = $2', [await hashContrasena(nueva), req.usuario.id]);
  // Cierra las demás sesiones (otro equipo con la contraseña vieja) y deja abierta una nueva en este.
  await cerrarSesionesDeUsuario(req.usuario.id);
  await crearSesion(res, req.usuario);
  await registrarAuditoria(req.usuario.id, 'CAMBIAR_CONTRASENA', 'usuario', req.usuario.id, req.usuario.nombre_usuario);
  res.json({ ok: true, data: null });
});

auth.post('/correo', miCuenta, async (req, res) => {
  const correo = normalizarCorreo(req.body?.correo);
  if (correo.length > 254 || !CORREO_VALIDO.test(correo)) return res.status(400).json({ ok: false, error: 'Escribe un correo válido.' });
  if (!await contrasenaActualCorrecta(req)) return res.status(400).json(ACTUAL_INCORRECTA);
  try {
    await pool.query('UPDATE usuario SET correo = $1 WHERE id = $2', [correo, req.usuario.id]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Ese correo ya lo usa otra cuenta.' });
    throw err;
  }
  await registrarAuditoria(req.usuario.id, 'CAMBIAR_CORREO', 'usuario', req.usuario.id, correo);
  res.json({ ok: true, data: { correo } });
});

// ---- Olvidé mi contraseña (docentes y administradores con correo) ----
const limiteRecuperar = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // compartido por pedir el enlace y usarlo
  handler: demasiados('Demasiadas solicitudes. Espera 15 minutos e inténtalo de nuevo.'),
});
const RECUPERACION_MIN = 60;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

auth.post('/olvide', limiteRecuperar, async (req, res) => {
  const dato = texto(req.body?.usuario).trim().toLowerCase();
  // Misma respuesta exista o no la cuenta, para no revelar usuarios ni correos.
  res.json({ ok: true, data: { mensaje: `Si la cuenta existe y tiene correo registrado, te enviamos un enlace válido por ${RECUPERACION_MIN} minutos.` } });
  if (dato) enviarRecuperacion(dato).catch((err) => console.error('Recuperación de contraseña:', err));
});

// Ya se respondió: los errores aquí solo se registran.
async function enviarRecuperacion(dato) {
  const token = randomBytes(32).toString('base64url');
  const { rows: [u] } = await pool.query(
    `UPDATE usuario SET recuperacion_hash = $1, recuperacion_expira = now() + make_interval(mins => $2)
      WHERE (nombre_usuario = $3 OR lower(correo) = $3) AND rol IN ('ADMIN', 'DOCENTE') AND activo AND correo IS NOT NULL
      RETURNING id, nombre_usuario, correo`,
    [hashToken(token), RECUPERACION_MIN, dato],
  );
  if (!u) return;
  const enlace = enlaceRecuperacion(token);
  if (!enlace) return console.error('Recuperación de contraseña: falta URL_PUBLICA en .env; no se envió el enlace.');
  await enviarCorreo(u.correo, 'Restablecer tu contraseña · Plataforma de exámenes', [
    `Hola, ${u.nombre_usuario}.`,
    '',
    'Pediste restablecer tu contraseña de la Plataforma de exámenes del Tecnológico de Cuautla.',
    `Abre este enlace en los próximos ${RECUPERACION_MIN} minutos para elegir una nueva:`,
    '',
    enlace,
    '',
    'Si no lo pediste, ignora este correo: tu contraseña actual sigue funcionando.',
  ].join('\n'));
}

auth.post('/recuperar', limiteRecuperar, async (req, res) => {
  const { contrasena, confirmar } = req.body ?? {};
  const debil = motivoContrasenaDebil(contrasena);
  if (debil) return res.status(400).json({ ok: false, error: debil });
  if (contrasena !== confirmar) return res.status(400).json({ ok: false, error: 'Las contraseñas no coinciden.' });
  const { rows: [u] } = await pool.query(
    `UPDATE usuario SET contrasena_hash = $1, recuperacion_hash = NULL
      WHERE recuperacion_hash = $2 AND recuperacion_expira > now() AND activo
      RETURNING id, nombre_usuario`,
    [await hashContrasena(contrasena), hashToken(texto(req.body?.token))],
  );
  if (!u) return res.status(400).json({ ok: false, error: 'El enlace no es válido o ya venció. Pide uno nuevo.' });
  await cerrarSesionesDeUsuario(u.id);
  await registrarAuditoria(u.id, 'RECUPERAR_CONTRASENA', 'usuario', u.id, u.nombre_usuario);
  res.json({ ok: true, data: { usuario: u.nombre_usuario } });
});

import { Router } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { detectarSesionDuplicada, evidencia } from '../services/incidentes.js';
import { crearSesion, cerrarSesion, PANEL_POR_ROL } from '../middleware/auth.js';
import { hashContrasena, verificarContrasena, motivoContrasenaDebil, USUARIO_VALIDO } from '../services/contrasenas.js';

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

auth.get('/yo', (req, res) => {
  if (!req.usuario) return res.status(401).json({ ok: false, error: 'Sin sesión.' });
  res.json({ ok: true, data: { usuario: req.usuario.nombre_usuario, rol: req.usuario.rol } });
});

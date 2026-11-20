import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../db/pool.js';

export const COOKIE = 'sid';
// shortcut: expiración fija de 8 h desde el inicio de sesión, sin renovación; si un examen largo la rebasa, renovar al usarla.
const DURACION_MS = 8 * 60 * 60 * 1000;
export const PANEL_POR_ROL = { ADMIN: '/admin/panel.html', DOCENTE: '/docente/panel.html', ALUMNO: '/alumno/panel.html' };

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'strict', // junto con aceptar solo JSON, evita peticiones forjadas desde otros sitios
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

// Crea la sesión. Un alumno solo puede tener una activa: las anteriores se cierran (RF-34, RNF-02).
export async function crearSesion(res, usuario) {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DURACION_MS);
  if (usuario.rol === 'ALUMNO') {
    await pool.query('UPDATE sesion SET activa = false WHERE usuario_id = $1 AND activa', [usuario.id]);
  }
  await pool.query('INSERT INTO sesion (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)', [usuario.id, hashToken(token), expira]);
  res.cookie(COOKIE, token, { ...opcionesCookie(), expires: expira });
}

export async function cerrarSesion(req, res) {
  const token = req.cookies[COOKIE];
  if (token) await pool.query('UPDATE sesion SET activa = false WHERE token_hash = $1', [hashToken(token)]);
  res.clearCookie(COOKIE, opcionesCookie());
}

// Extiende la sesión actual (BD y cookie) para que no venza a mitad de un examen. Nunca la acorta.
export async function extenderSesion(req, res, hasta) {
  const token = req.cookies?.[COOKIE];
  if (!token) return;
  const { rows: [s] } = await pool.query(
    'UPDATE sesion SET expira_en = GREATEST(expira_en, $2) WHERE token_hash = $1 AND activa RETURNING expira_en',
    [hashToken(token), hasta],
  );
  if (s) res.cookie(COOKIE, token, { ...opcionesCookie(), expires: s.expira_en });
}

export async function cerrarSesionesDeUsuario(usuarioId) {
  await pool.query('UPDATE sesion SET activa = false WHERE usuario_id = $1 AND activa', [usuarioId]);
}

// Lee la cookie (sin dependencia extra: Express no trae parser de cookies).
function leerCookies(req) {
  const cookies = {};
  for (const par of (req.headers.cookie || '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) cookies[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return cookies;
}

// Deja en req.usuario {id, nombre_usuario, rol} si la sesión es válida, activa, no vencida y el usuario sigue activo.
export async function cargarSesion(req, res, next) {
  req.cookies = leerCookies(req);
  req.usuario = null;
  const token = req.cookies[COOKIE];
  if (token) {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre_usuario, u.rol
         FROM sesion s JOIN usuario u ON u.id = s.usuario_id
        WHERE s.token_hash = $1 AND s.activa AND s.expira_en > now() AND u.activo`,
      [hashToken(token)],
    );
    req.usuario = rows[0] || null;
  }
  next();
}

// Para la API: 401 sin sesión, 403 con rol equivocado (RNF-05).
export const requiereRol = (...roles) => (req, res, next) => {
  if (!req.usuario) return res.status(401).json({ ok: false, error: 'Tu sesión terminó. Vuelve a iniciar sesión.' });
  if (!roles.includes(req.usuario.rol)) return res.status(403).json({ ok: false, error: 'No tienes permiso para esta acción.' });
  next();
};

// Para las páginas HTML de cada rol: sin sesión o con otro rol, de vuelta al acceso.
export const requierePagina = (rol) => (req, res, next) => {
  res.set('Cache-Control', 'no-store'); // tras cerrar sesión, "atrás" no debe mostrar la página guardada
  if (req.usuario?.rol === rol) return next();
  res.redirect(req.usuario ? PANEL_POR_ROL[req.usuario.rol] : '/');
};

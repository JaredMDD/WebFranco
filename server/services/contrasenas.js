import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

// Costo 10: ~200 inicios de sesión simultáneos al abrir un examen no deben saturar el servidor gratuito (RNF-10).
const COSTO = 10;

export const hashContrasena = (contrasena) => bcrypt.hash(contrasena, COSTO);
export const verificarContrasena = (contrasena, hash) => bcrypt.compare(contrasena, hash);

// 12 caracteres sin ambiguos (0/O, 1/l/I) para dictarla o copiarla a mano.
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function contrasenaAleatoria(largo = 12) {
  return [...randomBytes(largo)].map((b) => ALFABETO[b % ALFABETO.length]).join('');
}

export const USUARIO_VALIDO = /^[A-Za-z0-9._]{3,50}$/;

// Devuelve el motivo si la contraseña es débil, o null si es aceptable.
export function motivoContrasenaDebil(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (Buffer.byteLength(contrasena) > 72) return 'La contraseña es demasiado larga (máximo 72 caracteres).'; // límite de bcrypt
  if (!/[A-Za-z]/.test(contrasena) || !/[0-9]/.test(contrasena)) return 'La contraseña debe incluir letras y números.';
  return null;
}

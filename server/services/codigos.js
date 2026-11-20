import { randomInt } from 'node:crypto';

// Sin caracteres que se confunden al dictarlos o copiarlos (0/O, 1/I/L).
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODIGO_VALIDO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

// 31^6 ≈ 887 millones de combinaciones: adivinar uno es impráctico con el límite de intentos de inscripción.
export function codigoInscripcion() {
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  return codigo;
}

export const normalizarCodigo = (v) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');

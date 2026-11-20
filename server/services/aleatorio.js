import { randomInt } from 'node:crypto';

// Aleatorización reproducible sin banco de preguntas (RF-19): la misma semilla da siempre el mismo orden,
// así el alumno ve lo mismo si recarga y el docente puede reconstruir qué vio.

export const semillaNueva = () => randomInt(1, 2 ** 31);

// mulberry32: generador pequeño y determinista; no es criptográfico ni necesita serlo (solo baraja).
function generador(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates con el generador sembrado; no modifica la lista original.
export function barajar(lista, semilla) {
  const azar = generador(semilla);
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Semilla distinta por pregunta para barajar sus opciones.
export const semillaOpciones = (semilla, preguntaId) => (semilla ^ Math.imul(Number(preguntaId), 2654435761)) >>> 0;

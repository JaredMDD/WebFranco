// Prueba de la calculadora integrada del examen (RF-18, npm test). El archivo es un script de navegador: se carga con vm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const contexto = {};
vm.runInNewContext(readFileSync(new URL('../public/js/calculadora.js', import.meta.url), 'utf8'), contexto);
const { evaluarExpresion } = contexto;

test('la calculadora respeta precedencia, paréntesis, signos y decimales (RF-18)', () => {
  for (const [expresion, esperado] of [
    ['2+3*4', 14], ['(2+3)*4', 20], ['2×(3−1)', 4], ['10÷4', 2.5], ['-3+5', 2], ['--2', 2], ['-(2+3)', -5],
    ['.5+1', 1.5], ['1,5*2', 3], ['0.1+0.2', 0.3], ['7', 7], [' 8 / 2 / 2 ', 2], ['2*-3', -6],
  ]) assert.equal(evaluarExpresion(expresion), esperado, expresion);
});

test('la calculadora rechaza lo que no es una operación, sin ejecutar código', () => {
  for (const expresion of ['', '2+', '(2', '2)', '3..2', 'alert(1)', '2^3', 'Math.PI', '1e3', 'x'.repeat(201)]) {
    assert.throws(() => evaluarExpresion(expresion), /no válida|Escribe/, expresion);
  }
  assert.throws(() => evaluarExpresion('1/0'), /dividir entre cero/);
  assert.throws(() => evaluarExpresion('0/0'), /dividir entre cero/);
});

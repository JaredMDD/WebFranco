// Prueba de integración de la Fase 3: materias, grupos e inscripción por código (npm test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, crearUsuario, limpiarPrueba, nombre } from './ayuda.js';
import { codigoInscripcion, CODIGO_VALIDO } from '../server/services/codigos.js';

const DOC = nombre('doc');
const OTRO = nombre('otro');
const ALU = nombre('alu');
let pedir, cookieDe, cerrar, doc, otro, alu;

before(async () => {
  ({ pedir, cookieDe, cerrar } = await arrancar());
  for (const [n, rol] of [[DOC, 'DOCENTE'], [OTRO, 'DOCENTE'], [ALU, 'ALUMNO']]) await crearUsuario(n, rol);
  [doc, otro, alu] = await Promise.all([cookieDe(DOC), cookieDe(OTRO), cookieDe(ALU)]);
});

after(async () => {
  cerrar();
  await limpiarPrueba();
});

test('el código de inscripción tiene 6 caracteres sin ambiguos (RF-08)', () => {
  for (let i = 0; i < 2000; i++) assert.match(codigoInscripcion(), CODIGO_VALIDO);
});

let materia, grupo;

test('el docente crea materias y grupos con código (RF-07, RF-08)', async () => {
  assert.equal((await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: '  ' } })).estado, 400);
  materia = (await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: 'Cálculo integral' } })).cuerpo.data;
  const r = await pedir('POST', '/api/docente/grupos', { cookie: doc, datos: { materia_id: materia.id, nombre: '3A' } });
  assert.equal(r.estado, 201);
  grupo = r.cuerpo.data;
  assert.match(grupo.codigo, CODIGO_VALIDO);
  const lista = (await pedir('GET', '/api/docente/materias', { cookie: doc })).cuerpo.data;
  assert.deepEqual(lista.map((m) => [m.nombre, m.grupos.map((g) => g.codigo)]), [['Cálculo integral', [grupo.codigo]]]);
});

test('un docente no ve ni modifica lo de otro (RF-45, RNF-05)', async () => {
  assert.deepEqual((await pedir('GET', '/api/docente/materias', { cookie: otro })).cuerpo.data, []);
  assert.equal((await pedir('POST', '/api/docente/grupos', { cookie: otro, datos: { materia_id: materia.id, nombre: 'X' } })).estado, 404);
  assert.equal((await pedir('PATCH', `/api/docente/grupos/${grupo.id}`, { cookie: otro, datos: { activo: false } })).estado, 404);
  assert.equal((await pedir('GET', `/api/docente/grupos/${grupo.id}/alumnos`, { cookie: otro })).estado, 404);
  assert.equal((await pedir('DELETE', `/api/docente/materias/${materia.id}`, { cookie: otro })).estado, 409);
  assert.equal((await pedir('GET', '/api/docente/materias', { cookie: alu })).estado, 403, 'un alumno no entra a la API del docente');
  assert.equal((await pedir('GET', '/api/alumno/grupos', { cookie: doc })).estado, 403, 'un docente no entra a la API del alumno');
});

test('el alumno se inscribe con el código (RF-09, CU-20)', async () => {
  assert.equal((await pedir('POST', '/api/alumno/inscripciones', { cookie: alu, datos: { codigo: 'ZZZZZZ' } })).estado, 404);
  const codigoEscrito = ` ${grupo.codigo.toLowerCase().slice(0, 3)} ${grupo.codigo.toLowerCase().slice(3)} `;
  const r = await pedir('POST', '/api/alumno/inscripciones', { cookie: alu, datos: { codigo: codigoEscrito } });
  assert.equal(r.estado, 201, 'acepta minúsculas y espacios');
  assert.equal(r.cuerpo.data.materia, 'Cálculo integral');
  const repetida = await pedir('POST', '/api/alumno/inscripciones', { cookie: alu, datos: { codigo: grupo.codigo } });
  assert.equal(repetida.estado, 409);
  assert.match(repetida.cuerpo.error, /Ya estás inscrito/);

  const mis = (await pedir('GET', '/api/alumno/grupos', { cookie: alu })).cuerpo.data;
  assert.deepEqual(mis.map((g) => [g.materia, g.grupo, g.docente]), [['Cálculo integral', '3A', DOC]]);
  const alumnos = (await pedir('GET', `/api/docente/grupos/${grupo.id}/alumnos`, { cookie: doc })).cuerpo.data;
  assert.deepEqual(alumnos.map((a) => a.nombre_usuario), [ALU]);
  const lista = (await pedir('GET', '/api/docente/materias', { cookie: doc })).cuerpo.data;
  assert.equal(lista[0].grupos[0].alumnos, 1);
});

test('un grupo inactivo no acepta inscripciones y una materia con grupos no se elimina', async () => {
  const g2 = (await pedir('POST', '/api/docente/grupos', { cookie: doc, datos: { materia_id: materia.id, nombre: '3B' } })).cuerpo.data;
  assert.equal((await pedir('PATCH', `/api/docente/grupos/${g2.id}`, { cookie: doc, datos: { activo: false } })).estado, 200);
  assert.equal((await pedir('POST', '/api/alumno/inscripciones', { cookie: alu, datos: { codigo: g2.codigo } })).estado, 404);

  assert.equal((await pedir('DELETE', `/api/docente/materias/${materia.id}`, { cookie: doc })).estado, 409);
  const vacia = (await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: 'Temporal' } })).cuerpo.data;
  assert.equal((await pedir('DELETE', `/api/docente/materias/${vacia.id}`, { cookie: doc })).estado, 200);
});

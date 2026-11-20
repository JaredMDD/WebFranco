// Prueba de la Fase 9: el servidor se cae a mitad de un examen y vuelve (npm test). RNF-13.
// El servidor corre en otro proceso y se mata sin aviso, como un corte de luz.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cliente, crearUsuario, limpiarPrueba, nombre } from './ayuda.js';

const PUERTO = 40000 + Math.floor(Math.random() * 20000);
const { pedir, cookieDe } = cliente(`http://127.0.0.1:${PUERTO}`);
let proceso;

async function levantar() {
  proceso = spawn(process.execPath, ['--env-file-if-exists=.env', 'server/app.js'], {
    env: { ...process.env, PORT: String(PUERTO) }, stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await pedir('GET', '/api/salud')).estado === 200) return; } catch { /* aún no escucha */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('el servidor no arrancó');
}

async function matar() {
  const salida = new Promise((r) => proceso.once('exit', r));
  proceso.kill('SIGKILL');
  await salida;
}

after(async () => {
  if (proceso?.exitCode === null) await matar();
  await limpiarPrueba();
});

test('tras una caída a mitad del examen se conserva lo guardado y se continúa donde iba (RNF-13)', async () => {
  const DOC = nombre('doc');
  const ALU = nombre('alu');
  await crearUsuario(DOC, 'DOCENTE');
  await crearUsuario(ALU, 'ALUMNO');
  await levantar();
  const [doc, alu] = [await cookieDe(DOC), await cookieDe(ALU)];

  const m = (await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: 'Química' } })).cuerpo.data;
  const g = (await pedir('POST', '/api/docente/grupos', { cookie: doc, datos: { materia_id: m.id, nombre: '2B' } })).cuerpo.data;
  await pedir('POST', '/api/alumno/inscripciones', { cookie: alu, datos: { codigo: g.codigo } });
  const horas = (h) => new Date(Date.now() + h * 3600_000).toISOString();
  const examen = (await pedir('POST', '/api/docente/examenes', { cookie: doc, datos: {
    titulo: 'Caída', abre_en: horas(-1), cierra_en: horas(24), duracion_min: 30, umbral_inactividad_min: 3, grupos: [g.id], programar: true,
    preguntas: [1, 2, 3].map((n) => ({ tipo: 'ABIERTA', enunciado: `Pregunta ${n}`, puntos: 1 })),
  } })).cuerpo.data;
  const intento = (await pedir('POST', `/api/alumno/examenes/${examen.id}/iniciar`, { cookie: alu, datos: { acepto: true } })).cuerpo.data.intento_id;
  const ruta = `/api/alumno/intentos/${intento}`;

  // Responde la primera, avanza, y deja guardada (sin avanzar) la segunda.
  let e = (await pedir('GET', ruta, { cookie: alu })).cuerpo.data;
  assert.equal((await pedir('POST', `${ruta}/avanzar`, { cookie: alu, datos: { pregunta_id: e.pregunta.id, texto: 'primera' } })).estado, 200);
  e = (await pedir('GET', ruta, { cookie: alu })).cuerpo.data;
  const segunda = e.pregunta.id;
  assert.equal((await pedir('PUT', `${ruta}/respuesta`, { cookie: alu, datos: { pregunta_id: segunda, texto: 'a medio escribir' } })).estado, 200);
  const restanteAntes = e.restante_ms;

  await matar();
  await levantar();

  e = (await pedir('GET', ruta, { cookie: alu })).cuerpo.data;
  assert.equal(e.estado ?? 'EN_CURSO', 'EN_CURSO');
  assert.equal(e.posicion, 1, 'sigue en la segunda pregunta');
  assert.equal(e.pregunta.id, segunda);
  assert.equal(e.respuesta.texto, 'a medio escribir', 'el autoguardado sobrevivió');
  assert.ok(e.restante_ms <= restanteAntes, 'el reloj del servidor siguió corriendo');
  assert.equal((await pedir('POST', `${ruta}/avanzar`, { cookie: alu, datos: { pregunta_id: segunda, texto: 'terminada' } })).estado, 200, 'puede continuar');
});

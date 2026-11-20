// Prueba de la Fase 5: presentación del examen por el alumno (npm test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, crearUsuario, limpiarPrueba, nombre, pool } from './ayuda.js';
import { barajar } from '../server/services/aleatorio.js';

test('barajar es reproducible por semilla y siempre es una permutación (RF-19)', () => {
  const lista = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.deepEqual(barajar(lista, 12345), barajar(lista, 12345));
  assert.deepEqual([...barajar(lista, 12345)].sort((a, b) => a - b), lista);
  assert.notDeepEqual(barajar(lista, 12345), barajar(lista, 999));
  assert.deepEqual(lista, Array.from({ length: 20 }, (_, i) => i + 1), 'no modifica la original');
});

const DOC = nombre('doc');
const ALU = nombre('alu');
const ALU2 = nombre('alu2');
const AJENO = nombre('ajeno');
let pedir, cookieDe, cerrar, base, doc, alu, alu2, ajeno;
let examenId, imagen, examenFuturoId;
const horas = (h) => new Date(Date.now() + h * 3600_000).toISOString();

before(async () => {
  ({ pedir, cookieDe, cerrar, base } = await arrancar());
  for (const [n, rol] of [[DOC, 'DOCENTE'], [ALU, 'ALUMNO'], [ALU2, 'ALUMNO'], [AJENO, 'ALUMNO']]) await crearUsuario(n, rol);
  [doc, alu, alu2, ajeno] = await Promise.all([DOC, ALU, ALU2, AJENO].map(cookieDe));
  const m = (await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: 'Física' } })).cuerpo.data;
  const g = (await pedir('POST', '/api/docente/grupos', { cookie: doc, datos: { materia_id: m.id, nombre: '1A' } })).cuerpo.data;
  for (const c of [alu, alu2]) await pedir('POST', '/api/alumno/inscripciones', { cookie: c, datos: { codigo: g.codigo } });

  const datos = new FormData();
  datos.append('imagen', new Blob([Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])]), 'f.png');
  imagen = (await (await fetch(`${base}/api/imagenes`, { method: 'POST', headers: { Cookie: doc }, body: datos })).json()).data.ruta;

  const alumnoId = (await pool.query('SELECT id FROM usuario WHERE nombre_usuario = $1', [ALU])).rows[0].id;
  const examen = {
    titulo: 'Quiz', abre_en: horas(-1), cierra_en: horas(48), duracion_min: 30, umbral_inactividad_min: 3, grupos: [g.id], programar: true,
    tiempos_extra: [{ alumno_id: alumnoId, minutos: 10 }],
    preguntas: [
      { tipo: 'OPCION_MULTIPLE', enunciado: '¿2+2?', puntos: 2, opciones: ['3', '4', '5', '6'].map((t) => ({ texto: t, es_correcta: t === '4' })) },
      { tipo: 'VERDADERO_FALSO', enunciado: 'El sol es una estrella', puntos: 1, correcta: true },
      { tipo: 'ABIERTA', enunciado: 'Explica', puntos: 2, imagen_ruta: imagen },
    ],
  };
  const r = await pedir('POST', '/api/docente/examenes', { cookie: doc, datos: examen });
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  examenId = r.cuerpo.data.id;
  examenFuturoId = (await pedir('POST', '/api/docente/examenes', { cookie: doc, datos: { ...examen, titulo: 'Futuro', abre_en: horas(24), tiempos_extra: [] } })).cuerpo.data.id;
});

after(async () => {
  cerrar();
  await limpiarPrueba();
});

test('el alumno ve solo los exámenes asignados a sus grupos (RF-20)', async () => {
  const lista = (await pedir('GET', '/api/alumno/examenes', { cookie: alu })).cuerpo.data;
  const quiz = lista.find((e) => e.id === examenId);
  assert.equal(quiz.disponibilidad, 'ABIERTO');
  assert.equal(quiz.tiempo_extra, 10);
  assert.equal(quiz.materia, 'Física');
  assert.equal(lista.find((e) => e.id === examenFuturoId).disponibilidad, 'PENDIENTE');
  assert.deepEqual((await pedir('GET', '/api/alumno/examenes', { cookie: ajeno })).cuerpo.data, []);
  assert.equal((await pedir('GET', `/api/alumno/examenes/${examenId}`, { cookie: ajeno })).estado, 404);
  assert.equal((await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: ajeno, datos: { acepto: true } })).estado, 404);
  assert.equal((await pedir('POST', `/api/alumno/examenes/${examenFuturoId}/iniciar`, { cookie: alu, datos: { acepto: true } })).estado, 409, 'fuera de ventana');
});

let intentoId;

test('iniciar exige aceptar las reglas y crea un solo intento (RF-21, RF-22, RF-32)', async () => {
  assert.equal((await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: alu, datos: {} })).estado, 400);
  const r = await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: alu, datos: { acepto: true } });
  assert.equal(r.estado, 201);
  intentoId = r.cuerpo.data.intento_id;
  const otra = await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: alu, datos: { acepto: true } });
  assert.equal(otra.cuerpo.data.intento_id, intentoId, 'un intento abierto se retoma');
  const { rows: [i] } = await pool.query('SELECT tiempo_extra_min, ip_inicio, estado FROM intento WHERE id = $1', [intentoId]);
  assert.equal(i.tiempo_extra_min, 10);
  assert.ok(i.ip_inicio);
  assert.equal(i.estado, 'EN_CURSO');
});

test('la pregunta llega sin respuesta correcta y con el tiempo del servidor (RNF-07, RF-25)', async () => {
  const r = await pedir('GET', `/api/alumno/intentos/${intentoId}`, { cookie: alu });
  const e = r.cuerpo.data;
  assert.equal(e.posicion, 0);
  assert.equal(e.total, 3);
  assert.ok(e.restante_ms > 39 * 60_000 && e.restante_ms <= 40 * 60_000, `restante ${e.restante_ms}`); // 30 + 10 extra
  assert.doesNotMatch(JSON.stringify(r.cuerpo), /es_correcta|correcta"/);
  for (const o of e.pregunta.opciones) assert.deepEqual(Object.keys(o).sort(), ['id', 'texto']);
  assert.equal((await pedir('GET', `/api/alumno/intentos/${intentoId}`, { cookie: alu2 })).estado, 404, 'intento ajeno');
});

// Responde correctamente la pregunta que toque, según su tipo.
async function responderBien(e) {
  const p = e.pregunta;
  if (p.tipo === 'OPCION_MULTIPLE') return { opcion_id: p.opciones.find((o) => o.texto === '4').id };
  if (p.tipo === 'VERDADERO_FALSO') return { opcion_id: p.opciones.find((o) => o.texto === 'Verdadero').id };
  return { texto: 'Fuerza = masa × aceleración' };
}

test('solo se responde la pregunta actual, con autoguardado, y se avanza en orden (RF-23, RF-24)', async () => {
  const ruta = `/api/alumno/intentos/${intentoId}`;
  let e = (await pedir('GET', ruta, { cookie: alu })).cuerpo.data;
  const otraPregunta = (await pool.query('SELECT id FROM pregunta WHERE examen_id = $1 AND id <> $2 LIMIT 1', [examenId, e.pregunta.id])).rows[0].id;
  assert.equal((await pedir('PUT', `${ruta}/respuesta`, { cookie: alu, datos: { pregunta_id: otraPregunta, texto: 'x', opcion_id: null } })).estado, 409);

  // autoguardado dos veces: una sola fila (upsert)
  const ajenaOpcion = (await pool.query('SELECT o.id FROM opcion o JOIN pregunta p ON p.id = o.pregunta_id WHERE p.examen_id = $1 AND p.id <> $2 LIMIT 1', [examenId, e.pregunta.id])).rows[0]?.id;
  if (e.pregunta.tipo !== 'ABIERTA' && ajenaOpcion) {
    assert.equal((await pedir('PUT', `${ruta}/respuesta`, { cookie: alu, datos: { pregunta_id: e.pregunta.id, opcion_id: ajenaOpcion } })).estado, 400);
  }
  const primera = e.pregunta.tipo === 'ABIERTA' ? { texto: 'borrador' } : { opcion_id: e.pregunta.opciones[0].id };
  assert.equal((await pedir('PUT', `${ruta}/respuesta`, { cookie: alu, datos: { pregunta_id: e.pregunta.id, ...primera } })).estado, 200);
  assert.equal((await pedir('PUT', `${ruta}/respuesta`, { cookie: alu, datos: { pregunta_id: e.pregunta.id, ...(await responderBien(e)) } })).estado, 200);
  assert.equal((await pool.query('SELECT count(*)::int n FROM respuesta WHERE intento_id = $1', [intentoId])).rows[0].n, 1);
  assert.deepEqual((await pedir('GET', ruta, { cookie: alu })).cuerpo.data.respuesta !== null, true, 'la respuesta guardada vuelve al recargar');

  // el alumno con intento abierto ve la imagen del examen
  assert.equal((await fetch(`${base}/api/imagenes/${imagen}`, { headers: { Cookie: alu } })).status, 200);
  assert.equal((await fetch(`${base}/api/imagenes/${imagen}`, { headers: { Cookie: ajeno } })).status, 404);

  const vistas = [];
  for (let paso = 0; paso < 3; paso++) {
    e = (await pedir('GET', ruta, { cookie: alu })).cuerpo.data;
    assert.equal(e.posicion, paso);
    vistas.push(e.pregunta.id);
    const r = await pedir('POST', `${ruta}/avanzar`, { cookie: alu, datos: { pregunta_id: e.pregunta.id, ...(await responderBien(e)) } });
    assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
    // repetir el mismo avance (doble clic) no salta otra pregunta
    if (paso === 0) assert.equal((await pedir('POST', `${ruta}/avanzar`, { cookie: alu, datos: { pregunta_id: e.pregunta.id } })).estado, 409);
    if (paso === 2) assert.equal(r.cuerpo.data.estado, 'ENVIADO');
  }
  assert.equal(new Set(vistas).size, 3, 'vio las 3 preguntas, cada una una vez');
});

test('al enviar se califica automáticamente y el intento queda cerrado (RF-38, RF-22)', async () => {
  const { rows: [i] } = await pool.query('SELECT estado, calificacion::float AS c, fin_en FROM intento WHERE id = $1', [intentoId]);
  assert.equal(i.estado, 'ENVIADO');
  assert.equal(i.c, 6, 'cerradas correctas 3 de 5 puntos → 6.0; la abierta espera calificación manual');
  assert.ok(i.fin_en);
  const ruta = `/api/alumno/intentos/${intentoId}`;
  assert.equal((await pedir('GET', ruta, { cookie: alu })).cuerpo.data.estado, 'ENVIADO');
  const tarde = await pedir('PUT', `${ruta}/respuesta`, { cookie: alu, datos: { pregunta_id: 1, texto: 'x' } });
  assert.equal(tarde.estado, 409);
  assert.equal(tarde.cuerpo.estado, 'ENVIADO');
  assert.equal((await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: alu, datos: { acepto: true } })).estado, 409, 'una sola oportunidad');
  assert.equal((await fetch(`${base}/api/imagenes/${imagen}`, { headers: { Cookie: alu } })).status, 404, 'sin intento abierto ya no ve la imagen');
  const lista = (await pedir('GET', '/api/alumno/examenes', { cookie: alu })).cuerpo.data;
  const quiz = lista.find((e) => e.id === examenId);
  assert.equal(quiz.intento_estado, 'ENVIADO');
  assert.equal(quiz.calificacion, null, 'no se muestra hasta que el docente publique');
});

test('al agotarse el tiempo el servidor cierra el intento y rechaza respuestas (RF-26)', async () => {
  const r = await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: alu2, datos: { acepto: true } });
  const id = r.cuerpo.data.intento_id;
  const e = (await pedir('GET', `/api/alumno/intentos/${id}`, { cookie: alu2 })).cuerpo.data;
  await pool.query("UPDATE intento SET inicio_en = now() - interval '31 minutes' WHERE id = $1", [id]); // sin tiempo extra: 30 min
  const tarde = await pedir('PUT', `/api/alumno/intentos/${id}/respuesta`, { cookie: alu2, datos: { pregunta_id: e.pregunta.id, texto: 'x' } });
  assert.equal(tarde.estado, 409);
  assert.equal(tarde.cuerpo.tiempo_agotado, true);
  const despues = (await pedir('GET', `/api/alumno/intentos/${id}`, { cookie: alu2 })).cuerpo.data;
  assert.equal(despues.estado, 'ENVIADO');
});

test('el docente ya no puede modificar un examen iniciado', async () => {
  assert.equal((await pedir('PUT', `/api/docente/examenes/${examenId}`, { cookie: doc, datos: { titulo: 'Cambio' } })).estado, 409);
});

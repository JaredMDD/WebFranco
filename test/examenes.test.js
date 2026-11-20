// Prueba de la Fase 4: validación del examen (unitaria) y API de exámenes e imágenes (integración).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, crearUsuario, limpiarPrueba, nombre, pool } from './ayuda.js';
import { validarExamen } from '../server/services/examenes.js';

const futuro = (horas) => new Date(Date.now() + horas * 3600_000).toISOString();
const mc = (correcta = 0) => ({ tipo: 'OPCION_MULTIPLE', enunciado: '¿2+2?', puntos: 1, opciones: ['3', '4', '5'].map((t, i) => ({ texto: t, es_correcta: i === correcta })) });

test('validarExamen: un borrador solo exige título; programar exige todo (RF-14, RF-15)', () => {
  assert.deepEqual(validarExamen({ titulo: 'Parcial' }, { docenteId: 1 }).errores, []);
  assert.ok(validarExamen({ titulo: ' ' }, { docenteId: 1 }).errores.length);
  const { errores } = validarExamen({ titulo: 'Parcial' }, { programar: true, docenteId: 1 });
  assert.equal(errores.length, 4, errores.join(' | ')); // preguntas, ventana, duración, grupos
  const listo = { titulo: 'P', abre_en: futuro(1), cierra_en: futuro(48), duracion_min: 60, grupos: [1], preguntas: [mc()] };
  assert.deepEqual(validarExamen(listo, { programar: true, docenteId: 1 }).errores, []);
  assert.ok(validarExamen({ ...listo, cierra_en: listo.abre_en }, { docenteId: 1 }).errores.some((e) => /posterior/.test(e)));
  assert.ok(validarExamen({ ...listo, abre_en: futuro(-48), cierra_en: futuro(-1) }, { programar: true, docenteId: 1 }).errores.some((e) => /futura/.test(e)));
});

test('validarExamen: reglas por tipo de pregunta (RF-12)', () => {
  const errores = (p) => validarExamen({ titulo: 'P', preguntas: [p] }, { docenteId: 7 }).errores;
  assert.deepEqual(errores(mc()), []);
  assert.ok(errores({ ...mc(), opciones: mc().opciones.map((o) => ({ ...o, es_correcta: false })) }).length, 'sin correcta');
  assert.ok(errores({ ...mc(), opciones: mc().opciones.map((o) => ({ ...o, es_correcta: true })) }).length, 'varias correctas');
  assert.ok(errores({ ...mc(), opciones: [{ texto: 'solo', es_correcta: true }] }).length, 'una sola opción');
  assert.ok(errores({ tipo: 'VERDADERO_FALSO', enunciado: 'x', puntos: 1 }).length, 'V/F sin respuesta');
  const vf = validarExamen({ titulo: 'P', preguntas: [{ tipo: 'VERDADERO_FALSO', enunciado: 'x', puntos: 1, correcta: false }] }, { docenteId: 7 });
  assert.deepEqual(vf.datos.preguntas[0].opciones, [{ texto: 'Verdadero', es_correcta: false }, { texto: 'Falso', es_correcta: true }]);
  assert.deepEqual(errores({ tipo: 'ABIERTA', enunciado: 'Explica', puntos: 3 }), []);
  assert.ok(errores({ tipo: 'ABIERTA', enunciado: 'x', puntos: 1, imagen_ruta: '8-0123456789abcdef.png' }).length, 'imagen de otro docente');
  assert.deepEqual(errores({ tipo: 'ABIERTA', enunciado: 'x', puntos: 1, imagen_ruta: '7-0123456789abcdef.png' }), []);
});

// --- Integración ---
const DOC = nombre('doc');
const OTRO = nombre('otro');
const ALU = nombre('alu');
const AJENO = nombre('ajeno');
let pedir, cookieDe, cerrar, doc, otro, alu, base;
let grupo, grupoOtro;

before(async () => {
  ({ pedir, cookieDe, cerrar, base } = await arrancar());
  for (const [n, rol] of [[DOC, 'DOCENTE'], [OTRO, 'DOCENTE'], [ALU, 'ALUMNO'], [AJENO, 'ALUMNO']]) await crearUsuario(n, rol);
  [doc, otro, alu] = await Promise.all([cookieDe(DOC), cookieDe(OTRO), cookieDe(ALU)]);
  const m = (await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: 'Física' } })).cuerpo.data;
  grupo = (await pedir('POST', '/api/docente/grupos', { cookie: doc, datos: { materia_id: m.id, nombre: '1A' } })).cuerpo.data;
  const mo = (await pedir('POST', '/api/docente/materias', { cookie: otro, datos: { nombre: 'Química' } })).cuerpo.data;
  grupoOtro = (await pedir('POST', '/api/docente/grupos', { cookie: otro, datos: { materia_id: mo.id, nombre: '2B' } })).cuerpo.data;
  await pedir('POST', '/api/alumno/inscripciones', { cookie: alu, datos: { codigo: grupo.codigo } });
});

after(async () => {
  cerrar();
  await limpiarPrueba();
});

const examenCompleto = (extra = {}) => ({
  titulo: 'Quiz 1', instrucciones: 'Suerte', abre_en: futuro(1), cierra_en: futuro(72), duracion_min: 30,
  umbral_inactividad_min: 4, mostrar_respuestas: true, grupos: [grupo.id],
  preguntas: [mc(1), { tipo: 'VERDADERO_FALSO', enunciado: 'El agua hierve a 100 °C', puntos: 1, correcta: true }, { tipo: 'ABIERTA', enunciado: 'Explica', puntos: 3 }],
  ...extra,
});

let examenId;

test('el docente guarda un borrador y luego lo programa (CU-08 a CU-10)', async () => {
  const borrador = await pedir('POST', '/api/docente/examenes', { cookie: doc, datos: { titulo: 'Quiz 1' } });
  assert.equal(borrador.estado, 201);
  assert.equal(borrador.cuerpo.data.estado, 'BORRADOR');
  examenId = borrador.cuerpo.data.id;

  const incompleto = await pedir('PUT', `/api/docente/examenes/${examenId}`, { cookie: doc, datos: { titulo: 'Quiz 1', programar: true } });
  assert.equal(incompleto.estado, 400);
  assert.equal(incompleto.cuerpo.detalles.length, 4);

  const ok = await pedir('PUT', `/api/docente/examenes/${examenId}`, { cookie: doc, datos: { ...examenCompleto(), programar: true } });
  assert.equal(ok.estado, 200, JSON.stringify(ok.cuerpo));
  assert.equal(ok.cuerpo.data.estado, 'PROGRAMADO');

  const e = (await pedir('GET', `/api/docente/examenes/${examenId}`, { cookie: doc })).cuerpo.data;
  assert.equal(e.umbral_inactividad_min, 4);
  assert.deepEqual(e.grupos, [Number(grupo.id)]);
  assert.deepEqual(e.preguntas.map((p) => p.tipo), ['OPCION_MULTIPLE', 'VERDADERO_FALSO', 'ABIERTA']);
  assert.equal(e.preguntas[0].opciones.find((o) => o.es_correcta).texto, '4');
  assert.equal(e.preguntas[1].correcta, true);
  assert.equal(e.bloqueado, false);

  const lista = (await pedir('GET', '/api/docente/examenes', { cookie: doc })).cuerpo.data;
  assert.equal(lista[0].preguntas, 3);
  assert.equal(lista[0].grupos, '1A');
  const { rows } = await pool.query("SELECT accion FROM bitacora_auditoria WHERE entidad = 'examen' AND entidad_id = $1", [examenId]);
  assert.deepEqual(rows.map((r) => r.accion), ['PROGRAMAR_EXAMEN']);
});

test('grupos y tiempo extra se validan contra los datos del docente (RF-10, RF-16)', async () => {
  const conGrupoAjeno = await pedir('PUT', `/api/docente/examenes/${examenId}`, { cookie: doc, datos: examenCompleto({ grupos: [grupo.id, grupoOtro.id] }) });
  assert.equal(conGrupoAjeno.estado, 400);
  const ajeno = (await pool.query('SELECT id FROM usuario WHERE nombre_usuario = $1', [AJENO])).rows[0].id;
  const alumno = (await pool.query('SELECT id FROM usuario WHERE nombre_usuario = $1', [ALU])).rows[0].id;
  assert.equal((await pedir('PUT', `/api/docente/examenes/${examenId}`, { cookie: doc, datos: examenCompleto({ tiempos_extra: [{ alumno_id: Number(ajeno), minutos: 10 }] }) })).estado, 400);
  assert.equal((await pedir('PUT', `/api/docente/examenes/${examenId}`, { cookie: doc, datos: examenCompleto({ tiempos_extra: [{ alumno_id: Number(alumno), minutos: 15 }] }) })).estado, 200);
  const e = (await pedir('GET', `/api/docente/examenes/${examenId}`, { cookie: doc })).cuerpo.data;
  assert.deepEqual(e.tiempos_extra.map((t) => [t.nombre_usuario, t.minutos]), [[ALU, 15]]);
});

test('un docente no ve, edita ni elimina exámenes de otro (RF-45)', async () => {
  assert.equal((await pedir('GET', `/api/docente/examenes/${examenId}`, { cookie: otro })).estado, 404);
  assert.equal((await pedir('PUT', `/api/docente/examenes/${examenId}`, { cookie: otro, datos: examenCompleto({ grupos: [] }) })).estado, 404);
  assert.equal((await pedir('DELETE', `/api/docente/examenes/${examenId}`, { cookie: otro })).estado, 409);
  assert.deepEqual((await pedir('GET', '/api/docente/examenes', { cookie: otro })).cuerpo.data, []);
  assert.equal((await pedir('GET', '/api/docente/examenes', { cookie: alu })).estado, 403);
});

test('un examen ya iniciado no se modifica ni se elimina', async () => {
  const alumno = (await pool.query('SELECT id FROM usuario WHERE nombre_usuario = $1', [ALU])).rows[0].id;
  await pool.query("INSERT INTO intento (examen_id, alumno_id, semilla_aleatoria, ip_inicio) VALUES ($1, $2, 1, '127.0.0.1')", [examenId, alumno]);
  assert.equal((await pedir('GET', `/api/docente/examenes/${examenId}`, { cookie: doc })).cuerpo.data.bloqueado, true);
  assert.equal((await pedir('PUT', `/api/docente/examenes/${examenId}`, { cookie: doc, datos: examenCompleto() })).estado, 409);
  assert.equal((await pedir('DELETE', `/api/docente/examenes/${examenId}`, { cookie: doc })).estado, 409);

  const libre = (await pedir('POST', '/api/docente/examenes', { cookie: doc, datos: { titulo: 'Borrar' } })).cuerpo.data;
  assert.equal((await pedir('DELETE', `/api/docente/examenes/${libre.id}`, { cookie: doc })).estado, 200);
});

test('imágenes: solo PNG/JPG reales, solo el docente dueño las ve (RF-13)', async () => {
  const subir = (cookie, bytes, nombreArchivo) => {
    const datos = new FormData();
    datos.append('imagen', new Blob([bytes]), nombreArchivo);
    return fetch(`${base}/api/imagenes`, { method: 'POST', headers: { Cookie: cookie }, body: datos });
  };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const r = await subir(doc, png, 'figura.png');
  assert.equal(r.status, 201);
  const { ruta } = (await r.json()).data;
  assert.match(ruta, /^\d+-[a-f0-9]{16}\.png$/);

  const ver = await fetch(`${base}/api/imagenes/${ruta}`, { headers: { Cookie: doc } });
  assert.equal(ver.status, 200);
  assert.equal(ver.headers.get('content-type'), 'image/png');
  assert.equal((await fetch(`${base}/api/imagenes/${ruta}`, { headers: { Cookie: otro } })).status, 404);
  assert.equal((await fetch(`${base}/api/imagenes/${ruta}`)).status, 401);

  assert.equal((await subir(doc, Buffer.from('<script>alert(1)</script>'), 'falsa.png')).status, 400, 'contenido que no es imagen');
  assert.equal((await subir(alu, png, 'figura.png')).status, 403, 'un alumno no sube imágenes');
});

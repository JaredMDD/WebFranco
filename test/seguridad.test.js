// Prueba de la Fase 6: incidentes, anulación, abandono por desconexión y purga de evidencias (npm test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as esperar } from 'node:timers/promises';
import { arrancar, crearUsuario, limpiarPrueba, nombre, pool } from './ayuda.js';
import { purgarIncidentesVencidos } from '../server/services/incidentes.js';

const TOLERANCIA = 800;
const ALUMNOS = ['pestana', 'tiempo', 'duplicada', 'socket', 'ausente', 'inactivo'];
let pedir, entrar, cookieDe, cerrar, base, doc, examenId;
const c = {}; // cookie por alumno
const horas = (h) => new Date(Date.now() + h * 3600_000).toISOString();

before(async () => {
  ({ pedir, entrar, cookieDe, cerrar, base } = await arrancar({ sockets: { toleranciaMs: TOLERANCIA } }));
  await crearUsuario(nombre('doc'), 'DOCENTE');
  await crearUsuario(nombre('adm'), 'ADMIN');
  for (const a of ALUMNOS) await crearUsuario(nombre(a), 'ALUMNO');
  doc = await cookieDe(nombre('doc'));
  for (const a of ALUMNOS) c[a] = await cookieDe(nombre(a));
  const m = (await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: 'Química' } })).cuerpo.data;
  const g = (await pedir('POST', '/api/docente/grupos', { cookie: doc, datos: { materia_id: m.id, nombre: '2B' } })).cuerpo.data;
  for (const a of ALUMNOS) await pedir('POST', '/api/alumno/inscripciones', { cookie: c[a], datos: { codigo: g.codigo } });
  const r = await pedir('POST', '/api/docente/examenes', { cookie: doc, datos: {
    titulo: 'Quiz seguro', abre_en: horas(-1), cierra_en: horas(48), duracion_min: 30, umbral_inactividad_min: 3, grupos: [g.id], programar: true,
    preguntas: [1, 2].map((n) => ({ tipo: 'VERDADERO_FALSO', enunciado: `Afirmación ${n}`, puntos: 1, correcta: true })),
  } });
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  examenId = r.cuerpo.data.id;
});

after(async () => {
  cerrar();
  await limpiarPrueba();
});

const iniciar = async (a) => (await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: c[a], datos: { acepto: true } })).cuerpo.data.intento_id;
const estadoDe = async (id) => (await pool.query('SELECT estado FROM intento WHERE id = $1', [id])).rows[0].estado;
const incidentes = async (id) => (await pool.query('SELECT tipo, ip, dispositivo, expira_en - ocurrio_en AS retencion FROM incidente WHERE intento_id = $1', [id])).rows;

let intentoPestana;
test('cambio de pestaña: registra evidencia, anula y bloquea el intento (RF-30, RF-36, RF-28)', async () => {
  intentoPestana = await iniciar('pestana');
  const p = (await pedir('GET', `/api/alumno/intentos/${intentoPestana}`, { cookie: c.pestana })).cuerpo.data;
  const verdadero = p.pregunta.opciones.find((o) => o.texto === 'Verdadero').id;
  await pedir('PUT', `/api/alumno/intentos/${intentoPestana}/respuesta`, { cookie: c.pestana, datos: { pregunta_id: p.pregunta.id, opcion_id: verdadero } });

  const url = `/api/alumno/intentos/${intentoPestana}/incidente`;
  assert.equal((await pedir('POST', url, { cookie: c.pestana, datos: { tipo: 'CONEXION_PERDIDA' } })).estado, 400, 'el navegador no reporta tipos del servidor');
  assert.equal((await pedir('POST', url, { cookie: c.tiempo, datos: { tipo: 'CAMBIO_PESTANA' } })).estado, 404, 'intento ajeno');
  assert.deepEqual((await pedir('POST', url, { cookie: c.pestana, datos: { tipo: 'CAMBIO_PESTANA' } })).cuerpo.data, { estado: 'ANULADO', registrado: true });
  assert.deepEqual((await pedir('POST', url, { cookie: c.pestana, datos: { tipo: 'INACTIVIDAD' } })).cuerpo.data, { estado: 'ANULADO', registrado: false }, 'un solo incidente');

  const lista = await incidentes(intentoPestana);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].tipo, 'CAMBIO_PESTANA');
  assert.ok(lista[0].ip && lista[0].dispositivo, 'IP y dispositivo como evidencia');
  assert.equal(lista[0].retencion.days, 7);

  const r = await pedir('PUT', `/api/alumno/intentos/${intentoPestana}/respuesta`, { cookie: c.pestana, datos: { pregunta_id: p.pregunta.id, opcion_id: verdadero } });
  assert.equal(r.estado, 409);
  assert.equal(r.cuerpo.estado, 'ANULADO');
  assert.equal((await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: c.pestana, datos: { acepto: true } })).estado, 409, 'bloqueado hasta revisión');

  const bloqueo = (await pedir('GET', `/api/alumno/intentos/${intentoPestana}`, { cookie: c.pestana })).cuerpo.data;
  assert.equal(bloqueo.estado, 'ANULADO');
  assert.equal(bloqueo.incidente.tipo, 'CAMBIO_PESTANA');
  assert.equal(bloqueo.respondidas, 1);
  assert.equal(bloqueo.total, 2);
  assert.equal(bloqueo.pregunta, undefined);
});

test('inactividad: anula igual que el cambio de pestaña y el administrador la ve en su panel (RF-31 · CU-05, CU-27)', async () => {
  const id = await iniciar('inactivo');
  const r = await pedir('POST', `/api/alumno/intentos/${id}/incidente`, { cookie: c.inactivo, datos: { tipo: 'INACTIVIDAD' } });
  assert.deepEqual(r.cuerpo.data, { estado: 'ANULADO', registrado: true });
  assert.equal(await estadoDe(id), 'ANULADO');

  const adm = await cookieDe(nombre('adm'));
  const estado = (await pedir('GET', '/api/admin/estado', { cookie: adm })).cuerpo.data;
  assert.ok(estado.incidentes_pendientes >= 1 && estado.docentes_activos >= 1 && estado.alumnos >= ALUMNOS.length);
  const feed = (await pedir('GET', '/api/admin/incidentes', { cookie: adm })).cuerpo.data;
  const visto = feed.find((x) => x.alumno === nombre('inactivo'));
  assert.ok(visto, 'el incidente aparece en el panel del administrador');
  assert.equal(visto.tipo, 'INACTIVIDAD');
  assert.equal(visto.decision, 'PENDIENTE');
  assert.equal(visto.docente, nombre('doc'));
});

test('un incidente con el tiempo ya agotado solo envía el examen, sin anularlo', async () => {
  const id = await iniciar('tiempo');
  await pool.query("UPDATE intento SET inicio_en = now() - interval '1 hour' WHERE id = $1", [id]);
  const r = await pedir('POST', `/api/alumno/intentos/${id}/incidente`, { cookie: c.tiempo, datos: { tipo: 'INACTIVIDAD' } });
  assert.deepEqual(r.cuerpo.data, { estado: 'ENVIADO', registrado: false });
  assert.deepEqual(await incidentes(id), []);
});

test('sesión duplicada durante el examen: anula el intento y cierra la sesión anterior (RF-34)', async () => {
  const id = await iniciar('duplicada');
  const nueva = await entrar(nombre('duplicada'));
  assert.equal(nueva.estado, 200);
  assert.equal(await estadoDe(id), 'ANULADO');
  assert.equal((await incidentes(id))[0].tipo, 'SESION_DUPLICADA');
  assert.equal((await pedir('GET', `/api/alumno/intentos/${id}`, { cookie: c.duplicada })).estado, 401, 'la sesión vieja ya no sirve');
  c.duplicada = nueva.cookie;
  assert.equal((await entrar(nombre('duplicada'))).estado, 200, 'sin examen abierto, volver a entrar no es incidente');
  assert.equal((await incidentes(id)).length, 1);
});

// Cliente Socket.IO mínimo sobre long-polling (protocolo Engine.IO v4), con la cookie de sesión.
async function socket(cookie, intento) {
  const url = `${base}/socket.io/?EIO=4&transport=polling`;
  const sid = JSON.parse((await (await fetch(url, { headers: { Cookie: cookie } })).text()).slice(1)).sid;
  const enviar = (paquete) => fetch(`${url}&sid=${sid}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'text/plain' }, body: paquete });
  await enviar(`40${JSON.stringify({ intento })}`);
  const respuesta = await (await fetch(`${url}&sid=${sid}`, { headers: { Cookie: cookie } })).text();
  return { respuesta, cerrar: () => enviar('1') };
}

test('socket: solo el alumno con el intento abierto; al desconectarse más que la tolerancia, ABANDONADO (RF-27)', async () => {
  assert.match((await socket('', 1)).respuesta, /^44.*sin-sesion/);
  assert.match((await socket(c.pestana, intentoPestana)).respuesta, /^44.*cerrado/, 'intento anulado');

  const id = await iniciar('socket');
  const s = await socket(c.socket, id);
  assert.match(s.respuesta, /^40/);
  await esperar(TOLERANCIA * 2);
  assert.equal(await estadoDe(id), 'EN_CURSO', 'conectado: no se abandona');
  await s.cerrar();
  await esperar(TOLERANCIA * 2);
  assert.equal(await estadoDe(id), 'ABANDONADO');
  assert.equal((await incidentes(id))[0].tipo, 'CONEXION_PERDIDA');
});

test('si la página del examen nunca se conecta tras iniciar, también se abandona', async () => {
  const id = await iniciar('ausente');
  await esperar(TOLERANCIA * 2);
  assert.equal(await estadoDe(id), 'ABANDONADO');
});

test('la purga borra evidencias vencidas sin tocar calificaciones (RF-37)', async () => {
  const antes = (await pool.query('SELECT calificacion FROM intento WHERE id = $1', [intentoPestana])).rows[0].calificacion;
  assert.equal(Number(antes), 5);
  await pool.query("INSERT INTO incidente (intento_id, tipo, ip, ocurrio_en, expira_en) VALUES ($1, 'INACTIVIDAD', '1.2.3.4', now() - interval '8 days', now() - interval '1 day')", [intentoPestana]);
  assert.ok(await purgarIncidentesVencidos() >= 1);
  assert.deepEqual((await incidentes(intentoPestana)).map((i) => i.tipo), ['CAMBIO_PESTANA'], 'la vigente se queda');
  assert.equal((await pool.query('SELECT calificacion FROM intento WHERE id = $1', [intentoPestana])).rows[0].calificacion, antes);
});

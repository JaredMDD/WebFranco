// Prueba de la Fase 7: revisión de incidentes, reabrir, calificación manual, publicación, resultados y reportes (npm test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, crearUsuario, limpiarPrueba, nombre, pool } from './ayuda.js';

let pedir, cookieDe, cerrar, base, doc, ajeno, examenId;
const c = {};
const intento = {};
const horas = (h) => new Date(Date.now() + h * 3600_000).toISOString();

// Responde todas las preguntas en orden: V/F con "Verdadero" y la abierta con texto.
async function presentar(cookie, id) {
  for (;;) {
    const p = (await pedir('GET', `/api/alumno/intentos/${id}`, { cookie })).cuerpo.data;
    if (p.estado !== 'EN_CURSO' && p.estado !== 'REABIERTO') return p;
    const datos = p.pregunta.tipo === 'ABIERTA'
      ? { pregunta_id: p.pregunta.id, texto: 'La energía se conserva.' }
      : { pregunta_id: p.pregunta.id, opcion_id: p.pregunta.opciones.find((o) => o.texto === 'Verdadero').id };
    const r = await pedir('POST', `/api/alumno/intentos/${id}/avanzar`, { cookie, datos });
    if (r.cuerpo.data.estado === 'ENVIADO') return r.cuerpo.data;
  }
}

before(async () => {
  ({ pedir, cookieDe, cerrar, base } = await arrancar());
  await crearUsuario(nombre('doc'), 'DOCENTE');
  await crearUsuario(nombre('ajeno'), 'DOCENTE');
  for (const a of ['envia', 'plagio', 'reabre', 'falta']) await crearUsuario(nombre(a), 'ALUMNO');
  [doc, ajeno] = [await cookieDe(nombre('doc')), await cookieDe(nombre('ajeno'))];
  for (const a of ['envia', 'plagio', 'reabre', 'falta']) c[a] = await cookieDe(nombre(a));
  const m = (await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: 'Física' } })).cuerpo.data;
  const g = (await pedir('POST', '/api/docente/grupos', { cookie: doc, datos: { materia_id: m.id, nombre: '3C' } })).cuerpo.data;
  for (const a of Object.keys(c)) await pedir('POST', '/api/alumno/inscripciones', { cookie: c[a], datos: { codigo: g.codigo } });
  const r = await pedir('POST', '/api/docente/examenes', { cookie: doc, datos: {
    titulo: 'Parcial 1', abre_en: horas(-1), cierra_en: horas(48), duracion_min: 30, umbral_inactividad_min: 3, grupos: [g.id], programar: true,
    preguntas: [
      { tipo: 'VERDADERO_FALSO', enunciado: 'La luz es una onda', puntos: 1, correcta: true },
      { tipo: 'ABIERTA', enunciado: 'Explica la primera ley', puntos: 2 },
    ],
  } });
  examenId = r.cuerpo.data.id;
  for (const a of ['envia', 'plagio', 'reabre']) {
    intento[a] = (await pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie: c[a], datos: { acepto: true } })).cuerpo.data.intento_id;
  }
  await presentar(c.envia, intento.envia);
  for (const a of ['plagio', 'reabre']) {
    await pedir('POST', `/api/alumno/intentos/${intento[a]}/incidente`, { cookie: c[a], datos: { tipo: 'CAMBIO_PESTANA' } });
  }
});

after(async () => {
  cerrar();
  await limpiarPrueba();
});

const auditoria = async (accion, id) => (await pool.query('SELECT detalle FROM bitacora_auditoria WHERE accion = $1 AND entidad_id = $2', [accion, id])).rows;

test('revisión: el docente ve solo sus anulados, con evidencia (RF-40, RF-45)', async () => {
  const lista = (await pedir('GET', '/api/docente/revision', { cookie: doc })).cuerpo.data;
  assert.deepEqual(lista.map((i) => i.alumno).sort(), [nombre('plagio'), nombre('reabre')]);
  assert.equal(lista[0].tipo, 'CAMBIO_PESTANA');
  assert.ok(lista[0].ip && lista[0].dispositivo);
  assert.ok(lista[0].restante_min > 25 && lista[0].restante_min <= 30, 'le quedaba casi todo el tiempo');
  assert.deepEqual((await pedir('GET', '/api/docente/revision', { cookie: ajeno })).cuerpo.data, []);
  for (const accion of ['confirmar', 'reabrir']) {
    assert.equal((await pedir('POST', `/api/docente/intentos/${intento.plagio}/${accion}`, { cookie: ajeno, datos: {} })).estado, 404);
  }
  assert.equal((await pedir('GET', '/api/docente/revision', { cookie: c.envia })).estado, 403);
});

test('confirmar plagio: la anulación es definitiva y queda en la bitácora (RF-33, RNF-08)', async () => {
  const r = await pedir('POST', `/api/docente/intentos/${intento.plagio}/confirmar`, { cookie: doc, datos: {} });
  assert.equal(r.estado, 200);
  const { rows: [i] } = await pool.query('SELECT estado, plagio_confirmado FROM intento WHERE id = $1', [intento.plagio]);
  assert.deepEqual(i, { estado: 'ANULADO', plagio_confirmado: true });
  assert.equal((await pool.query('SELECT decision FROM incidente WHERE intento_id = $1', [intento.plagio])).rows[0].decision, 'CONFIRMADO');
  assert.equal((await auditoria('CONFIRMAR_PLAGIO', intento.plagio)).length, 1);
  assert.equal((await pedir('POST', `/api/docente/intentos/${intento.plagio}/confirmar`, { cookie: doc, datos: {} })).estado, 409);
  assert.equal((await pedir('POST', `/api/docente/intentos/${intento.plagio}/reabrir`, { cookie: doc, datos: {} })).estado, 409);
  assert.ok(!(await pedir('GET', '/api/docente/revision', { cookie: doc })).cuerpo.data.some((x) => x.id === intento.plagio));
});

test('reabrir: recupera el tiempo que le quedaba más el extra y continúa donde iba (RF-41 · CU-14)', async () => {
  const url = `/api/docente/intentos/${intento.reabre}/reabrir`;
  assert.equal((await pedir('POST', url, { cookie: doc, datos: { tiempo_extra_min: 300 } })).estado, 400);
  assert.equal((await pedir('POST', url, { cookie: doc, datos: { tiempo_extra_min: 1.5 } })).estado, 400);
  // Simula que la anulación fue hace 2 horas: ese tiempo en pausa no debe contar en su contra.
  await pool.query("UPDATE intento SET inicio_en = inicio_en - interval '2 hours', fin_en = fin_en - interval '2 hours' WHERE id = $1", [intento.reabre]);
  assert.equal((await pedir('POST', url, { cookie: doc, datos: { tiempo_extra_min: 10 } })).estado, 200);
  assert.equal((await pool.query('SELECT decision FROM incidente WHERE intento_id = $1', [intento.reabre])).rows[0].decision, 'DESCARTADO');
  assert.match((await auditoria('REABRIR_EXAMEN', intento.reabre))[0].detalle, /10 min/);

  const p = (await pedir('GET', `/api/alumno/intentos/${intento.reabre}`, { cookie: c.reabre })).cuerpo.data;
  assert.equal(p.estado, 'REABIERTO');
  const minutos = p.restante_ms / 60_000;
  assert.ok(minutos > 38 && minutos <= 41, `≈ 30 que le quedaban + 10 extra, no ${minutos}`);
  assert.equal((await presentar(c.reabre, intento.reabre)).estado, 'ENVIADO');
});

test('calificación manual de abiertas con comentario y recálculo (RF-39 · CU-15)', async () => {
  const lista = (await pedir('GET', `/api/docente/examenes/${examenId}/calificar`, { cookie: doc })).cuerpo.data;
  assert.equal(lista.intentos.find((i) => i.alumno === nombre('envia')).pendientes, 1);
  assert.equal(lista.intentos.find((i) => i.alumno === nombre('envia')).calificacion, 3.33, 'solo la cerrada: 1 de 3 puntos');
  assert.equal((await pedir('GET', `/api/docente/examenes/${examenId}/calificar`, { cookie: ajeno })).estado, 404);

  const detalle = (await pedir('GET', `/api/docente/intentos/${intento.envia}/respuestas`, { cookie: doc })).cuerpo.data;
  const abierta = detalle.preguntas.find((p) => p.tipo === 'ABIERTA');
  const cerrada = detalle.preguntas.find((p) => p.tipo !== 'ABIERTA');
  assert.equal(abierta.texto_respuesta, 'La energía se conserva.');
  assert.equal(cerrada.opcion_correcta, 'Verdadero');
  assert.equal((await pedir('GET', `/api/docente/intentos/${intento.envia}/respuestas`, { cookie: ajeno })).estado, 404);

  const url = `/api/docente/intentos/${intento.envia}/calificacion`;
  for (const malo of [
    [{ pregunta_id: abierta.pregunta_id, puntos: 3 }],
    [{ pregunta_id: abierta.pregunta_id, puntos: -1 }],
    [{ pregunta_id: abierta.pregunta_id, puntos: 1.234 }],
    [{ pregunta_id: cerrada.pregunta_id, puntos: 1 }],
  ]) assert.equal((await pedir('PUT', url, { cookie: doc, datos: { calificaciones: malo } })).estado, 400, JSON.stringify(malo));
  assert.equal((await pedir('PUT', url, { cookie: ajeno, datos: { calificaciones: [{ pregunta_id: abierta.pregunta_id, puntos: 2 }] } })).estado, 404);
  assert.equal((await pedir('PUT', `/api/docente/intentos/${intento.plagio}/calificacion`, { cookie: doc, datos: { calificaciones: [{ pregunta_id: abierta.pregunta_id, puntos: 2 }] } })).estado, 409, 'anulado');

  const r = await pedir('PUT', url, { cookie: doc, datos: { calificaciones: [{ pregunta_id: abierta.pregunta_id, puntos: 1.5, comentario: 'Falta un ejemplo.' }] } });
  assert.equal(r.cuerpo.data.calificacion, 8.33);
  assert.match((await auditoria('CALIFICAR', intento.envia))[0].detalle, /8\.33/);
});

test('publicar exige calificar todo; el alumno ve su nota y el detalle solo si se permite (RF-17, RF-29 · CU-16, CU-24)', async () => {
  const url = `/api/docente/examenes/${examenId}/publicar`;
  const antes = await pedir('POST', url, { cookie: doc });
  assert.equal(antes.estado, 409, 'falta la abierta de quien se reabrió');
  assert.match(antes.cuerpo.error, /Falta 1 respuesta abierta/);
  const detalle = (await pedir('GET', `/api/docente/intentos/${intento.reabre}/respuestas`, { cookie: doc })).cuerpo.data;
  const abierta = detalle.preguntas.find((p) => p.tipo === 'ABIERTA').pregunta_id;
  await pedir('PUT', `/api/docente/intentos/${intento.reabre}/calificacion`, { cookie: doc, datos: { calificaciones: [{ pregunta_id: abierta, puntos: 2 }] } });

  const resultado = `/api/alumno/intentos/${intento.envia}/resultado`;
  assert.equal((await pedir('GET', resultado, { cookie: c.envia })).estado, 404, 'sin publicar');
  assert.equal((await pedir('POST', url, { cookie: ajeno })).estado, 404);
  assert.equal((await pedir('POST', url, { cookie: doc })).cuerpo.data.publicados, 2);
  assert.equal((await pedir('POST', url, { cookie: doc })).estado, 409, 'nada nuevo');
  assert.equal((await auditoria('PUBLICAR_RESULTADOS', examenId)).length, 1);

  const sinDetalle = (await pedir('GET', resultado, { cookie: c.envia })).cuerpo.data;
  assert.equal(sinDetalle.calificacion, 8.33);
  assert.equal(sinDetalle.preguntas, undefined, 'el docente no permitió ver respuestas');
  assert.equal((await pedir('GET', resultado, { cookie: c.reabre })).estado, 404, 'resultado ajeno');
  assert.equal((await pedir('GET', `/api/alumno/intentos/${intento.plagio}/resultado`, { cookie: c.plagio })).estado, 404, 'anulado no tiene resultado');
  const panel = (await pedir('GET', '/api/alumno/examenes', { cookie: c.envia })).cuerpo.data.find((e) => e.id === examenId);
  assert.equal(panel.calificacion, 8.33);

  await pool.query('UPDATE examen SET mostrar_respuestas = true WHERE id = $1', [examenId]);
  const conDetalle = (await pedir('GET', resultado, { cookie: c.envia })).cuerpo.data;
  const a = conDetalle.preguntas.find((p) => p.tipo === 'ABIERTA');
  assert.equal(a.comentario, 'Falta un ejemplo.');
  assert.equal(a.puntos_obtenidos, 1.5);
  assert.equal(conDetalle.preguntas.find((p) => p.tipo !== 'ABIERTA').opcion_correcta, 'Verdadero');
});

test('reportes: calificaciones, incidentes y estadísticas, en JSON, Excel y PDF, solo del dueño (RF-43 a RF-45)', async () => {
  const r = (await pedir('GET', `/api/docente/examenes/${examenId}/reporte`, { cookie: doc })).cuerpo.data;
  const estado = Object.fromEntries(r.calificaciones.map((x) => [x.alumno, x.estado]));
  assert.equal(estado[nombre('falta')], 'NO_PRESENTADO');
  assert.equal(estado[nombre('plagio')], 'ANULADO_CONFIRMADO');
  assert.equal(r.calificaciones.find((x) => x.alumno === nombre('plagio')).calificacion, null);
  assert.equal(r.incidentes.length, 2);
  assert.deepEqual(r.incidentes.map((i) => i.decision).sort(), ['CONFIRMADO', 'DESCARTADO']);
  assert.equal(r.estadisticas.asignados, 4);
  assert.equal(r.estadisticas.calificados, 2);
  assert.equal(r.estadisticas.aprobados, 2);
  assert.equal(r.estadisticas.promedio, 9.17);
  assert.equal(r.estadisticas.no_presentados, 1);

  for (const [ext, firma] of [['xlsx', 'PK'], ['pdf', '%PDF']]) {
    const res = await fetch(`${base}/api/docente/examenes/${examenId}/reporte.${ext}`, { headers: { Cookie: doc } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), new RegExp(`reporte-examen-${examenId}\\.${ext}`));
    assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, firma.length).toString(), firma);
    assert.equal((await fetch(`${base}/api/docente/examenes/${examenId}/reporte.${ext}`, { headers: { Cookie: ajeno } })).status, 404);
  }
});

// Prueba de carga (RNF-10, RNF-11, RNF-12): N alumnos presentan a la vez un examen completo contra un servidor ya encendido.
// Uso, en la PC donde está la base de datos de ese servidor:
//   npm run carga -- [url] [alumnos] [preguntas]      p. ej. npm run carga -- https://xxxx.trycloudflare.com 200 10
// Crea usuarios "prueba_*" directo en la BD, mide por HTTP y WebSocket, verifica en la BD que no se perdió nada y limpia todo.
import { setTimeout as esperar } from 'node:timers/promises';
import { cliente, nombre, pool, CLAVE, limpiarPrueba } from './ayuda.js';
import { hashContrasena } from '../server/services/contrasenas.js';

const [URL_DADA = 'http://localhost:3000', N = '200', P = '10'] = process.argv.slice(2);
const URL_BASE = URL_DADA.replace(/\/+$/, ''); // con "/" al final, el socket iría a "//socket.io/" y fallaría
const ALUMNOS = Number(N);
const PREGUNTAS = Number(P);
const RAMPA_MS = 10_000; // todos entran en los primeros 10 s, como al abrir el examen
const pensar = () => esperar(1000 + Math.random() * 2000);

const { pedir, cookieDe } = cliente(URL_BASE.replace(/\/$/, ''));
const tiempos = {}; // operación → [ms]
const errores = {}; // "operación estado" → veces

async function medir(op, fn, esperado = [200, 201]) {
  const t0 = performance.now();
  let r;
  try {
    r = await fn();
  } catch (err) {
    r = { estado: err.cause?.code || err.message };
  }
  (tiempos[op] ??= []).push(performance.now() - t0);
  if (!esperado.includes(r.estado)) errores[`${op} ${r.estado}`] = (errores[`${op} ${r.estado}`] || 0) + 1;
  return r;
}

// Socket.IO sobre WebSocket con la cookie de sesión; responde los latidos del servidor.
function conectarSocket(cookie, intento) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const ws = new WebSocket(`${URL_BASE.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`, { headers: { Cookie: cookie } });
    let resuelto = false;
    const listo = (motivo) => {
      if (resuelto) return;
      resuelto = true;
      (tiempos.socket ??= []).push(performance.now() - t0);
      if (motivo) errores[`socket rechazado: ${motivo}`] = (errores[`socket rechazado: ${motivo}`] || 0) + 1;
      resolve(ws);
    };
    ws.onmessage = ({ data }) => {
      if (data.startsWith('0')) ws.send(`40${JSON.stringify({ intento })}`);
      else if (data.startsWith('40')) listo(null);
      else if (data.startsWith('44')) listo(data.slice(2));
      else if (data === '2') ws.send('3');
    };
    ws.onerror = (e) => listo(`error de conexión ${e.message || ''}`.trim());
    ws.onclose = (e) => listo(`cerrado ${e.code}`);
  });
}

async function alumno(usuario, examenId) {
  const login = await medir('entrar', () => pedir('POST', '/api/auth/entrar', { datos: { usuario, contrasena: CLAVE } }));
  const cookie = login.cookie;
  if (!cookie) return;
  await medir('lista de exámenes', () => pedir('GET', '/api/alumno/examenes', { cookie }));
  const ini = await medir('iniciar', () => pedir('POST', `/api/alumno/examenes/${examenId}/iniciar`, { cookie, datos: { acepto: true } }));
  const intento = ini.cuerpo?.data?.intento_id;
  if (!intento) return;
  const ws = await conectarSocket(cookie, intento);
  const ruta = `/api/alumno/intentos/${intento}`;
  for (let i = 0; i < PREGUNTAS; i++) {
    const e = (await medir('pedir pregunta', () => pedir('GET', ruta, { cookie }))).cuerpo?.data;
    if (!e?.pregunta) break;
    const resp = e.pregunta.tipo === 'ABIERTA' ? { texto: `Respuesta de ${usuario}` } : { opcion_id: e.pregunta.opciones[0].id };
    await pensar();
    await medir('autoguardar', () => pedir('PUT', `${ruta}/respuesta`, { cookie, datos: { pregunta_id: e.pregunta.id, ...resp } }));
    await pensar();
    await medir('avanzar / enviar', () => pedir('POST', `${ruta}/avanzar`, { cookie, datos: { pregunta_id: e.pregunta.id, ...resp } }));
  }
  ws.close();
}

const percentil = (lista, p) => lista[Math.min(lista.length - 1, Math.floor((p / 100) * lista.length))];

async function principal() {
  console.log(`Preparando ${ALUMNOS} alumnos y un examen de ${PREGUNTAS} preguntas contra ${URL_BASE} …`);
  const hash = await hashContrasena(CLAVE);
  const DOC = nombre('cargadoc');
  const usuarios = Array.from({ length: ALUMNOS }, (_, i) => nombre(`carga${i}`));
  await pool.query("INSERT INTO usuario (nombre_usuario, contrasena_hash, rol) VALUES ($1, $2, 'DOCENTE')", [DOC, hash]);
  await pool.query("INSERT INTO usuario (nombre_usuario, contrasena_hash, rol) SELECT unnest($1::text[]), $2, 'ALUMNO'", [usuarios, hash]);

  const doc = await cookieDe(DOC);
  const m = (await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: 'Prueba de carga' } })).cuerpo.data;
  const g = (await pedir('POST', '/api/docente/grupos', { cookie: doc, datos: { materia_id: m.id, nombre: 'Carga' } })).cuerpo.data;
  await pool.query(
    'INSERT INTO inscripcion (alumno_id, grupo_id) SELECT id, $2 FROM usuario WHERE nombre_usuario = ANY($1)', [usuarios, g.id],
  );
  const horas = (h) => new Date(Date.now() + h * 3600_000).toISOString();
  const examen = (await pedir('POST', '/api/docente/examenes', { cookie: doc, datos: {
    titulo: 'Prueba de carga', abre_en: horas(-1), cierra_en: horas(3), duracion_min: 60, umbral_inactividad_min: 3, grupos: [g.id], programar: true,
    preguntas: Array.from({ length: PREGUNTAS }, (_, i) => (i % 3 === 2
      ? { tipo: 'ABIERTA', enunciado: `Pregunta ${i + 1}`, puntos: 1 }
      : { tipo: 'OPCION_MULTIPLE', enunciado: `Pregunta ${i + 1}`, puntos: 1, opciones: ['A', 'B', 'C', 'D'].map((t) => ({ texto: t, es_correcta: t === 'A' })) })),
  } })).cuerpo;
  if (!examen.ok) throw new Error(`No se pudo crear el examen: ${examen.error}`);
  const examenId = examen.data.id;

  console.log('Comenzando…');
  const t0 = performance.now();
  await Promise.all(usuarios.map(async (u, i) => {
    await esperar((i / ALUMNOS) * RAMPA_MS);
    await alumno(u, examenId);
  }));
  const duracion = (performance.now() - t0) / 1000;

  const { rows: [bd] } = await pool.query(
    `SELECT count(*) FILTER (WHERE estado = 'ENVIADO')::int AS enviados,
            count(*) FILTER (WHERE estado = 'ABANDONADO')::int AS abandonados,
            count(*) FILTER (WHERE estado NOT IN ('ENVIADO', 'ABANDONADO'))::int AS otros,
            (SELECT count(*)::int FROM respuesta r JOIN intento i2 ON i2.id = r.intento_id WHERE i2.examen_id = $1) AS respuestas
       FROM intento WHERE examen_id = $1`, [examenId],
  );

  const total = Object.values(tiempos).reduce((a, l) => a + l.length, 0);
  console.log(`\nResultado · ${ALUMNOS} alumnos · ${PREGUNTAS} preguntas · ${duracion.toFixed(1)} s · ${total} operaciones (${(total / duracion).toFixed(1)}/s)\n`);
  console.log('Operación'.padEnd(20), 'n'.padStart(6), 'p50 ms'.padStart(8), 'p95 ms'.padStart(8), 'máx ms'.padStart(8));
  for (const [op, lista] of Object.entries(tiempos)) {
    lista.sort((a, b) => a - b);
    console.log(op.padEnd(20), String(lista.length).padStart(6), ...[50, 95].map((p) => percentil(lista, p).toFixed(0).padStart(8)), lista.at(-1).toFixed(0).padStart(8));
  }
  console.log('\nErrores:', Object.keys(errores).length ? errores : 'ninguno');
  const esperadas = ALUMNOS * PREGUNTAS;
  console.log(`BD: ${bd.enviados}/${ALUMNOS} enviados, ${bd.abandonados} abandonados, ${bd.otros} sin terminar; ${bd.respuestas}/${esperadas} respuestas guardadas.`);
  const ok = bd.enviados === ALUMNOS && bd.respuestas === esperadas && !Object.keys(errores).length;
  console.log(ok ? '\nAPROBADA: todos terminaron y no se perdió ninguna respuesta.' : '\nREVISAR: hubo errores o datos faltantes.');
  return ok;
}

let ok = false;
try {
  ok = await principal();
} finally {
  await esperar(500);
  await limpiarPrueba(); // borra usuarios prueba_*, examen, intentos y respuestas de esta corrida
}
process.exit(ok ? 0 : 1);

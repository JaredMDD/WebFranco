// Prueba de la Fase 9: ataques comunes contra la API (npm test). RNF-05, RNF-06.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, crearUsuario, limpiarPrueba, nombre, pool, CLAVE } from './ayuda.js';

const ADM = nombre('adm');
const DOC = nombre('doc');
const ALU = nombre('alu');
let pedir, cookieDe, cerrar, base, adm, doc, alu;

before(async () => {
  ({ pedir, cookieDe, cerrar, base } = await arrancar());
  for (const [n, rol] of [[ADM, 'ADMIN'], [DOC, 'DOCENTE'], [ALU, 'ALUMNO']]) await crearUsuario(n, rol);
  [adm, doc, alu] = await Promise.all([ADM, DOC, ALU].map(cookieDe));
});

after(async () => {
  cerrar();
  await limpiarPrueba();
});

test('cada rol solo entra a su API; sin sesión, nada (RNF-05)', async () => {
  const rutas = { ADMIN: '/api/admin/estado', DOCENTE: '/api/docente/materias', ALUMNO: '/api/alumno/grupos' };
  const cookies = { ADMIN: adm, DOCENTE: doc, ALUMNO: alu };
  for (const [rolRuta, ruta] of Object.entries(rutas)) {
    assert.equal((await pedir('GET', ruta)).estado, 401, `${ruta} sin sesión`);
    for (const [rol, cookie] of Object.entries(cookies)) {
      const { estado } = await pedir('GET', ruta, { cookie });
      if (rol === rolRuta) assert.equal(estado, 200, `${rol} en ${ruta}`);
      else assert.equal(estado, 403, `${rol} no debe entrar a ${ruta}`);
    }
  }
  assert.equal((await pedir('GET', '/api/docente/materias', { cookie: 'sid=inventado' })).estado, 401, 'cookie falsa');
});

test('inyección SQL: se trata como texto y no altera la base (RNF-06)', async () => {
  for (const usuario of [`' OR '1'='1`, `admin'--`, `${ADM}' --`]) {
    const r = await pedir('POST', '/api/auth/entrar', { datos: { usuario, contrasena: `' OR '1'='1` } });
    assert.equal(r.estado, 401, `login con ${usuario}`);
    assert.equal(r.cookie, undefined);
  }
  const reg = await pedir('POST', '/api/auth/registro', { datos: { usuario: "x'; DROP TABLE usuario;--", contrasena: CLAVE, confirmar: CLAVE } });
  assert.equal(reg.estado, 400);
  assert.equal((await pedir('POST', '/api/alumno/inscripciones', { cookie: alu, datos: { codigo: "' OR 1=1--" } })).estado >= 400, true);

  const carga = "Física'); DELETE FROM materia; --";
  const m = await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: carga } });
  assert.equal(m.estado, 201);
  assert.equal(m.cuerpo.data.nombre, carga, 'se guarda tal cual');
  const { rows } = await pool.query('SELECT nombre_usuario FROM usuario WHERE nombre_usuario = ANY($1)', [[ADM, DOC, ALU]]);
  assert.equal(rows.length, 3, 'las tablas y los usuarios siguen intactos');
});

test('XSS: el texto se devuelve como dato y la política de contenido bloquea scripts en línea (RNF-06)', async () => {
  const carga = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  const m = await pedir('POST', '/api/docente/materias', { cookie: doc, datos: { nombre: carga } });
  const lista = await fetch(`${base}/api/docente/materias`, { headers: { Cookie: doc } });
  assert.match(lista.headers.get('content-type'), /application\/json/, 'nunca se sirve como HTML');
  assert.ok((await lista.json()).data.some((x) => x.id === m.cuerpo.data.id && x.nombre === carga));
  const csp = (await fetch(`${base}/`)).headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /script-src-attr 'none'/);
});

test('IDs manipulados: valores raros dan 400/404, nunca error del servidor ni datos ajenos (RNF-06)', async () => {
  for (const id of ['abc', '-1', '0', '1.5', '1e9', '99999999999999999999', "1;DROP TABLE intento", '%27']) {
    for (const [ruta, cookie] of [
      [`/api/alumno/intentos/${id}`, alu], [`/api/alumno/examenes/${id}`, alu], [`/api/alumno/intentos/${id}/resultado`, alu],
      [`/api/docente/examenes/${id}`, doc], [`/api/docente/grupos/${id}/alumnos`, doc],
    ]) {
      const { estado } = await pedir('GET', ruta, { cookie });
      assert.ok([400, 404].includes(estado), `${ruta} → ${estado}`);
    }
  }
});

test('el registro no permite elegir rol ni campos extra (asignación masiva)', async () => {
  const usuario = nombre('colado');
  const r = await pedir('POST', '/api/auth/registro', { datos: { usuario, contrasena: CLAVE, confirmar: CLAVE, rol: 'ADMIN', id: 1 } });
  assert.equal(r.estado, 201);
  const { rows: [u] } = await pool.query('SELECT rol FROM usuario WHERE nombre_usuario = $1', [usuario]);
  assert.equal(u.rol, 'ALUMNO');
});

test('cuerpos mal formados o que no son JSON se rechazan sin error del servidor', async () => {
  const roto = await fetch(`${base}/api/auth/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"usuario":' });
  assert.equal(roto.status, 400);
  const formulario = await fetch(`${base}/api/auth/entrar`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `usuario=${ADM}&contrasena=${CLAVE}`,
  });
  assert.ok(formulario.status >= 400, 'un formulario de otro sitio no inicia sesión');
  const grande = await fetch(`${base}/api/auth/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'x'.repeat(200_000) }) });
  assert.equal(grande.status, 413);
});

// Prueba de integración de la Fase 2: cuentas, sesiones y roles (npm test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, crearUsuario, limpiarPrueba, nombre, sufijo, pool, CLAVE } from './ayuda.js';

const ALUMNO = nombre('al');
const ADMIN = nombre('ad');
const DOCENTE = nombre('do');
let pedir, entrar, cerrar;

before(async () => {
  ({ pedir, entrar, cerrar } = await arrancar());
  await crearUsuario(ADMIN, 'ADMIN');
});

after(async () => {
  cerrar();
  await limpiarPrueba();
});

test('registro de alumno valida datos y rechaza duplicados (RF-01, RNF-04)', async () => {
  const base = { usuario: ALUMNO, contrasena: CLAVE, confirmar: CLAVE };
  assert.equal((await pedir('POST', '/api/auth/registro', { datos: { ...base, contrasena: 'corta', confirmar: 'corta' } })).estado, 400);
  assert.equal((await pedir('POST', '/api/auth/registro', { datos: { ...base, contrasena: 'soloLetras', confirmar: 'soloLetras' } })).estado, 400);
  assert.equal((await pedir('POST', '/api/auth/registro', { datos: { ...base, confirmar: 'otra1234' } })).estado, 400);
  assert.equal((await pedir('POST', '/api/auth/registro', { datos: { ...base, sitio_web: 'spam' } })).estado, 400, 'campo trampa');
  const ok = await pedir('POST', '/api/auth/registro', { datos: { ...base, usuario: ALUMNO.toUpperCase() } });
  assert.equal(ok.estado, 201);
  assert.equal(ok.cuerpo.data.usuario, ALUMNO, 'se guarda en minúsculas');
  assert.equal((await pedir('POST', '/api/auth/registro', { datos: base })).estado, 409);
});

test('inicio de sesión por rol y control de acceso en el servidor (RF-02, RNF-05)', async () => {
  assert.equal((await entrar(ALUMNO, 'mala1234')).estado, 401);
  const r = await entrar(ALUMNO, CLAVE);
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.data.panel, '/alumno/panel.html');
  assert.ok(r.cookie);

  assert.equal((await pedir('GET', '/api/admin/docentes', { cookie: r.cookie })).estado, 403);
  assert.equal((await pedir('GET', '/api/admin/docentes')).estado, 401);
  assert.equal((await pedir('GET', '/alumno/panel.html', { cookie: r.cookie })).estado, 200);
  const ajena = await pedir('GET', '/admin/panel.html', { cookie: r.cookie });
  assert.equal(ajena.estado, 302);
  assert.equal(ajena.ubicacion, '/alumno/panel.html');
  assert.equal((await pedir('GET', '/docente/panel.html')).ubicacion, '/');
  assert.equal((await pedir('GET', '/', { cookie: r.cookie })).ubicacion, '/alumno/panel.html');
});

test('un alumno solo tiene una sesión activa; cerrar sesión la invalida (RF-34)', async () => {
  const primera = await entrar(ALUMNO, CLAVE);
  const segunda = await entrar(ALUMNO, CLAVE);
  assert.equal((await pedir('GET', '/api/auth/yo', { cookie: primera.cookie })).estado, 401);
  assert.equal((await pedir('GET', '/api/auth/yo', { cookie: segunda.cookie })).estado, 200);
  await pedir('POST', '/api/auth/salir', { cookie: segunda.cookie });
  assert.equal((await pedir('GET', '/api/auth/yo', { cookie: segunda.cookie })).estado, 401);
});

test('el administrador gestiona docentes y contraseñas, con auditoría (RF-03 a RF-05, RNF-08)', async () => {
  const { cookie: adm } = await entrar(ADMIN, CLAVE);
  const creado = await pedir('POST', '/api/admin/docentes', { cookie: adm, datos: { usuario: DOCENTE } });
  assert.equal(creado.estado, 201);
  const { id, contrasena } = creado.cuerpo.data;
  assert.equal((await pedir('POST', '/api/admin/docentes', { cookie: adm, datos: { usuario: DOCENTE } })).estado, 409);

  const doc = await entrar(DOCENTE, contrasena);
  assert.equal(doc.cuerpo.data.panel, '/docente/panel.html');
  assert.equal((await pedir('POST', '/api/admin/docentes', { cookie: doc.cookie, datos: { usuario: 'otro_doc' } })).estado, 403, 'un docente no crea docentes');

  assert.equal((await pedir('PATCH', `/api/admin/docentes/${id}`, { cookie: adm, datos: { activo: false } })).estado, 200);
  assert.equal((await pedir('GET', '/api/auth/yo', { cookie: doc.cookie })).estado, 401, 'desactivar cierra sus sesiones');
  assert.equal((await entrar(DOCENTE, contrasena)).estado, 403);
  await pedir('PATCH', `/api/admin/docentes/${id}`, { cookie: adm, datos: { activo: true } });

  const res = await pedir('POST', '/api/admin/restablecer', { cookie: adm, datos: { usuario: ALUMNO } });
  assert.equal(res.estado, 200);
  assert.equal((await entrar(ALUMNO, CLAVE)).estado, 401, 'la contraseña anterior ya no sirve');
  assert.equal((await entrar(ALUMNO, res.cuerpo.data.contrasena)).estado, 200);
  assert.equal((await pedir('POST', '/api/admin/restablecer', { cookie: adm, datos: { usuario: ADMIN } })).estado, 404, 'no restablece administradores');

  const { rows } = await pool.query(
    'SELECT accion FROM bitacora_auditoria WHERE usuario_id = (SELECT id FROM usuario WHERE nombre_usuario = $1) ORDER BY id', [ADMIN]);
  assert.deepEqual(rows.map((r) => r.accion), ['CREAR_DOCENTE', 'DESACTIVAR_DOCENTE', 'ACTIVAR_DOCENTE', 'RESTABLECER_CONTRASENA']);
});

test('demasiados intentos fallidos se bloquean (RNF-04)', async () => {
  const usuario = `prueba_nadie_${sufijo}`;
  for (let i = 0; i < 10; i++) assert.equal((await entrar(usuario, 'mala1234')).estado, 401);
  assert.equal((await entrar(usuario, 'mala1234')).estado, 429);
});

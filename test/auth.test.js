// Prueba de integración de la Fase 2: cuentas, sesiones y roles (npm test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, crearUsuario, limpiarPrueba, nombre, sufijo, pool, CLAVE } from './ayuda.js';
import { envio } from '../server/services/correo.js';

// Los correos se guardan aquí en lugar de enviarse.
const buzon = [];
envio.transporte = { sendMail: async (m) => { buzon.push(m); } };
process.env.URL_PUBLICA = 'https://examenes.ejemplo';
const correoDe = (u) => `${u}@ejemplo.mx`;
const contrasenaDelCorreo = () => buzon.at(-1).text.match(/Contraseña: (\S+)/)[1];

const ALUMNO = nombre('al');
const ADMIN = nombre('ad');
const DOCENTE = nombre('do');
const ADMIN2 = nombre('ad2');
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

test('el administrador gestiona cuentas y contraseñas, con correo y auditoría (RF-03 a RF-05, RNF-08)', async () => {
  const { cookie: adm } = await entrar(ADMIN, CLAVE);
  const datos = { usuario: DOCENTE, correo: correoDe(DOCENTE) };
  assert.equal((await pedir('POST', '/api/admin/cuentas', { cookie: adm, datos: { usuario: DOCENTE } })).estado, 400, 'el correo es obligatorio');
  const creado = await pedir('POST', '/api/admin/cuentas', { cookie: adm, datos });
  assert.equal(creado.estado, 201);
  const { id, enviado } = creado.cuerpo.data;
  assert.equal(enviado, true);
  assert.equal(creado.cuerpo.data.contrasena, undefined, 'si se envió por correo no se muestra en pantalla');
  assert.equal(buzon.at(-1).to, correoDe(DOCENTE));
  const contrasena = contrasenaDelCorreo();
  assert.equal((await pedir('POST', '/api/admin/cuentas', { cookie: adm, datos })).estado, 409);

  const doc = await entrar(DOCENTE, contrasena);
  assert.equal(doc.cuerpo.data.panel, '/docente/panel.html');
  assert.equal((await pedir('POST', '/api/admin/cuentas', { cookie: doc.cookie, datos: { usuario: 'otro_doc', correo: 'o@e.mx' } })).estado, 403, 'un docente no crea cuentas');

  assert.equal((await pedir('PATCH', `/api/admin/cuentas/${id}`, { cookie: adm, datos: { activo: false } })).estado, 200);
  assert.equal((await pedir('GET', '/api/auth/yo', { cookie: doc.cookie })).estado, 401, 'desactivar cierra sus sesiones');
  assert.equal((await entrar(DOCENTE, contrasena)).estado, 403);
  await pedir('PATCH', `/api/admin/cuentas/${id}`, { cookie: adm, datos: { activo: true } });

  const res = await pedir('POST', '/api/admin/restablecer', { cookie: adm, datos: { usuario: ALUMNO } });
  assert.equal(res.estado, 200);
  assert.equal(res.cuerpo.data.enviado, false, 'el alumno no tiene correo: la contraseña se muestra en pantalla');
  assert.equal((await entrar(ALUMNO, CLAVE)).estado, 401, 'la contraseña anterior ya no sirve');
  assert.equal((await entrar(ALUMNO, res.cuerpo.data.contrasena)).estado, 200);
  assert.equal((await pedir('POST', '/api/admin/restablecer', { cookie: adm, datos: { usuario: ADMIN } })).estado, 404, 'no restablece administradores');

  const { rows } = await pool.query(
    'SELECT accion FROM bitacora_auditoria WHERE usuario_id = (SELECT id FROM usuario WHERE nombre_usuario = $1) ORDER BY id', [ADMIN]);
  assert.deepEqual(rows.map((r) => r.accion), ['CREAR_DOCENTE', 'DESACTIVAR_DOCENTE', 'ACTIVAR_DOCENTE', 'RESTABLECER_CONTRASENA']);
});

test('el administrador crea otros administradores y no se desactiva a sí mismo', async () => {
  const { cookie: adm } = await entrar(ADMIN, CLAVE);
  const creado = await pedir('POST', '/api/admin/cuentas', { cookie: adm, datos: { usuario: ADMIN2, correo: correoDe(ADMIN2), rol: 'ADMIN' } });
  assert.equal(creado.estado, 201);
  assert.equal((await entrar(ADMIN2, contrasenaDelCorreo())).cuerpo.data.panel, '/admin/panel.html');
  assert.equal((await pedir('POST', '/api/admin/cuentas', { cookie: adm, datos: { usuario: nombre('x'), correo: 'x@e.mx', rol: 'ALUMNO' } })).estado, 400);

  const cuentas = (await pedir('GET', '/api/admin/cuentas', { cookie: adm })).cuerpo.data;
  const propia = cuentas.find((c) => c.nombre_usuario === ADMIN);
  assert.equal(propia.propia, true);
  assert.equal((await pedir('PATCH', `/api/admin/cuentas/${propia.id}`, { cookie: adm, datos: { activo: false } })).estado, 400);
  const nuevoCorreo = correoDe(`${ADMIN2}.nuevo`);
  assert.equal((await pedir('PATCH', `/api/admin/cuentas/${creado.cuerpo.data.id}`, { cookie: adm, datos: { correo: nuevoCorreo } })).estado, 200);
  assert.equal((await pedir('PATCH', `/api/admin/cuentas/${propia.id}`, { cookie: adm, datos: { correo: nuevoCorreo } })).estado, 409, 'correo repetido');
});

test('docentes y administradores cambian su contraseña y su correo en Mi cuenta', async () => {
  const { cookie: adm } = await entrar(ADMIN, CLAVE);
  const nueva = 'nueva5678';
  assert.equal((await pedir('POST', '/api/auth/contrasena', { cookie: adm, datos: { actual: 'mala1234', nueva, confirmar: nueva } })).estado, 400);
  assert.equal((await pedir('POST', '/api/auth/contrasena', { cookie: adm, datos: { actual: CLAVE, nueva: 'corta', confirmar: 'corta' } })).estado, 400);
  const ok = await pedir('POST', '/api/auth/contrasena', { cookie: adm, datos: { actual: CLAVE, nueva, confirmar: nueva } });
  assert.equal(ok.estado, 200);
  assert.equal((await pedir('GET', '/api/auth/yo', { cookie: adm })).estado, 401, 'las sesiones anteriores se cierran');
  assert.equal((await pedir('GET', '/api/auth/yo', { cookie: ok.cookie })).estado, 200, 'este equipo sigue con sesión');
  assert.equal((await entrar(ADMIN, nueva)).estado, 200);

  assert.equal((await pedir('POST', '/api/auth/correo', { cookie: ok.cookie, datos: { actual: CLAVE, correo: correoDe(ADMIN) } })).estado, 400, 'pide la contraseña actual');
  assert.equal((await pedir('POST', '/api/auth/correo', { cookie: ok.cookie, datos: { actual: nueva, correo: correoDe(ADMIN) } })).estado, 200);
  assert.equal((await pedir('GET', '/api/auth/yo', { cookie: ok.cookie })).cuerpo.data.correo, correoDe(ADMIN));
  assert.equal((await pedir('POST', '/api/auth/contrasena', { datos: {} })).estado, 401);
});

test('olvidé mi contraseña: enlace de un solo uso por correo, sin revelar cuentas', async () => {
  const generico = (await pedir('POST', '/api/auth/olvide', { datos: { usuario: 'no_existe_nadie' } })).cuerpo.data.mensaje;
  await pedir('POST', '/api/auth/olvide', { datos: { usuario: ALUMNO } });
  const antes = buzon.length;
  const r = await pedir('POST', '/api/auth/olvide', { datos: { usuario: correoDe(DOCENTE).toUpperCase() } });
  assert.equal(r.cuerpo.data.mensaje, generico, 'misma respuesta exista o no la cuenta');
  await new Promise((fin) => setTimeout(fin, 300)); // el correo sale después de responder
  assert.equal(buzon.length, antes + 1, 'el alumno sin correo no recibe nada; el docente sí');
  assert.equal(buzon.at(-1).to, correoDe(DOCENTE));
  const token = buzon.at(-1).text.match(/^https:\/\/examenes\.ejemplo\/recuperar\.html\?token=(\S+)$/m)[1];

  const nueva = 'recupera99';
  assert.equal((await pedir('POST', '/api/auth/recuperar', { datos: { token: 'falso', contrasena: nueva, confirmar: nueva } })).estado, 400);
  assert.equal((await pedir('POST', '/api/auth/recuperar', { datos: { token, contrasena: nueva, confirmar: nueva } })).estado, 200);
  assert.equal((await pedir('POST', '/api/auth/recuperar', { datos: { token, contrasena: nueva, confirmar: nueva } })).estado, 400, 'un solo uso');
  assert.equal((await entrar(DOCENTE, nueva)).estado, 200);
});

test('demasiados intentos fallidos se bloquean (RNF-04)', async () => {
  const usuario = `prueba_nadie_${sufijo}`;
  for (let i = 0; i < 10; i++) assert.equal((await entrar(usuario, 'mala1234')).estado, 401);
  assert.equal((await entrar(usuario, 'mala1234')).estado, 429);
});

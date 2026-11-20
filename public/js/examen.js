// Examen en curso (CU-23, CU-25, CU-26): una pregunta a la vez, reloj del servidor y autoguardado.
// Vigilancia (CU-27): cambio de pestaña, inactividad y presencia por socket; el servidor decide y registra la evidencia.
const intentoId = Number(new URLSearchParams(location.search).get('intento'));
const RESINCRONIZAR_MS = 30_000;
let actual = null; // estado devuelto por el servidor
let finMs = 0; // instante (reloj monótono local) en que vence el tiempo según el servidor
let reloj = null;
let resincronizar = null;
let colaGuardado = Promise.resolve();
let esperaTexto = null;
const avisos = new Set();
let terminado = false;
let socket = null;
let sinConexion = false;
let umbralMs = 0; // inactividad permitida (RF-31)
let ultimaActividad = performance.now();
const AVISO_INACTIVIDAD_MS = 30_000;
let ultimoDialogo = -Infinity;

// confirm() propio: el diálogo nativo quita el foco a la página y no debe contar como cambio de ventana.
function confirmar(texto) {
  const r = confirm(texto);
  ultimoDialogo = ultimaActividad = performance.now();
  return r;
}

const ver = (id, visible) => $(id).classList.toggle('d-none', !visible);
const textoGuardado = (t, error = false) => {
  const e = $('estado-guardado');
  e.textContent = t;
  e.classList.toggle('text-danger', error);
};

function formatoTiempo(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function detener() {
  terminado = true;
  clearInterval(reloj);
  clearInterval(resincronizar);
  clearTimeout(esperaTexto);
  socket?.disconnect();
}

function alertaVigilancia(texto) {
  if ($('alerta-vigilancia-texto').textContent !== texto) $('alerta-vigilancia-texto').textContent = texto;
  ver('alerta-vigilancia', Boolean(texto));
}

// Cambio de pestaña o inactividad: avisa al servidor (que anula el intento) y muestra el motivo.
// keepalive: la petición sale aunque la pestaña se oculte o se cierre.
function reportar(tipo) {
  if (terminado) return;
  detener();
  fetch(`/api/alumno/intentos/${intentoId}/incidente`, {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo }),
  }).catch(() => {}).finally(() => location.replace(`/alumno/bloqueado.html?intento=${intentoId}`));
}

function vigilar() {
  socket = io({ auth: { intento: intentoId } });
  socket.on('connect', () => { sinConexion = false; });
  socket.on('disconnect', () => { sinConexion = true; });
  // Rechazo del servidor (sin sesión o intento cerrado): el socket ya no reintenta; cargar() muestra qué pasó.
  socket.on('connect_error', () => { if (!socket.active && !terminado) cargar(); });

  document.addEventListener('visibilitychange', () => { if (document.hidden) reportar('CAMBIO_PESTANA'); });
  // Otra ventana encima: se confirma 1.5 s después para no contar destellos de foco (notificaciones, diálogos propios).
  addEventListener('blur', () => setTimeout(() => { if (!document.hasFocus() && performance.now() - ultimoDialogo > 2000) reportar('CAMBIO_PESTANA'); }, 1500));
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart', 'input']) {
    addEventListener(ev, () => { ultimaActividad = performance.now(); }, { capture: true, passive: true });
  }
  // Sin copiar, pegar, clic derecho ni impresión durante el examen (RF-35); la impresión también se oculta por CSS.
  for (const ev of ['copy', 'cut', 'paste', 'drop', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') e.preventDefault(); });
}

function fallo(mensaje) {
  detener();
  ['barra', 'cargando', 'form-pregunta', 'pie', 'fin', 'alerta-vigilancia', 'calculadora'].forEach((id) => ver(id, false));
  $('fallo-texto').textContent = mensaje;
  ver('fallo', true);
}

function mostrarFin(tiempoAgotado) {
  detener();
  ['barra', 'cargando', 'form-pregunta', 'pie', 'alerta-vigilancia', 'calculadora'].forEach((id) => ver(id, false));
  ver('fin', true);
  if (tiempoAgotado) bootstrap.Modal.getOrCreateInstance($('modal-tiempo')).show();
  else $('t-fin').focus();
}

// El servidor dice que el intento ya no está abierto.
function cerradoPorServidor({ estado, tiempo_agotado: tiempoAgotado }) {
  if (estado === 'ENVIADO') return mostrarFin(tiempoAgotado);
  detener();
  location.replace(`/alumno/bloqueado.html?intento=${intentoId}`); // anulado o abandonado
}

function tic() {
  const restante = finMs - performance.now();
  $('reloj').textContent = formatoTiempo(restante);
  $('reloj').classList.toggle('poco-tiempo', restante <= 5 * 60_000);
  for (const [limite, texto] of [[5 * 60_000, 'Quedan 5 minutos.'], [60_000, 'Queda 1 minuto.']]) {
    if (restante <= limite && !avisos.has(limite)) {
      avisos.add(limite);
      $('aviso-tiempo').textContent = texto;
    }
  }
  if (restante <= 0 && !terminado) {
    clearInterval(reloj);
    return cargar(); // el servidor cierra el intento y responde tiempo_agotado
  }
  const inactivo = performance.now() - ultimaActividad;
  if (umbralMs && inactivo >= umbralMs) return reportar('INACTIVIDAD');
  alertaVigilancia(sinConexion ? 'Se perdió la conexión. Si no se recupera en unos segundos, el examen se marcará como abandonado.'
    : umbralMs && inactivo >= umbralMs - AVISO_INACTIVIDAD_MS ? 'No detectamos actividad. Toca la pantalla o mueve el cursor para que tu examen no se anule.' : '');
}

function pintar(e) {
  actual = e;
  finMs = performance.now() + e.restante_ms;
  umbralMs = e.umbral_inactividad_min * 60_000;
  ver('calculadora', Boolean(e.permite_herramienta)); // RF-18
  $('num-pregunta').textContent = e.posicion + 1;
  $('total-preguntas').textContent = e.total;
  const avance = Math.round((e.posicion / e.total) * 100);
  $('progreso').setAttribute('aria-valuenow', avance);
  $('progreso-barra').style.width = `${avance}%`;
  $('enunciado').textContent = e.pregunta.enunciado;
  $('imagen').replaceChildren(...(e.pregunta.imagen_ruta
    ? [el('img', { clase: 'imagen-pregunta', atributos: { src: `/api/imagenes/${encodeURIComponent(e.pregunta.imagen_ruta)}`, alt: 'Imagen de la pregunta' } })]
    : []));

  const abierta = e.pregunta.tipo === 'ABIERTA';
  ver('bloque-abierta', abierta);
  $('respuesta-abierta').value = abierta ? (e.respuesta?.texto || '') : '';
  $('opciones').replaceChildren(...(abierta ? [] : e.pregunta.opciones.map((o) => {
    const radio = el('input', { clase: 'form-check-input check-grande', atributos: { type: 'radio', name: 'respuesta', value: o.id } });
    radio.checked = e.respuesta?.opcion_id === o.id;
    radio.addEventListener('change', () => guardar({ opcion_id: o.id }));
    return el('label', { clase: 'card opcion-respuesta' }, radio, el('span', { texto: o.texto }));
  })));
  textoGuardado(e.respuesta ? 'Respuesta guardada' : '');
  $('avanzar').textContent = e.posicion + 1 === e.total ? 'Guardar y terminar' : 'Guardar y continuar';
  $('avanzar').disabled = false;

  ['cargando', 'fallo', 'fin'].forEach((id) => ver(id, false));
  ['barra', 'form-pregunta', 'pie'].forEach((id) => ver(id, true));
  clearInterval(reloj);
  reloj = setInterval(tic, 500);
  tic();
}

async function cargar() {
  let e;
  try {
    e = await api('GET', `/api/alumno/intentos/${intentoId}`);
  } catch (err) {
    return fallo(err.message);
  }
  if (!['EN_CURSO', 'REABIERTO'].includes(e.estado)) return cerradoPorServidor(e);
  const cambio = !actual || actual.pregunta.id !== e.pregunta.id;
  if (cambio) {
    pintar(e);
    $('enunciado').focus();
  } else {
    finMs = performance.now() + e.restante_ms; // solo resincroniza el reloj
  }
}

// Datos de la respuesta actual, tal como están en pantalla.
function respuestaEnPantalla() {
  if (actual.pregunta.tipo === 'ABIERTA') return { texto: $('respuesta-abierta').value };
  const marcada = document.querySelector('[name="respuesta"]:checked');
  return { opcion_id: marcada ? Number(marcada.value) : null };
}

// Autoguardado en cola: cada guardado espera al anterior para que no lleguen fuera de orden (RF-24).
function guardar(datos) {
  textoGuardado('Guardando…');
  const preguntaId = actual.pregunta.id;
  colaGuardado = colaGuardado.then(async () => {
    try {
      await api('PUT', `/api/alumno/intentos/${intentoId}/respuesta`, { pregunta_id: preguntaId, ...datos });
      if (actual?.pregunta.id === preguntaId) textoGuardado('Respuesta guardada');
    } catch (err) {
      if (err.cuerpo?.estado) return cerradoPorServidor(err.cuerpo);
      textoGuardado(`No se pudo guardar: ${err.message}`, true);
    }
  });
  return colaGuardado;
}

$('respuesta-abierta').addEventListener('input', () => {
  textoGuardado('Escribiendo…');
  clearTimeout(esperaTexto);
  esperaTexto = setTimeout(() => guardar({ texto: $('respuesta-abierta').value }), 1200);
});

$('form-pregunta').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (terminado) return;
  const ultima = actual.posicion + 1 === actual.total;
  const datos = respuestaEnPantalla();
  const sinRespuesta = actual.pregunta.tipo === 'ABIERTA' ? !datos.texto.trim() : !datos.opcion_id;
  if (sinRespuesta && !confirmar('No has respondido esta pregunta y no podrás regresar. ¿Continuar de todos modos?')) return;
  if (ultima && !confirmar('Es la última pregunta. ¿Enviar el examen? Ya no podrás cambiar tus respuestas.')) return;

  clearTimeout(esperaTexto);
  $('avanzar').disabled = true;
  await colaGuardado;
  try {
    const r = await api('POST', `/api/alumno/intentos/${intentoId}/avanzar`, { pregunta_id: actual.pregunta.id, ...datos });
    if (r.estado === 'ENVIADO') return mostrarFin(false);
    await cargar();
  } catch (err) {
    if (err.cuerpo?.estado) return cerradoPorServidor(err.cuerpo);
    if (err.http === 409) return cargar(); // la pregunta ya avanzó (p. ej. doble clic): mostrar la actual
    textoGuardado(`No se pudo continuar: ${err.message}`, true);
    $('avanzar').disabled = false;
  }
});

if (intentoId) {
  vigilar();
  cargar();
  resincronizar = setInterval(() => { if (!terminado) cargar(); }, RESINCRONIZAR_MS);
} else {
  fallo('Falta indicar el examen. Vuelve a tu panel y elige uno.');
}

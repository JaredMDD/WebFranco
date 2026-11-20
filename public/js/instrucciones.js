// Pantalla de instrucciones y aceptación explícita de reglas (RF-21, CU-22).
const examenId = Number(new URLSearchParams(location.search).get('examen'));
const acepto = $('acepto');
const comenzar = $('comenzar');
const minutos = (n) => `${n} ${n === 1 ? 'minuto' : 'minutos'}`;

acepto.addEventListener('change', () => { comenzar.disabled = !acepto.checked; });

async function cargar() {
  let e;
  try {
    e = await api('GET', `/api/alumno/examenes/${examenId}`);
  } catch (err) {
    $('meta').textContent = '';
    return mostrar($('error-reglas'), err.message);
  }
  document.title = `${e.titulo} · Antes de comenzar`;
  const extra = e.tiempo_extra ? ` (+${e.tiempo_extra} de tiempo extra)` : '';
  $('meta').textContent = `${e.titulo} · ${e.preguntas} ${e.preguntas === 1 ? 'pregunta' : 'preguntas'} · ${minutos(e.duracion_min)}${extra}`;
  $('umbral').textContent = minutos(e.umbral_inactividad_min);
  $('regla-calculadora').classList.toggle('d-none', !e.permite_herramienta);
  if (e.instrucciones) {
    $('instrucciones-docente').textContent = e.instrucciones;
    $('bloque-instrucciones').classList.remove('d-none');
  }

  // Un intento abierto se retoma; uno cerrado o fuera de ventana no permite entrar (RF-22).
  if (e.intento_id && ['EN_CURSO', 'REABIERTO'].includes(e.intento_estado)) {
    location.replace(`/alumno/examen.html?intento=${e.intento_id}`);
    return;
  }
  if (e.intento_id) return mostrar($('error-reglas'), 'Ya presentaste este examen. Solo hay una oportunidad.');
  if (!e.abierto) {
    const cuando = new Date() < new Date(e.abre_en) ? `Abre el ${formatoFechaHora.format(new Date(e.abre_en))}.` : 'Su ventana ya cerró.';
    return mostrar($('error-reglas'), `El examen no está disponible en este momento. ${cuando}`);
  }
  $('bloque-reglas').classList.remove('d-none');
  comenzar.classList.remove('d-none');
}

$('form-reglas').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!acepto.checked) return;
  mostrar($('error-reglas'), '');
  comenzar.disabled = true;
  try {
    const { intento_id: intentoId } = await api('POST', `/api/alumno/examenes/${examenId}/iniciar`, { acepto: true });
    location.replace(`/alumno/examen.html?intento=${intentoId}`);
  } catch (err) {
    mostrar($('error-reglas'), err.message);
    comenzar.disabled = false;
  }
});

if (examenId) cargar();
else mostrar($('error-reglas'), 'Falta indicar el examen. Vuelve a tu panel y elige uno.');

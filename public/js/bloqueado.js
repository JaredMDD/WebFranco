// Examen anulado o abandonado: motivo claro para el alumno (RF-28 · CU-27 paso 4).
const MOTIVOS = {
  CAMBIO_PESTANA: 'Saliste de la pestaña o de la ventana del examen.',
  INACTIVIDAD: 'No hubo actividad durante más tiempo del permitido.',
  SESION_DUPLICADA: 'Se inició sesión con tu cuenta en otro dispositivo o navegador.',
  CONEXION_PERDIDA: 'Se perdió la conexión con el servidor y no se recuperó a tiempo.',
};
const fallo = (texto) => { $('cargando').classList.add('d-none'); mostrar($('error'), texto); };
const intentoId = Number(new URLSearchParams(location.search).get('intento'));

async function cargar() {
  let i;
  try {
    i = await api('GET', `/api/alumno/intentos/${intentoId}`);
  } catch (err) {
    return fallo(err.message);
  }
  if (['EN_CURSO', 'REABIERTO'].includes(i.estado)) return location.replace(`/alumno/examen.html?intento=${intentoId}`);
  if (!['ANULADO', 'ABANDONADO'].includes(i.estado)) return location.replace('/alumno/panel.html');

  const anulado = i.estado === 'ANULADO';
  // Tras la revisión, la anulación confirmada es definitiva (RF-33).
  $('pildora').textContent = i.plagio_confirmado ? 'Anulado: confirmado por tu docente' : anulado ? 'Bloqueado: en revisión del docente' : 'Abandonado';
  $('pildora').classList.add(anulado ? 'estado-aviso' : 'estado-peligro');
  $('t-bloqueado').textContent = anulado ? 'Tu examen fue anulado' : 'Tu examen se marcó como abandonado';
  $('titulo-examen').textContent = i.titulo;
  // La evidencia se borra a la semana (RF-37): sin ella no hay motivo ni fecha que mostrar.
  $('motivo').textContent = i.incidente ? MOTIVOS[i.incidente.tipo] : 'El registro del incidente ya no está disponible.';
  document.querySelectorAll('.fila-fecha').forEach((e) => e.classList.toggle('d-none', !i.incidente));
  if (i.incidente) $('fecha').textContent = formatoFechaHora.format(new Date(i.incidente.ocurrio_en));
  if (i.plagio_confirmado) $('que-sigue').textContent = 'Tu docente revisó el incidente y confirmó la anulación. Si tienes dudas, coméntalas directamente con tu docente.';
  $('respuestas').textContent = `Se guardaron ${i.respondidas} de ${i.total} respuestas.`;
  $('cargando').classList.add('d-none');
  $('tarjeta').classList.remove('d-none');
  $('t-bloqueado').focus();
}

if (intentoId) cargar();
else fallo('Falta indicar el examen. Vuelve a tu panel.');

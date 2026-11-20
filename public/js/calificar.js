// Calificación manual de abiertas y publicación de resultados (RF-17, RF-29, RF-39 · CU-15, CU-16).
const examenId = Number(new URLSearchParams(location.search).get('examen'));
let examen = null;
let elegido = null; // intento en pantalla
const numero = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

function pildora(i) {
  const p = (texto, clase) => el('span', { texto, clase: `badge rounded-pill estado ${clase}` });
  if (i.estado === 'ENVIADO') {
    if (i.pendientes) return p(`${i.pendientes} por calificar`, 'estado-aviso');
    return i.publicado ? p('Publicado', 'estado-exito') : p('Calificado', 'estado-exito');
  }
  return {
    EN_CURSO: p('Presentando', 'estado-neutro'), REABIERTO: p('Reabierto', 'estado-neutro'), ABANDONADO: p('Abandonado', 'estado-peligro'),
    ANULADO: p(i.plagio_confirmado ? 'Plagio confirmado' : 'En revisión', 'estado-aviso'),
  }[i.estado];
}

async function cargarExamen() {
  try {
    examen = await api('GET', `/api/docente/examenes/${examenId}/calificar`);
  } catch (err) {
    return mostrar($('error'), err.message);
  }
  $('titulo-examen').textContent = examen.titulo;
  $('nota-publicar').textContent = `Al publicar, los alumnos con examen enviado verán su calificación${examen.mostrar_respuestas ? ', las respuestas correctas y tus comentarios' : ''}.`;
  $('publicar').disabled = !examen.intentos.some((i) => i.estado === 'ENVIADO' && !i.publicado);
  const lista = $('lista-alumnos');
  if (!examen.intentos.length) return lista.replaceChildren(el('p', { texto: 'Nadie ha presentado este examen todavía.', clase: 'text-suave mb-0' }));
  lista.replaceChildren(...examen.intentos.map((i) => {
    const activo = elegido?.id === i.id;
    const fila = el('button', {
      clase: `list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2${activo ? ' active' : ''}`,
      atributos: { type: 'button', ...(activo && { 'aria-current': 'true' }) },
    }, el('span', { texto: i.alumno, clase: 'text-break' }), pildora(i));
    // Solo los enviados se califican; los demás se atienden en "En revisión" o siguen presentando.
    if (i.estado === 'ENVIADO') fila.addEventListener('click', () => elegir(i.id));
    else fila.disabled = true;
    return fila;
  }));
}

async function elegir(intentoId) {
  mostrar($('error-calificar'), '');
  let d;
  try {
    d = await api('GET', `/api/docente/intentos/${intentoId}/respuestas`);
  } catch (err) {
    return mostrar($('error'), err.message);
  }
  elegido = d;
  await cargarExamen(); // marca la fila activa
  $('t-respuestas').textContent = `${d.alumno} · Preguntas abiertas`;
  const cerradas = d.preguntas.filter((p) => p.tipo !== 'ABIERTA');
  const suma = (lista, campo) => lista.reduce((a, p) => a + (p[campo] || 0), 0);
  $('resumen-cerradas').textContent = cerradas.length
    ? `Preguntas cerradas (automático): ${numero(suma(cerradas, 'puntos_obtenidos'))} / ${numero(suma(cerradas, 'puntos'))} puntos`
    : 'Este examen no tiene preguntas cerradas.';
  const abiertas = d.preguntas.filter((p) => p.tipo === 'ABIERTA');
  $('abiertas').replaceChildren(...(abiertas.length ? abiertas.map((p, n) => {
    const b = $('tpl-abierta').content.firstElementChild.cloneNode(true);
    b.dataset.pregunta = p.pregunta_id;
    b.querySelector('.enunciado').textContent = p.enunciado;
    b.querySelector('.valor').textContent = `(${numero(p.puntos)} pts)`;
    const respondida = Boolean(p.texto_respuesta?.trim());
    const r = b.querySelector('.respuesta');
    r.textContent = respondida ? p.texto_respuesta : 'Sin respuesta.';
    r.classList.toggle('text-suave', !respondida);
    const puntos = b.querySelector('.puntos');
    puntos.id = `pts-${n}`;
    puntos.max = p.puntos;
    puntos.value = p.puntos_obtenidos ?? '';
    b.querySelector('.etiqueta-puntos').htmlFor = puntos.id;
    const comentario = b.querySelector('.comentario');
    comentario.id = `com-${n}`;
    comentario.value = p.comentario ?? '';
    b.querySelector('.etiqueta-comentario').htmlFor = comentario.id;
    return b;
  }) : [el('p', { texto: 'Este examen no tiene preguntas abiertas: se calificó automáticamente.', clase: 'text-suave' })]));
  $('form-calificar').querySelector('[type=submit]').classList.toggle('d-none', !abiertas.length);
  $('calificacion').textContent = d.calificacion ?? '—';
  $('sin-elegir').classList.add('d-none');
  $('form-calificar').classList.remove('d-none');
  $('t-respuestas').focus();
}

$('form-calificar').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  mostrar($('error-calificar'), '');
  mostrar($('aviso'), '');
  const calificaciones = [...$('abiertas').querySelectorAll('[data-pregunta]')]
    .filter((b) => b.querySelector('.puntos').value !== '')
    .map((b) => ({ pregunta_id: Number(b.dataset.pregunta), puntos: Number(b.querySelector('.puntos').value), comentario: b.querySelector('.comentario').value }));
  if (!calificaciones.length) return mostrar($('error-calificar'), 'Escribe los puntos de al menos una pregunta.');
  enviando(form, async () => {
    try {
      const r = await api('PUT', `/api/docente/intentos/${elegido.id}/calificacion`, { calificaciones });
      $('calificacion').textContent = r.calificacion ?? '—';
      mostrar($('aviso'), `Calificación de ${elegido.alumno} guardada: ${r.calificacion} / 10.`);
      await cargarExamen();
    } catch (err) {
      mostrar($('error-calificar'), err.message);
    }
  });
});

$('publicar').addEventListener('click', async () => {
  if (!confirm('¿Publicar los resultados? Los alumnos verán su calificación en su panel.')) return;
  mostrar($('error'), '');
  mostrar($('aviso'), '');
  $('publicar').disabled = true;
  try {
    const r = await api('POST', `/api/docente/examenes/${examenId}/publicar`);
    mostrar($('aviso'), `Resultados publicados: ${r.publicados} ${r.publicados === 1 ? 'alumno' : 'alumnos'}.`);
  } catch (err) {
    mostrar($('error'), err.message);
  }
  await cargarExamen();
});

if (examenId) cargarExamen();
else mostrar($('error'), 'Falta indicar el examen. Vuelve a tu panel y elige uno.');

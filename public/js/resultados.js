// Resultados publicados del alumno (RF-29 · CU-24); el detalle solo si el docente lo permite (RF-17).
const intentoId = Number(new URLSearchParams(location.search).get('intento'));
const numero = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));
const ver = (id) => $(id).classList.remove('d-none');

function fallo(texto) {
  $('cargando').classList.add('d-none');
  mostrar($('error'), texto);
  ver('volver-error');
}

function pregunta(p, n) {
  const obtenidos = p.puntos_obtenidos ?? 0;
  const [estado, clase] = p.tipo === 'ABIERTA' ? ['Abierta', 'estado-neutro']
    : obtenidos > 0 ? ['Correcta', 'estado-exito'] : ['Incorrecta', 'estado-peligro'];
  const respuesta = p.tipo === 'ABIERTA' ? p.texto_respuesta?.trim() : p.opcion_elegida;
  const li = el('li', { clase: 'border-bottom pb-3' },
    el('div', { clase: 'd-flex justify-content-between gap-2' },
      el('strong', { texto: `${n + 1}. ${p.enunciado}`, atributos: { style: 'white-space: pre-line' } }),
      el('span', { texto: `${estado} · ${numero(obtenidos)}/${numero(p.puntos)}`, clase: `badge rounded-pill estado ${clase} align-self-start text-nowrap` })),
    el('div', { texto: `Tu respuesta: ${respuesta || 'sin respuesta'}`, clase: 'small mt-1', atributos: { style: 'white-space: pre-line' } }));
  if (p.tipo !== 'ABIERTA' && p.opcion_elegida !== p.opcion_correcta) li.append(el('div', { texto: `Correcta: ${p.opcion_correcta}`, clase: 'small mt-1' }));
  if (p.comentario) li.append(el('div', { texto: `Comentario del docente: ${p.comentario}`, clase: 'small mt-1 text-suave' }));
  return li;
}

async function cargar() {
  let r;
  try {
    r = await api('GET', `/api/alumno/intentos/${intentoId}/resultado`);
  } catch (err) {
    return fallo(err.message);
  }
  document.title = `Resultados: ${r.titulo} · Plataforma de exámenes`;
  $('t-resultado').textContent = r.titulo;
  $('meta').textContent = `Presentado el ${formatoFecha.format(new Date(r.fin_en))} · ${r.total} ${r.total === 1 ? 'pregunta' : 'preguntas'}`;
  $('calificacion').textContent = r.calificacion ?? '—';
  $('cargando').classList.add('d-none');
  ver('resumen');
  if (r.preguntas) {
    $('preguntas').replaceChildren(...r.preguntas.map(pregunta));
    $('preguntas').lastElementChild?.classList.remove('border-bottom', 'pb-3');
    ver('detalle');
  } else {
    ver('sin-detalle');
  }
  ver('volver');
  $('t-resultado').focus();
}

if (intentoId) cargar();
else fallo('Falta indicar el examen. Vuelve a tu panel.');

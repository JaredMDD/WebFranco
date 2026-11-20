// Reportes de un examen propio: calificaciones, incidentes y estadísticas; exportación a Excel y PDF (RF-43 a RF-45 · CU-17).
const ESTADO_ALUMNO = {
  NO_PRESENTADO: 'No presentado', EN_CURSO: 'En curso', REABIERTO: 'Reabierto', ENVIADO: 'Enviado',
  ANULADO: 'Anulado (en revisión)', ANULADO_CONFIRMADO: 'Anulado (plagio confirmado)', ABANDONADO: 'Abandonado',
};
const DECISION = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Plagio confirmado', DESCARTADO: 'Descartado' };
const nota = (n) => (n === null ? '—' : n.toFixed(2));
const celda = (etiqueta, contenido, atributos = {}) => el('td', { atributos: { 'data-label': etiqueta, ...atributos } }, contenido);

function exportar(id) {
  for (const ext of ['excel', 'pdf']) {
    const a = $(ext);
    a.href = `/api/docente/examenes/${id}/reporte.${ext === 'excel' ? 'xlsx' : 'pdf'}`;
    a.classList.remove('disabled');
    a.removeAttribute('aria-disabled');
  }
}

async function cargarReporte(id) {
  mostrar($('error'), '');
  let r;
  try {
    r = await api('GET', `/api/docente/examenes/${id}/reporte`);
  } catch (err) {
    return mostrar($('error'), err.message);
  }
  exportar(id);
  history.replaceState(null, '', `?examen=${id}`);

  $('tabla-cal').replaceChildren(...(r.calificaciones.length ? r.calificaciones.map((c) => el('tr', {},
    celda('Alumno', c.alumno), celda('Grupo', c.grupos || '—'), celda('Estado', ESTADO_ALUMNO[c.estado]),
    celda('Calificación', nota(c.calificacion)), celda('Publicado', c.publicado ? 'Sí' : 'No'),
  )) : [filaVacia(5, 'El examen no tiene grupos asignados.')]));

  $('tabla-inc').replaceChildren(...(r.incidentes.length ? r.incidentes.map((i) => el('tr', {},
    celda('Alumno', i.alumno), celda('Tipo', NOMBRE_INCIDENTE[i.tipo]), celda('Fecha y hora', formatoFechaHora.format(new Date(i.ocurrio_en))),
    celda('IP', i.ip), celda('Dispositivo', el('span', { texto: i.dispositivo_resumen, atributos: { title: i.dispositivo } })),
    celda('Decisión', DECISION[i.decision]),
  )) : [filaVacia(6, 'Sin incidentes vigentes.')]));

  const s = r.estadisticas;
  $('est-promedio').textContent = s.promedio === null ? '—' : s.promedio.toFixed(2);
  $('est-aprobados').textContent = `${s.aprobados} / ${s.calificados}`;
  $('est-extremos').textContent = s.calificados ? `${nota(s.maxima)} / ${nota(s.minima)}` : '—';
  $('est-incidentes').textContent = String(s.incidentes);
  $('est-nota').textContent = `Sobre ${s.calificados} exámenes enviados de ${s.asignados} alumnos asignados (${s.no_presentados} no lo presentaron). Aprobatoria: 7. Las abiertas sin calificar cuentan 0.`;
  $('tabla-dist').replaceChildren(...s.distribucion.map((d) => {
    const pct = s.calificados ? Math.round((d.alumnos / s.calificados) * 100) : 0;
    const barra = el('div', { clase: 'progress-bar' });
    barra.style.width = `${pct}%`;
    return el('tr', {}, el('td', { texto: d.rango }), el('td', { texto: String(d.alumnos) }),
      el('td', {}, el('div', { clase: 'progress', atributos: { role: 'progressbar', 'aria-label': `${d.rango}: ${pct}%`, 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 } }, barra)));
  }));
  $('reporte').classList.remove('d-none');
}

async function iniciar() {
  const selector = $('examen');
  let examenes;
  try {
    examenes = (await api('GET', '/api/docente/examenes')).filter((e) => e.estado !== 'BORRADOR');
  } catch (err) {
    return mostrar($('error'), err.message);
  }
  if (!examenes.length) {
    selector.replaceChildren(el('option', { texto: 'Aún no tienes exámenes programados' }));
    return;
  }
  selector.replaceChildren(...examenes.map((e) => el('option', { texto: e.titulo, atributos: { value: e.id } })));
  const pedido = new URLSearchParams(location.search).get('examen');
  if (examenes.some((e) => String(e.id) === pedido)) selector.value = pedido;
  selector.disabled = false;
  selector.addEventListener('change', () => cargarReporte(selector.value));
  cargarReporte(selector.value);
}

iniciar();

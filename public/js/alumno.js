// Panel del alumno: inscripción por código y sus grupos (CU-20, RF-09).
async function cargarGrupos() {
  const lista = $('lista-grupos');
  try {
    const grupos = await api('GET', '/api/alumno/grupos');
    lista.replaceChildren(...(grupos.length
      ? grupos.map((g) => el('li', {}, el('span', {
        texto: `${g.materia} · ${g.grupo}`,
        clase: 'badge rounded-pill estado estado-neutro',
        atributos: { title: `Docente: ${g.docente}` },
      })))
      : [el('li', { texto: 'Aún no estás inscrito en ningún grupo.', clase: 'text-suave small' })]));
  } catch (err) {
    lista.replaceChildren(el('li', { texto: err.message, clase: 'text-danger small' }));
  }
}

// Estado del examen para el alumno: acción disponible o situación de su intento (RF-20, CU-21).
function estadoExamen(e) {
  const pildora = (texto, clase) => el('span', { texto, clase: `badge rounded-pill estado ${clase}` });
  const boton = (texto, href) => el('a', { texto, clase: 'btn btn-primary btn-sm', atributos: { href } });
  switch (e.intento_estado) {
    case 'EN_CURSO':
    case 'REABIERTO':
      return boton('Continuar', `/alumno/examen.html?intento=${e.intento_id}`);
    case 'ENVIADO':
      if (!e.publicado) return pildora('Enviado: pendiente de calificación', 'estado-neutro');
      return boton(`Ver resultado: ${e.calificacion ?? '—'}`, `/alumno/resultados.html?intento=${e.intento_id}`); // RF-29
    case 'ANULADO':
    case 'ABANDONADO': // enlace al motivo (RF-28)
      return el('a', {
        texto: e.intento_estado === 'ABANDONADO' ? 'Abandonado: ver motivo' : e.plagio_confirmado ? 'Anulado: ver motivo' : 'Bloqueado: ver motivo',
        clase: `badge rounded-pill estado text-decoration-none ${e.intento_estado === 'ANULADO' ? 'estado-aviso' : 'estado-peligro'}`,
        atributos: { href: `/alumno/bloqueado.html?intento=${e.intento_id}` },
      });
    default:
      if (e.disponibilidad === 'ABIERTO') return boton('Presentar', `/alumno/instrucciones.html?examen=${e.id}`);
      return pildora(e.disponibilidad === 'PENDIENTE' ? 'Aún no disponible' : 'Cerrado', 'estado-neutro');
  }
}

async function cargarExamenes() {
  const cuerpo = $('tabla-examenes');
  try {
    const examenes = await api('GET', '/api/alumno/examenes');
    if (!examenes.length) return cuerpo.replaceChildren(filaVacia(4, 'Tus exámenes aparecerán aquí cuando tu docente los asigne a uno de tus grupos.'));
    cuerpo.replaceChildren(...examenes.map((e) => {
      const disponibilidad = { PENDIENTE: `Abre ${formatoFechaHora.format(new Date(e.abre_en))}`, ABIERTO: `Hasta ${formatoFechaHora.format(new Date(e.cierra_en))}`, CERRADO: 'Cerrado' }[e.disponibilidad];
      const duracion = `${e.duracion_min} min${e.tiempo_extra ? ` (+${e.tiempo_extra})` : ''}`;
      return el('tr', {},
        el('td', { atributos: { 'data-label': 'Examen' } }, e.titulo, el('div', { texto: e.materia, clase: 'small text-suave fw-normal' })),
        el('td', { texto: disponibilidad, atributos: { 'data-label': 'Disponibilidad' } }),
        el('td', { texto: duracion, atributos: { 'data-label': 'Duración' } }),
        el('td', { atributos: { 'data-label': 'Estado' } }, estadoExamen(e)),
      );
    }));
  } catch (err) {
    cuerpo.replaceChildren(filaVacia(4, err.message));
  }
}

$('form-inscribir').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  mostrar($('error-inscribir'), '');
  mostrar($('aviso-inscribir'), '');
  enviando(form, async () => {
    try {
      const g = await api('POST', '/api/alumno/inscripciones', { codigo: form.codigo.value });
      form.reset();
      mostrar($('aviso-inscribir'), `Listo: te inscribiste en ${g.materia} · ${g.grupo}.`);
      await Promise.all([cargarGrupos(), cargarExamenes()]);
    } catch (err) {
      mostrar($('error-inscribir'), err.message);
    }
  });
});

cargarGrupos();
cargarExamenes();

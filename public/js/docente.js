// Panel del docente: materias, grupos con código de inscripción y lista de exámenes (CU-07, RF-07, RF-08).
const modalAlumnos = new bootstrap.Modal($('modal-alumnos'));
const ESTADOS_EXAMEN = { BORRADOR: ['Borrador', 'estado-neutro'], PROGRAMADO: ['Programado', 'estado-exito'], CERRADO: ['Cerrado', 'estado-neutro'] };
let materias = [];

const boton = (texto, alClic) => {
  const b = el('button', { texto, clase: 'btn btn-outline-primary btn-sm', atributos: { type: 'button' } });
  b.addEventListener('click', () => alClic(b));
  return b;
};
// Acción secundaria dentro de una celda, con aspecto de enlace (el nombre accesible da el contexto completo).
const enlace = (texto, etiquetaAccesible, alClic) => {
  const b = el('button', { texto, clase: 'btn btn-link btn-sm px-1', atributos: { type: 'button', 'aria-label': etiquetaAccesible } });
  b.addEventListener('click', () => alClic(b));
  return b;
};
const celda = (etiqueta, contenido, clase) => el('td', { clase, atributos: { 'data-label': etiqueta } }, contenido);

async function cargarMaterias() {
  mostrar($('error-grupos'), '');
  try {
    materias = await api('GET', '/api/docente/materias');
  } catch (err) {
    $('tabla-grupos').replaceChildren(filaVacia(6, 'No se pudo cargar la lista.'));
    return mostrar($('error-grupos'), err.message);
  }

  // Selector de materia del formulario "Nuevo grupo"
  const selector = $('grupo-materia');
  const elegida = selector.value;
  selector.replaceChildren(...(materias.length
    ? materias.map((m) => el('option', { texto: m.nombre, atributos: { value: m.id } }))
    : [el('option', { texto: 'Primero crea una materia', atributos: { value: '' } })]));
  selector.disabled = !materias.length;
  if (materias.some((m) => String(m.id) === elegida)) selector.value = elegida;

  if (!materias.length) return $('tabla-grupos').replaceChildren(filaVacia(6, 'Aún no tienes materias. Crea la primera con el formulario.'));

  const filas = [];
  for (const m of materias) {
    if (!m.grupos.length) {
      filas.push(el('tr', {},
        celda('Materia', m.nombre),
        celda('Grupo', el('span', { texto: 'Sin grupos aún', clase: 'text-suave' })),
        celda('Código', '—'), celda('Alumnos', '—'), celda('Estado', '—'),
        celda('Acciones', boton('Eliminar materia', (b) => eliminarMateria(m, b)), 'text-nowrap'),
      ));
      continue;
    }
    for (const g of m.grupos) {
      filas.push(el('tr', {},
        celda('Materia', m.nombre),
        celda('Grupo', g.nombre),
        celda('Código', el('span', { clase: 'd-inline-flex align-items-center gap-1' },
          el('code', { texto: g.codigo, clase: 'fs-6' }),
          enlace('Copiar', `Copiar el código ${g.codigo}`, (b) => copiarCodigo(g.codigo, b))), 'text-nowrap'),
        celda('Alumnos', ((t) => enlace(t, `${t}: ver la lista de ${m.nombre} · ${g.nombre}`, () => verAlumnos(m, g)))(g.alumnos === 1 ? '1 alumno' : `${g.alumnos} alumnos`), 'text-nowrap'),
        celda('Estado', el('span', { texto: g.activo ? 'Activo' : 'Inactivo', clase: `badge rounded-pill estado ${g.activo ? 'estado-exito' : 'estado-neutro'}` })),
        celda('Acciones', boton(g.activo ? 'Desactivar' : 'Activar', (b) => cambiarActivo(g, b)), 'text-nowrap'),
      ));
    }
  }
  $('tabla-grupos').replaceChildren(...filas);
}

async function copiarCodigo(codigo, b) {
  try {
    await navigator.clipboard.writeText(codigo);
    b.textContent = 'Copiado';
    $('aviso-grupos').textContent = `Código ${codigo} copiado.`;
    setTimeout(() => { b.textContent = 'Copiar'; }, 2000);
  } catch {
    mostrar($('error-grupos'), `No se pudo copiar. El código es ${codigo}.`);
  }
}

async function cambiarActivo(grupo, b) {
  if (grupo.activo && !confirm(`¿Desactivar el grupo ${grupo.nombre}? Ya no aceptará inscripciones nuevas; los alumnos inscritos se conservan.`)) return;
  b.disabled = true;
  try {
    await api('PATCH', `/api/docente/grupos/${grupo.id}`, { activo: !grupo.activo });
    await cargarMaterias();
  } catch (err) {
    b.disabled = false;
    mostrar($('error-grupos'), err.message);
  }
}

async function eliminarMateria(materia, b) {
  if (!confirm(`¿Eliminar la materia ${materia.nombre}?`)) return;
  b.disabled = true;
  try {
    await api('DELETE', `/api/docente/materias/${materia.id}`);
    await cargarMaterias();
  } catch (err) {
    b.disabled = false;
    mostrar($('error-grupos'), err.message);
  }
}

async function verAlumnos(materia, grupo) {
  $('t-alumnos').textContent = `Alumnos inscritos · ${materia.nombre} · ${grupo.nombre}`;
  const lista = $('lista-alumnos');
  lista.replaceChildren(el('li', { texto: 'Cargando…', clase: 'list-group-item text-suave' }));
  modalAlumnos.show();
  try {
    const alumnos = await api('GET', `/api/docente/grupos/${grupo.id}/alumnos`);
    lista.replaceChildren(...(alumnos.length
      ? alumnos.map((a) => el('li', { clase: 'list-group-item d-flex justify-content-between gap-3' },
        el('span', { texto: a.nombre_usuario }),
        el('span', { texto: `desde ${formatoFecha.format(new Date(a.creado_en))}`, clase: 'text-suave small' })))
      : [el('li', { texto: `Nadie se ha inscrito todavía. Comparte el código ${grupo.codigo}.`, clase: 'list-group-item text-suave' })]));
  } catch (err) {
    lista.replaceChildren(el('li', { texto: err.message, clase: 'list-group-item text-danger' }));
  }
}

// Estado visible: un examen programado se muestra abierto o cerrado según su ventana.
function estadoVisible(e) {
  if (e.estado !== 'PROGRAMADO') return ESTADOS_EXAMEN[e.estado] || [e.estado, 'estado-neutro'];
  const ahora = Date.now();
  if (ahora >= new Date(e.cierra_en)) return ['Cerrado', 'estado-neutro'];
  if (ahora >= new Date(e.abre_en)) return ['Abierto', 'estado-exito'];
  return ['Programado', 'estado-exito'];
}

async function eliminarExamen(examen, b) {
  if (!confirm(`¿Eliminar el examen «${examen.titulo}»? Se borran sus preguntas.`)) return;
  b.disabled = true;
  try {
    await api('DELETE', `/api/docente/examenes/${examen.id}`);
    await cargarExamenes();
  } catch (err) {
    b.disabled = false;
    mostrar($('error-examenes'), err.message);
  }
}

async function cargarExamenes() {
  const cuerpo = $('tabla-examenes');
  try {
    const examenes = await api('GET', '/api/docente/examenes');
    if (!examenes.length) return cuerpo.replaceChildren(filaVacia(5, 'Aún no tienes exámenes. Crea el primero con «Nuevo examen».'));
    cuerpo.replaceChildren(...examenes.map((e) => {
      const [texto, clase] = estadoVisible(e);
      const ventana = e.abre_en && e.cierra_en
        ? `${formatoFechaHora.format(new Date(e.abre_en))} – ${formatoFechaHora.format(new Date(e.cierra_en))}`
        : 'Sin definir';
      const acciones = el('span', { clase: 'd-inline-flex gap-1' },
        el('a', { texto: e.intentos ? 'Consultar' : 'Editar', clase: 'btn btn-outline-primary btn-sm', atributos: { href: `/docente/examen-editar.html?id=${e.id}` } }));
      if (!e.intentos) acciones.append(boton('Eliminar', (b) => eliminarExamen(e, b)));
      else acciones.append(el('a', { texto: 'Calificar', clase: 'btn btn-primary btn-sm', atributos: { href: `/docente/calificar.html?examen=${e.id}` } })); // CU-15
      return el('tr', {},
        celda('Examen', e.titulo),
        celda('Ventana', ventana),
        celda('Grupos', e.grupos || '—'),
        celda('Estado', el('span', { texto, clase: `badge rounded-pill estado ${clase}` })),
        celda('Acciones', acciones, 'text-nowrap'),
      );
    }));
  } catch (err) {
    cuerpo.replaceChildren(filaVacia(5, err.message));
  }
}

if (new URLSearchParams(location.search).has('programado')) {
  mostrar($('aviso-examenes'), 'Examen programado. Los alumnos de los grupos asignados lo verán en su panel.');
  history.replaceState(null, '', location.pathname);
}

$('form-materia').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  mostrar($('error-materia'), '');
  enviando(form, async () => {
    try {
      const m = await api('POST', '/api/docente/materias', { nombre: form.nombre.value });
      form.reset();
      await cargarMaterias();
      $('grupo-materia').value = m.id; // lista para crearle su primer grupo
      $('grupo-nombre').focus();
    } catch (err) {
      mostrar($('error-materia'), err.message);
    }
  });
});

$('form-grupo').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  mostrar($('error-grupo'), '');
  enviando(form, async () => {
    try {
      const g = await api('POST', '/api/docente/grupos', { materia_id: Number(form.materia_id.value), nombre: form.nombre.value });
      form.nombre.value = '';
      await cargarMaterias();
      $('aviso-grupos').textContent = `Grupo ${g.nombre} creado con el código ${g.codigo}.`;
    } catch (err) {
      mostrar($('error-grupo'), err.message);
    }
  });
});

cargarMaterias();
cargarExamenes();

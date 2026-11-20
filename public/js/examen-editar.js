// Editor de examen: datos, configuración, preguntas, grupos y tiempo extra (CU-08 a CU-11 · RF-10 a RF-18).
let examenId = Number(new URLSearchParams(location.search).get('id')) || null;
let tiemposExtra = []; // [{ alumno_id, nombre_usuario, minutos }]
let alumnosDisponibles = new Map(); // alumno_id → nombre_usuario (inscritos en los grupos marcados)
let bloqueado = false;
let sucio = false;
let contador = 0;
const ETIQUETAS = { OPCION_MULTIPLE: 'Opción múltiple', VERDADERO_FALSO: 'Verdadero / falso', ABIERTA: 'Abierta' };
const ESTADOS = { BORRADOR: ['Borrador', 'estado-neutro'], PROGRAMADO: ['Programado', 'estado-exito'], CERRADO: ['Cerrado', 'estado-neutro'] };
const form = $('form-examen');

// datetime-local trabaja en hora local sin zona; el servidor guarda instantes (ISO con zona).
const aLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const aISO = (v) => (v ? new Date(v).toISOString() : null);
const marcarSucio = () => { sucio = true; };

// Da un id único al campo de una plantilla y lo enlaza con su <label>.
function enlazar(nodo, clase, id) {
  nodo.querySelector(`.${clase}`).id = id;
  nodo.querySelector(`.${clase}-label`).htmlFor = id;
}

function renumerarOpciones(bloque) {
  bloque.querySelectorAll('.opcion').forEach((op, i) => {
    op.querySelector('.opcion-correcta').setAttribute('aria-label', `La opción ${i + 1} es la correcta`);
    op.querySelector('.opcion-texto').setAttribute('aria-label', `Texto de la opción ${i + 1}`);
    op.querySelector('.opcion-quitar').setAttribute('aria-label', `Quitar la opción ${i + 1}`);
  });
}

function agregarOpcion(bloque, texto = '', correcta = false) {
  const op = $('tpl-opcion').content.firstElementChild.cloneNode(true);
  const radio = op.querySelector('.opcion-correcta');
  radio.name = `correcta-${bloque.dataset.uid}`;
  radio.checked = correcta;
  op.querySelector('.opcion-texto').value = texto;
  op.querySelector('.opcion-quitar').addEventListener('click', () => {
    if (bloque.querySelectorAll('.opcion').length <= 2) return; // mínimo 2 opciones
    op.remove();
    renumerarOpciones(bloque);
    marcarSucio();
  });
  bloque.querySelector('.lista-opciones').append(op);
  renumerarOpciones(bloque);
  return op;
}

function renumerar() {
  const bloques = [...document.querySelectorAll('.pregunta')];
  bloques.forEach((b, i) => {
    b.querySelector('.pregunta-titulo').textContent = `${i + 1} · ${ETIQUETAS[b.dataset.tipo]}`;
    b.querySelector('.pregunta-quitar').setAttribute('aria-label', `Quitar la pregunta ${i + 1}`);
  });
  $('sin-preguntas').classList.toggle('d-none', bloques.length > 0);
  const puntos = bloques.reduce((s, b) => s + (Number(b.querySelector('.campo-puntos').value) || 0), 0);
  $('resumen-preguntas').textContent = bloques.length
    ? `${bloques.length} ${bloques.length === 1 ? 'pregunta' : 'preguntas'} · ${puntos} ${puntos === 1 ? 'punto' : 'puntos'}`
    : '';
}

function mostrarImagen(bloque, ruta) {
  bloque.dataset.imagen = ruta;
  const vista = bloque.querySelector('.imagen-vista');
  let img = vista.querySelector('img');
  if (!img) {
    img = el('img', { clase: 'imagen-pregunta d-block mb-2', atributos: { alt: 'Imagen de la pregunta', style: 'max-height: 200px' } });
    vista.prepend(img);
  }
  img.src = `/api/imagenes/${encodeURIComponent(ruta)}`;
  vista.classList.remove('d-none');
}

async function subirImagen(bloque, input) {
  const error = bloque.querySelector('.imagen-error');
  error.textContent = '';
  const archivo = input.files[0];
  if (!archivo) return;
  if (archivo.size > 2 * 1024 * 1024) {
    error.textContent = 'La imagen pesa más de 2 MB.';
    input.value = '';
    return;
  }
  const datos = new FormData();
  datos.append('imagen', archivo);
  let cuerpo;
  try {
    cuerpo = await (await fetch('/api/imagenes', { method: 'POST', body: datos })).json();
  } catch {
    cuerpo = { ok: false, error: 'No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.' };
  }
  if (cuerpo.ok) {
    mostrarImagen(bloque, cuerpo.data.ruta);
    marcarSucio();
  } else {
    error.textContent = cuerpo.error;
  }
  input.value = '';
}

function agregarPregunta(p) {
  const uid = ++contador;
  const b = $('tpl-pregunta').content.firstElementChild.cloneNode(true);
  b.dataset.uid = uid;
  b.dataset.tipo = p.tipo;
  b.querySelectorAll('[data-solo]').forEach((x) => { if (x.dataset.solo !== p.tipo) x.remove(); });
  enlazar(b, 'campo-enunciado', `enunciado-${uid}`);
  enlazar(b, 'campo-imagen', `imagen-${uid}`);
  enlazar(b, 'campo-puntos', `puntos-${uid}`);
  b.querySelector('.campo-enunciado').value = p.enunciado || '';
  b.querySelector('.campo-puntos').value = p.puntos ?? (p.tipo === 'ABIERTA' ? 2 : 1);

  if (p.tipo === 'OPCION_MULTIPLE') {
    const opciones = p.opciones?.length ? p.opciones : [{ texto: '', es_correcta: true }, { texto: '' }, { texto: '' }];
    opciones.forEach((o) => agregarOpcion(b, o.texto, o.es_correcta === true));
    b.querySelector('.opcion-agregar').addEventListener('click', () => {
      if (b.querySelectorAll('.opcion').length >= 10) return;
      agregarOpcion(b).querySelector('.opcion-texto').focus();
      marcarSucio();
    });
  }
  if (p.tipo === 'VERDADERO_FALSO') {
    for (const [clase, valor] of [['vf-verdadero', true], ['vf-falso', false]]) {
      const radio = b.querySelector(`.${clase}`);
      radio.name = `vf-${uid}`;
      radio.id = `${clase}-${uid}`;
      radio.checked = p.correcta === valor;
      b.querySelector(`.${clase}-label`).htmlFor = radio.id;
    }
  }
  if (p.imagen_ruta) mostrarImagen(b, p.imagen_ruta);
  b.querySelector('.campo-imagen').addEventListener('change', (e) => subirImagen(b, e.target));
  b.querySelector('.imagen-quitar').addEventListener('click', () => {
    delete b.dataset.imagen;
    b.querySelector('.imagen-vista').classList.add('d-none');
    marcarSucio();
  });
  b.querySelector('.pregunta-quitar').addEventListener('click', () => {
    if (b.querySelector('.campo-enunciado').value.trim() && !confirm('¿Quitar esta pregunta?')) return;
    b.remove();
    renumerar();
    marcarSucio();
  });
  $('lista-preguntas').append(b);
  renumerar();
  return b;
}

// --- Grupos y tiempo extra ---
const gruposMarcados = () => [...document.querySelectorAll('[name="grupos"]:checked')].map((c) => Number(c.value));

async function cargarGrupos(seleccion) {
  const materias = await api('GET', '/api/docente/materias');
  const grupos = materias.flatMap((m) => m.grupos.map((g) => ({ ...g, etiqueta: `${m.nombre} · ${g.nombre}` })));
  const cont = $('lista-grupos');
  if (!grupos.length) {
    cont.replaceChildren(el('span', { clase: 'text-suave small' }, 'Aún no tienes grupos. ', el('a', { texto: 'Créalos en el panel', atributos: { href: '/docente/panel.html' } }), '.'));
    return;
  }
  cont.replaceChildren(...grupos.map((g) => {
    const id = `grupo-${g.id}`;
    const caja = el('input', { clase: 'form-check-input', atributos: { type: 'checkbox', id, name: 'grupos', value: g.id } });
    caja.checked = seleccion.includes(Number(g.id));
    caja.addEventListener('change', cargarAlumnos);
    return el('div', { clase: 'form-check' }, caja, el('label', { clase: 'form-check-label', texto: g.etiqueta + (g.activo ? '' : ' (inactivo)'), atributos: { for: id } }));
  }));
}

function pintarSelectorAlumnos() {
  const disponibles = [...alumnosDisponibles]
    .filter(([id]) => !tiemposExtra.some((t) => t.alumno_id === id))
    .sort((a, b) => a[1].localeCompare(b[1]));
  const vacio = gruposMarcados().length ? 'No hay más alumnos inscritos en esos grupos' : 'Marca primero un grupo';
  $('extra-alumno').replaceChildren(...(disponibles.length
    ? disponibles.map(([id, nombre]) => el('option', { texto: nombre, atributos: { value: id } }))
    : [el('option', { texto: vacio, atributos: { value: '' } })]));
}

function pintarExtra() {
  $('lista-extra').replaceChildren(...tiemposExtra.map((t) => {
    const quitar = el('button', { texto: 'Quitar', clase: 'btn btn-link btn-sm', atributos: { type: 'button', 'aria-label': `Quitar el tiempo extra de ${t.nombre_usuario}` } });
    quitar.addEventListener('click', () => {
      tiemposExtra = tiemposExtra.filter((x) => x !== t);
      pintarExtra();
      pintarSelectorAlumnos();
      marcarSucio();
    });
    return el('li', { clase: 'list-group-item d-flex justify-content-between align-items-center px-0' },
      el('span', { texto: `${t.nombre_usuario} · +${t.minutos} min` }), quitar);
  }));
}

async function cargarAlumnos() {
  const listas = await Promise.all(gruposMarcados().map((id) => api('GET', `/api/docente/grupos/${id}/alumnos`).catch(() => [])));
  alumnosDisponibles = new Map(listas.flat().map((a) => [Number(a.id), a.nombre_usuario]));
  tiemposExtra = tiemposExtra.filter((t) => alumnosDisponibles.has(t.alumno_id)); // solo alumnos de los grupos marcados
  pintarExtra();
  pintarSelectorAlumnos();
}

$('extra-agregar').addEventListener('click', () => {
  const alumnoId = Number($('extra-alumno').value);
  const minutos = Number($('extra-min').value);
  if (!alumnoId) return;
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 240) {
    mostrarErrores(Object.assign(new Error('Revisa el tiempo extra.'), { detalles: ['Los minutos extra deben ser un número entero de 1 a 240.'] }));
    return;
  }
  tiemposExtra.push({ alumno_id: alumnoId, nombre_usuario: alumnosDisponibles.get(alumnoId), minutos });
  pintarExtra();
  pintarSelectorAlumnos();
  marcarSucio();
});

// --- Guardar ---
function recolectar(programar) {
  return {
    titulo: form.titulo.value,
    instrucciones: form.instrucciones.value,
    abre_en: aISO(form.abre_en.value),
    cierra_en: aISO(form.cierra_en.value),
    duracion_min: form.duracion_min.value === '' ? null : Number(form.duracion_min.value),
    umbral_inactividad_min: Number(form.umbral_inactividad_min.value),
    mostrar_respuestas: form.mostrar_respuestas.checked,
    permite_herramienta: form.permite_herramienta.checked,
    grupos: gruposMarcados(),
    preguntas: [...document.querySelectorAll('.pregunta')].map((b) => {
      const p = {
        tipo: b.dataset.tipo,
        enunciado: b.querySelector('.campo-enunciado').value,
        puntos: Number(b.querySelector('.campo-puntos').value),
        imagen_ruta: b.dataset.imagen || null,
      };
      if (p.tipo === 'OPCION_MULTIPLE') {
        p.opciones = [...b.querySelectorAll('.opcion')].map((o) => ({
          texto: o.querySelector('.opcion-texto').value,
          es_correcta: o.querySelector('.opcion-correcta').checked,
        }));
      }
      if (p.tipo === 'VERDADERO_FALSO') {
        p.correcta = b.querySelector('.vf-verdadero').checked ? true : b.querySelector('.vf-falso').checked ? false : null;
      }
      return p;
    }),
    tiempos_extra: tiemposExtra.map(({ alumno_id, minutos }) => ({ alumno_id, minutos })),
    programar,
  };
}

function mostrarErrores(err) {
  $('error-titulo').textContent = err.message;
  $('error-lista').replaceChildren(...(err.detalles || []).map((d) => el('li', { texto: d })));
  $('error-examen').classList.remove('d-none');
  $('error-examen').focus();
}

function pintarEstado(estado) {
  const [texto, clase] = ESTADOS[estado] || [estado, 'estado-neutro'];
  const insignia = $('estado-examen');
  insignia.textContent = texto;
  insignia.className = `badge rounded-pill estado ${clase}`;
}

form.addEventListener('input', (e) => {
  marcarSucio();
  if (e.target.classList.contains('campo-puntos')) renumerar();
});
form.addEventListener('change', marcarSucio);
window.addEventListener('beforeunload', (e) => { if (sucio) e.preventDefault(); });

document.querySelectorAll('[data-agregar]').forEach((boton) => boton.addEventListener('click', () => {
  agregarPregunta({ tipo: boton.dataset.agregar }).querySelector('.campo-enunciado').focus();
  marcarSucio();
}));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (bloqueado) return;
  const programar = e.submitter?.dataset.programar === 'true';
  $('error-examen').classList.add('d-none');
  mostrar($('aviso-guardado'), '');
  const botones = form.querySelectorAll('[type="submit"]');
  botones.forEach((b) => { b.disabled = true; });
  try {
    const r = await api(examenId ? 'PUT' : 'POST', examenId ? `/api/docente/examenes/${examenId}` : '/api/docente/examenes', recolectar(programar));
    sucio = false;
    if (programar) {
      location.href = '/docente/panel.html?programado=1';
      return;
    }
    examenId = Number(r.id);
    history.replaceState(null, '', `?id=${examenId}`);
    $('titulo-pagina').textContent = 'Editar examen';
    pintarEstado(r.estado);
    mostrar($('aviso-guardado'), 'Borrador guardado. Los alumnos no lo verán hasta que lo programes.');
  } catch (err) {
    mostrarErrores(err);
  } finally {
    botones.forEach((b) => { b.disabled = false; });
  }
});

async function iniciar() {
  let examen = null;
  if (examenId) {
    try {
      examen = await api('GET', `/api/docente/examenes/${examenId}`);
    } catch (err) {
      mostrarErrores(err);
      $('campos').disabled = true;
      return;
    }
  }
  try {
    await cargarGrupos(examen?.grupos || []);
  } catch (err) {
    $('lista-grupos').replaceChildren(el('span', { texto: err.message, clase: 'text-danger small' }));
  }
  if (examen) {
    document.title = `${examen.titulo} · Plataforma de exámenes`;
    $('titulo-pagina').textContent = 'Editar examen';
    pintarEstado(examen.estado);
    form.titulo.value = examen.titulo;
    form.instrucciones.value = examen.instrucciones;
    form.abre_en.value = aLocal(examen.abre_en);
    form.cierra_en.value = aLocal(examen.cierra_en);
    form.duracion_min.value = examen.duracion_min ?? '';
    form.umbral_inactividad_min.value = examen.umbral_inactividad_min;
    form.mostrar_respuestas.checked = examen.mostrar_respuestas;
    form.permite_herramienta.checked = examen.permite_herramienta;
    examen.preguntas.forEach(agregarPregunta);
    tiemposExtra = examen.tiempos_extra.map((t) => ({ alumno_id: Number(t.alumno_id), nombre_usuario: t.nombre_usuario, minutos: t.minutos }));
    if (examen.bloqueado) {
      bloqueado = true;
      $('campos').disabled = true;
      form.querySelectorAll('[type="submit"]').forEach((b) => b.classList.add('d-none'));
      $('aviso-bloqueado').classList.remove('d-none');
    }
  }
  await cargarAlumnos();
  renumerar();
  sucio = false;
}

iniciar();

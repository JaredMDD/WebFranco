// Exámenes en revisión: evidencia y decisión del docente (RF-33, RF-40, RF-41 · CU-12 a CU-14).
const modales = { confirmar: new bootstrap.Modal($('modal-confirmar')), reabrir: new bootstrap.Modal($('modal-reabrir')) };
let elegido = null;

function abrir(accion, i) {
  elegido = i;
  document.querySelectorAll('.nombre-alumno').forEach((e) => { e.textContent = i.alumno; });
  $('restante').textContent = `${i.restante_min} min`;
  $('tiempo-extra').value = 0;
  mostrar($(`error-${accion}`), '');
  modales[accion].show();
}

async function cargar() {
  const cuerpo = $('tabla-revision');
  try {
    const lista = await api('GET', '/api/docente/revision');
    if (!lista.length) return cuerpo.replaceChildren(filaVacia(7, 'No hay exámenes en revisión.'));
    cuerpo.replaceChildren(...lista.map((i) => {
      const celda = (etiqueta, contenido, atributos = {}) => el('td', { atributos: { 'data-label': etiqueta, ...atributos } }, contenido);
      const accion = (texto, clase, nombre) => {
        const b = el('button', { texto, clase: `btn ${clase} btn-sm`, atributos: { type: 'button', 'aria-label': `${texto}: ${i.alumno}` } });
        b.addEventListener('click', () => abrir(nombre, i));
        return b;
      };
      const evidencia = i.tipo
        ? [
          celda('Hora', formatoFechaHora.format(new Date(i.ocurrio_en))),
          celda('IP', i.ip),
          celda('Dispositivo', el('span', { texto: i.dispositivo_resumen, atributos: { title: i.dispositivo } })),
        ]
        // La evidencia se borra a la semana (RF-37): el docente decide sin ella (CU-12, flujo alterno).
        : [celda('Evidencia', el('span', { texto: 'Evidencia eliminada (más de 7 días)', clase: 'badge rounded-pill estado estado-neutro' }), { colspan: 3 })];
      return el('tr', {},
        celda('Alumno', i.alumno),
        celda('Examen', i.examen),
        celda('Incidente', i.tipo ? NOMBRE_INCIDENTE[i.tipo] : i.estado === 'ANULADO' ? 'Anulado' : 'Abandonado'),
        ...evidencia,
        celda('Decisión', el('span', { clase: 'd-inline-flex flex-wrap gap-1' },
          accion('Confirmar plagio', 'btn-outline-primary', 'confirmar'),
          accion('Descartar y reabrir', 'btn-primary', 'reabrir'))),
      );
    }));
  } catch (err) {
    cuerpo.replaceChildren(filaVacia(7, err.message));
  }
}

function decidir(accion, datos, aviso) {
  $(`form-${accion}`).addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    mostrar($(`error-${accion}`), '');
    enviando(form, async () => {
      try {
        await api('POST', `/api/docente/intentos/${elegido.id}/${accion}`, datos(form));
        modales[accion].hide();
        mostrar($('aviso'), aviso(elegido, form));
        await cargar();
      } catch (err) {
        mostrar($(`error-${accion}`), err.message);
      }
    });
  });
}
decidir('confirmar', () => ({}), (i) => `Plagio confirmado: el examen de ${i.alumno} queda anulado.`);
decidir('reabrir', (f) => ({ tiempo_extra_min: Number(f.tiempo_extra_min.value) }),
  (i, f) => `Examen reabierto: ${i.alumno} tiene ${i.restante_min + Number(f.tiempo_extra_min.value)} min desde ahora.`);

cargar();

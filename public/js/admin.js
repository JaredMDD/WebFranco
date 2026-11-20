// Panel del administrador: docentes, contraseñas, estado del sistema e incidentes (CU-02 a CU-05).
const modalCredencial = new bootstrap.Modal($('modal-credencial'));

const TIPOS = { CAMBIO_PESTANA: 'Cambio de pestaña', INACTIVIDAD: 'Inactividad', SESION_DUPLICADA: 'Sesión duplicada', CONEXION_PERDIDA: 'Conexión perdida' };
const DECISIONES = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', DESCARTADO: 'Descartado' };

function mostrarCredencial(texto, usuario, contrasena) {
  $('credencial-texto').textContent = texto;
  $('credencial-usuario').textContent = usuario;
  $('credencial-contrasena').textContent = contrasena;
  modalCredencial.show();
}

async function cargarEstado() {
  try {
    const salud = await fetch('/api/salud').then((r) => r.json());
    $('estado-servidor').textContent = 'En línea';
    $('estado-db').textContent = salud.data?.db ? 'Conectada' : 'Sin conexión';
  } catch {
    $('estado-servidor').textContent = 'Sin respuesta';
    $('estado-db').textContent = 'Desconocido';
  }
  try {
    const e = await api('GET', '/api/admin/estado');
    $('estado-intentos').textContent = String(e.intentos_en_curso);
    $('estado-incidentes').textContent = String(e.incidentes_pendientes);
  } catch {
    $('estado-intentos').textContent = $('estado-incidentes').textContent = '—';
  }
}

async function cargarDocentes() {
  const cuerpo = $('tabla-docentes');
  mostrar($('error-docentes'), '');
  let docentes;
  try {
    docentes = await api('GET', '/api/admin/docentes');
  } catch (err) {
    cuerpo.replaceChildren(filaVacia(4, 'No se pudo cargar la lista.'));
    return mostrar($('error-docentes'), err.message);
  }
  if (!docentes.length) return cuerpo.replaceChildren(filaVacia(4, 'Aún no hay docentes. Crea el primero con el formulario.'));

  cuerpo.replaceChildren(...docentes.map((d) => {
    const restablecer = el('button', { texto: 'Restablecer contraseña', clase: 'btn btn-outline-primary btn-sm', atributos: { type: 'button' } });
    restablecer.addEventListener('click', () => restablecerContrasena(d.nombre_usuario));
    const alternar = el('button', { texto: d.activo ? 'Desactivar' : 'Activar', clase: 'btn btn-outline-primary btn-sm', atributos: { type: 'button' } });
    alternar.addEventListener('click', () => cambiarActivo(d, alternar));
    return el('tr', {},
      el('td', { texto: d.nombre_usuario, atributos: { 'data-label': 'Usuario' } }),
      el('td', { texto: formatoFecha.format(new Date(d.creado_en)), atributos: { 'data-label': 'Alta' } }),
      el('td', { atributos: { 'data-label': 'Estado' } },
        el('span', { texto: d.activo ? 'Activo' : 'Inactivo', clase: `badge rounded-pill estado ${d.activo ? 'estado-exito' : 'estado-neutro'}` })),
      el('td', { clase: 'text-nowrap', atributos: { 'data-label': 'Acciones' } }, restablecer, ' ', alternar),
    );
  }));
}

async function cambiarActivo(docente, boton) {
  if (docente.activo && !confirm(`¿Desactivar a ${docente.nombre_usuario}? No podrá iniciar sesión hasta que lo actives de nuevo.`)) return;
  boton.disabled = true;
  try {
    await api('PATCH', `/api/admin/docentes/${docente.id}`, { activo: !docente.activo });
    await cargarDocentes();
  } catch (err) {
    boton.disabled = false;
    mostrar($('error-docentes'), err.message);
  }
}

async function restablecerContrasena(usuario) {
  if (!confirm(`¿Restablecer la contraseña de ${usuario}? La actual dejará de funcionar.`)) return;
  try {
    const r = await api('POST', '/api/admin/restablecer', { usuario });
    mostrarCredencial(`Entrega esta contraseña a ${r.usuario}.`, r.usuario, r.contrasena);
  } catch (err) {
    mostrar($('error-docentes'), err.message);
  }
}

async function cargarIncidentes() {
  const cuerpo = $('tabla-incidentes');
  try {
    const lista = await api('GET', '/api/admin/incidentes');
    if (!lista.length) return cuerpo.replaceChildren(filaVacia(6, 'Sin incidentes registrados.'));
    cuerpo.replaceChildren(...lista.map((i) => el('tr', {},
      el('td', { texto: formatoFechaHora.format(new Date(i.ocurrio_en)) }),
      el('td', { texto: i.alumno }),
      el('td', { texto: i.examen }),
      el('td', { texto: i.docente }),
      el('td', { texto: TIPOS[i.tipo] || i.tipo }),
      el('td', { texto: DECISIONES[i.decision] || i.decision }),
    )));
  } catch (err) {
    cuerpo.replaceChildren(filaVacia(6, err.message));
  }
}

$('form-docente').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  mostrar($('error-docente'), '');
  enviando(form, async () => {
    try {
      const r = await api('POST', '/api/admin/docentes', { usuario: form.usuario.value });
      form.reset();
      mostrarCredencial(`Cuenta de docente creada. Entrega estos datos a ${r.usuario}.`, r.usuario, r.contrasena);
      await Promise.all([cargarDocentes(), cargarEstado()]);
    } catch (err) {
      mostrar($('error-docente'), err.message);
    }
  });
});

$('form-restablecer').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  mostrar($('error-restablecer'), '');
  enviando(form, async () => {
    try {
      const r = await api('POST', '/api/admin/restablecer', { usuario: form.usuario.value });
      form.reset();
      mostrarCredencial(`Entrega esta contraseña a ${r.usuario}.`, r.usuario, r.contrasena);
    } catch (err) {
      mostrar($('error-restablecer'), err.message);
    }
  });
});

cargarEstado();
cargarDocentes();
cargarIncidentes();

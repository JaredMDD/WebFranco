// Panel del administrador: cuentas de docentes y administradores, contraseñas, estado del sistema e incidentes (CU-02 a CU-05).
const modalCredencial = new bootstrap.Modal($('modal-credencial'));

const TIPOS = { CAMBIO_PESTANA: 'Cambio de pestaña', INACTIVIDAD: 'Inactividad', SESION_DUPLICADA: 'Sesión duplicada', CONEXION_PERDIDA: 'Conexión perdida' };
const DECISIONES = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Confirmado', DESCARTADO: 'Descartado' };

// r: respuesta del servidor. Si la contraseña se envió por correo no llega aquí y solo se avisa.
function mostrarCredencial(r, texto) {
  $('credencial-texto').textContent = r.enviado
    ? `${texto} La contraseña se envió a ${r.correo}.`
    : `${texto} No se pudo enviar por correo: entrégale estos datos a ${r.usuario}.`;
  $('credencial-datos').hidden = r.enviado;
  $('credencial-usuario').textContent = r.usuario;
  $('credencial-contrasena').textContent = r.contrasena || '';
  modalCredencial.show();
}

const TIPO_CUENTA = { DOCENTE: 'Docente', ADMIN: 'Administrador' };

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
  let cuentas;
  try {
    cuentas = await api('GET', '/api/admin/cuentas');
  } catch (err) {
    cuerpo.replaceChildren(filaVacia(5, 'No se pudo cargar la lista.'));
    return mostrar($('error-docentes'), err.message);
  }

  const boton = (texto, accion) => {
    const b = el('button', { texto, clase: 'btn btn-outline-primary btn-sm text-nowrap', atributos: { type: 'button' } });
    b.addEventListener('click', () => accion(b));
    return b;
  };
  cuerpo.replaceChildren(...cuentas.map((c) => {
    const acciones = [boton('Editar correo', () => cambiarCorreo(c))];
    // La contraseña de un administrador solo la cambia él mismo (Mi cuenta u "Olvidé mi contraseña").
    if (c.rol === 'DOCENTE') acciones.push(boton('Nueva contraseña', () => restablecerContrasena(c.nombre_usuario)));
    if (!c.propia) acciones.push(boton(c.activo ? 'Desactivar' : 'Activar', (b) => cambiarActivo(c, b)));
    return el('tr', {},
      el('td', { texto: c.propia ? `${c.nombre_usuario} (tú)` : c.nombre_usuario, atributos: { 'data-label': 'Usuario' } }),
      el('td', { texto: TIPO_CUENTA[c.rol], atributos: { 'data-label': 'Tipo' } }),
      el('td', { texto: c.correo || 'Sin correo', clase: c.correo ? 'text-break' : 'text-suave', atributos: { 'data-label': 'Correo' } }),
      el('td', { atributos: { 'data-label': 'Estado' } },
        el('span', { texto: c.activo ? 'Activo' : 'Inactivo', clase: `badge rounded-pill estado ${c.activo ? 'estado-exito' : 'estado-neutro'}` })),
      el('td', { atributos: { 'data-label': 'Acciones' } }, el('div', { clase: 'd-flex flex-wrap justify-content-end justify-content-md-start gap-1' }, ...acciones)),
    );
  }));
}

async function cambiarActivo(cuenta, boton) {
  if (cuenta.activo && !confirm(`¿Desactivar a ${cuenta.nombre_usuario}? No podrá iniciar sesión hasta que lo actives de nuevo.`)) return;
  boton.disabled = true;
  try {
    await api('PATCH', `/api/admin/cuentas/${cuenta.id}`, { activo: !cuenta.activo });
    await Promise.all([cargarDocentes(), cargarEstado()]);
  } catch (err) {
    boton.disabled = false;
    mostrar($('error-docentes'), err.message);
  }
}

async function cambiarCorreo(cuenta) {
  const correo = prompt(`Correo de ${cuenta.nombre_usuario}:`, cuenta.correo || '');
  if (correo === null || correo.trim() === (cuenta.correo || '')) return;
  try {
    await api('PATCH', `/api/admin/cuentas/${cuenta.id}`, { correo });
    await cargarDocentes();
  } catch (err) {
    mostrar($('error-docentes'), err.message);
  }
}

async function restablecerContrasena(usuario) {
  if (!confirm(`¿Restablecer la contraseña de ${usuario}? La actual dejará de funcionar.`)) return;
  try {
    mostrarCredencial(await api('POST', '/api/admin/restablecer', { usuario }), 'Contraseña restablecida.');
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
      const r = await api('POST', '/api/admin/cuentas', Object.fromEntries(new FormData(form)));
      form.reset();
      mostrarCredencial(r, `Cuenta de ${TIPO_CUENTA[r.rol].toLowerCase()} creada.`);
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
      mostrarCredencial(r, 'Contraseña restablecida.');
    } catch (err) {
      mostrar($('error-restablecer'), err.message);
    }
  });
});

cargarEstado();
cargarDocentes();
cargarIncidentes();

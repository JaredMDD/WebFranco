// Cliente de la API compartido por todas las páginas: JSON de ida y vuelta y mensajes en español.
// Si la sesión terminó (401) fuera de la página de acceso, regresa al acceso.
async function api(metodo, url, datos) {
  let res;
  try {
    res = await fetch(url, {
      method: metodo,
      headers: datos ? { 'Content-Type': 'application/json' } : {},
      body: datos ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  const cuerpo = await res.json().catch(() => ({ ok: false, error: 'Respuesta inesperada del servidor.' }));
  if (res.status === 401 && !['/', '/index.html'].includes(location.pathname)) location.href = '/';
  if (!cuerpo.ok) {
    const err = new Error(cuerpo.error || 'Ocurrió un error. Inténtalo de nuevo.');
    err.detalles = cuerpo.detalles || []; // lista de problemas de validación, cuando el servidor la envía
    err.cuerpo = cuerpo; // campos extra, p. ej. estado del intento cerrado
    err.http = res.status;
    throw err;
  }
  return cuerpo.data;
}

// Muestra u oculta un mensaje (alerta) según tenga texto.
function mostrar(el, texto) {
  el.textContent = texto || '';
  el.classList.toggle('d-none', !texto);
}

// Desactiva el botón de envío mientras corre la petición, para evitar envíos dobles.
async function enviando(form, fn) {
  const boton = form.querySelector('[type="submit"]');
  boton.disabled = true;
  form.setAttribute('aria-busy', 'true');
  try {
    await fn();
  } finally {
    boton.disabled = false;
    form.removeAttribute('aria-busy');
  }
}

// Crea un elemento con texto seguro (nunca innerHTML con datos del servidor: evita XSS, RNF-06).
function el(etiqueta, { texto, clase, atributos } = {}, ...hijos) {
  const e = document.createElement(etiqueta);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  for (const [k, v] of Object.entries(atributos || {})) e.setAttribute(k, v);
  e.append(...hijos);
  return e;
}
const filaVacia = (columnas, texto) => el('tr', {}, el('td', { texto, clase: 'text-suave', atributos: { colspan: columnas } }));
const $ = (id) => document.getElementById(id);

const formatoFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
const formatoFechaHora = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Nombres de los incidentes para el docente (revisión y reportes).
const NOMBRE_INCIDENTE = { CAMBIO_PESTANA: 'Cambio de pestaña', INACTIVIDAD: 'Inactividad', SESION_DUPLICADA: 'Sesión duplicada', CONEXION_PERDIDA: 'Conexión perdida' };

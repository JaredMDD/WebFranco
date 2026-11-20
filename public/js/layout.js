// Encabezado y pie institucionales comunes (RNF-20).
// Uso: <body data-rol="alumno|docente|admin|acceso" data-pagina="clave"> y este script al final del body.
// data-sin-menu oculta la navegación (pantalla de examen: salir de la página cuenta como abandono).
(() => {
  const ROLES = {
    acceso: { nombre: 'Acceso', menu: [] },
    alumno: {
      nombre: 'Alumno',
      menu: [['panel', 'Mis exámenes', '/alumno/panel.html']],
    },
    docente: {
      nombre: 'Docente',
      menu: [
        ['panel', 'Panel', '/docente/panel.html'],
        ['revision', 'En revisión', '/docente/revision.html'],
        ['reportes', 'Reportes', '/docente/reportes.html'],
      ],
    },
    admin: {
      nombre: 'Administrador',
      menu: [['panel', 'Panel', '/admin/panel.html']],
    },
  };

  const body = document.body;
  const rol = ROLES[body.dataset.rol] || ROLES.acceso;
  const conMenu = rol.menu.length > 0 && !('sinMenu' in body.dataset);

  const enlaces = rol.menu
    .map(([clave, texto, href]) => {
      const activo = clave === body.dataset.pagina;
      return `<li class="nav-item"><a class="nav-link${activo ? ' active' : ''}" href="${href}"${activo ? ' aria-current="page"' : ''}>${texto}</a></li>`;
    })
    .join('');

  const header = document.createElement('header');
  header.className = 'encabezado navbar navbar-expand-md py-2';
  header.dataset.bsTheme = 'dark';
  header.innerHTML = `
    <a class="visually-hidden-focusable position-absolute top-0 start-0 m-2 btn btn-light btn-sm" href="#contenido">Saltar al contenido</a>
    <div class="container-fluid px-3 px-md-4">
      <a class="navbar-brand d-flex align-items-center gap-3 text-white me-auto" href="/">
        <span class="logo-placeholder" aria-hidden="true">LOGO</span>
        <span>
          <span class="nombre-inst d-block">Tecnológico de Cuautla</span>
          <span class="sub-inst d-block">TecNM · Plataforma de exámenes</span>
        </span>
      </a>
      <span class="rol me-2 me-md-0 ms-md-3 order-md-last${conMenu ? ' rol-separada d-none d-md-inline' : ''}">${rol.nombre}</span>
      ${conMenu ? `
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu-principal" aria-controls="menu-principal" aria-expanded="false" aria-label="Abrir menú">
        <span class="navbar-toggler-icon"></span>
      </button>
      <nav class="collapse navbar-collapse justify-content-md-end" id="menu-principal" aria-label="Menú principal">
        <ul class="navbar-nav align-items-md-center gap-md-2">
          <li class="nav-item d-md-none sesion-movil small pt-2">Sesión: ${rol.nombre}</li>
          ${enlaces}
          <li class="nav-item"><a class="nav-link" href="/" data-accion="salir">Cerrar sesión</a></li>
        </ul>
      </nav>` : ''}
    </div>`;
  body.prepend(header);

  const footer = document.createElement('footer');
  footer.className = 'pie py-3 mt-4';
  footer.innerHTML = `
    <div class="container d-flex flex-column flex-sm-row justify-content-between gap-1 text-center text-sm-start">
      <span>Tecnológico Nacional de México · Tecnológico de Cuautla</span>
      <span>Plataforma de exámenes · ${new Date().getFullYear()}</span>
    </div>`;
  body.append(footer);

  // Cerrar sesión: cierra la sesión en el servidor y regresa al acceso.
  header.addEventListener('click', (e) => {
    if (!e.target.closest('[data-accion="salir"]')) return;
    e.preventDefault();
    fetch('/api/auth/salir', { method: 'POST' }).finally(() => { location.href = '/'; });
  });
})();

// Mi cuenta: el docente o administrador cambia su contraseña y su correo de recuperación.
const formContrasena = $('form-contrasena');
const formCorreo = $('form-correo');

api('GET', '/api/auth/yo').then((yo) => {
  $('cuenta-usuario').textContent = yo.usuario;
  formContrasena.usuario.value = yo.usuario;
  formCorreo.correo.value = yo.correo || '';
  $('falta-correo').hidden = Boolean(yo.correo);
}).catch((err) => mostrar($('error-contrasena'), err.message));

formContrasena.addEventListener('submit', (e) => {
  e.preventDefault();
  mostrar($('error-contrasena'), '');
  mostrar($('aviso-contrasena'), '');
  const datos = Object.fromEntries(new FormData(formContrasena));
  if (datos.nueva !== datos.confirmar) return mostrar($('error-contrasena'), 'Las contraseñas no coinciden.');
  enviando(formContrasena, async () => {
    try {
      await api('POST', '/api/auth/contrasena', datos);
      const usuario = formContrasena.usuario.value;
      formContrasena.reset();
      formContrasena.usuario.value = usuario;
      mostrar($('aviso-contrasena'), 'Contraseña actualizada. Se cerró tu sesión en otros equipos.');
    } catch (err) {
      mostrar($('error-contrasena'), err.message);
    }
  });
});

formCorreo.addEventListener('submit', (e) => {
  e.preventDefault();
  mostrar($('error-correo'), '');
  mostrar($('aviso-correo'), '');
  enviando(formCorreo, async () => {
    try {
      const { correo } = await api('POST', '/api/auth/correo', Object.fromEntries(new FormData(formCorreo)));
      formCorreo.actual.value = '';
      $('falta-correo').hidden = true;
      mostrar($('aviso-correo'), `Correo guardado: ${correo}.`);
    } catch (err) {
      mostrar($('error-correo'), err.message);
    }
  });
});

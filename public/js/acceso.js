// Inicio de sesión y registro de alumnos (CU-01, CU-06, CU-18, CU-19).
const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const errorLogin = document.getElementById('error-login');
const avisoLogin = document.getElementById('aviso-login');
const errorRegistro = document.getElementById('error-registro');

formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  mostrar(errorLogin, '');
  mostrar(avisoLogin, '');
  enviando(formLogin, async () => {
    try {
      const { panel } = await api('POST', '/api/auth/entrar', Object.fromEntries(new FormData(formLogin)));
      location.href = panel;
    } catch (err) {
      mostrar(errorLogin, err.message);
    }
  });
});

formRegistro.addEventListener('submit', (e) => {
  e.preventDefault();
  mostrar(errorRegistro, '');
  const datos = Object.fromEntries(new FormData(formRegistro));
  if (datos.contrasena !== datos.confirmar) return mostrar(errorRegistro, 'Las contraseñas no coinciden.');
  enviando(formRegistro, async () => {
    try {
      const { usuario } = await api('POST', '/api/auth/registro', datos);
      formRegistro.reset();
      // El sistema lo envía al inicio de sesión (CU-18, paso 4)
      formLogin.usuario.value = usuario;
      mostrar(avisoLogin, `Cuenta creada. Ahora inicia sesión como ${usuario}.`);
      formLogin.contrasena.focus();
    } catch (err) {
      mostrar(errorRegistro, err.message);
    }
  });
});

// Olvidé mi contraseña: pedir el enlace por correo y, al volver con él, elegir una nueva.
const formOlvide = $('form-olvide');
const formRecuperar = $('form-recuperar');
const token = new URLSearchParams(location.search).get('token');

if (token) {
  history.replaceState(null, '', location.pathname); // el token no se queda en el historial ni en la barra
  formOlvide.hidden = true;
  formRecuperar.hidden = false;
}

formOlvide.addEventListener('submit', (e) => {
  e.preventDefault();
  mostrar($('error-olvide'), '');
  mostrar($('aviso-olvide'), '');
  enviando(formOlvide, async () => {
    try {
      const { mensaje } = await api('POST', '/api/auth/olvide', Object.fromEntries(new FormData(formOlvide)));
      mostrar($('aviso-olvide'), mensaje);
    } catch (err) {
      mostrar($('error-olvide'), err.message);
    }
  });
});

formRecuperar.addEventListener('submit', (e) => {
  e.preventDefault();
  mostrar($('error-recuperar'), '');
  const datos = Object.fromEntries(new FormData(formRecuperar));
  if (datos.contrasena !== datos.confirmar) return mostrar($('error-recuperar'), 'Las contraseñas no coinciden.');
  enviando(formRecuperar, async () => {
    try {
      await api('POST', '/api/auth/recuperar', { ...datos, token });
      location.href = '/?recuperada=1';
    } catch (err) {
      mostrar($('error-recuperar'), err.message);
    }
  });
});

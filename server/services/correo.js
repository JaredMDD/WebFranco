import nodemailer from 'nodemailer';

// Sin SMTP_HOST no se envía nada y quien llama muestra la contraseña en pantalla como respaldo.
const puerto = Number(process.env.SMTP_PORT) || 465;
// Las pruebas reemplazan envio.transporte para leer los correos sin enviarlos.
export const envio = {
  transporte: process.env.SMTP_HOST
    ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    : null,
};

export const CORREO_VALIDO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
export const normalizarCorreo = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

// Devuelve true si el servidor de correo aceptó el mensaje. Nunca lanza: un correo fallido no debe tumbar la petición.
export async function enviarCorreo(para, asunto, texto) {
  if (!envio.transporte) return false;
  try {
    await envio.transporte.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: para, subject: asunto, text: texto });
    return true;
  } catch (err) {
    console.error('Correo no enviado:', err.message);
    return false;
  }
}

const URL_PUBLICA = () => (process.env.URL_PUBLICA || '').replace(/\/+$/, '');

export function correoContrasena(usuario, contrasena, motivo) {
  return [
    `Hola, ${usuario}.`,
    '',
    `${motivo} en la Plataforma de exámenes del Tecnológico de Cuautla.`,
    '',
    `Usuario: ${usuario}`,
    `Contraseña: ${contrasena}`,
    '',
    URL_PUBLICA() ? `Entra en ${URL_PUBLICA()} y cámbiala en "Mi cuenta".` : 'Al entrar, cámbiala en "Mi cuenta".',
  ].join('\n');
}

// El enlace usa URL_PUBLICA y nunca el encabezado Host de la petición: un Host falso mandaría el token a otro sitio.
export const enlaceRecuperacion = (token) => (URL_PUBLICA() ? `${URL_PUBLICA()}/recuperar.html?token=${token}` : null);

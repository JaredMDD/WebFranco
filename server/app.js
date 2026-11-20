import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { pool } from './db/pool.js';
import { cargarSesion, requierePagina, PANEL_POR_ROL } from './middleware/auth.js';
import { auth } from './routes/auth.js';
import { admin } from './routes/admin.js';
import { docente } from './routes/docente.js';
import { alumno } from './routes/alumno.js';
import { examenes } from './routes/examenes.js';
import { imagenes } from './routes/imagenes.js';
import { presentacion } from './routes/presentacion.js';
import { calificacion } from './routes/calificacion.js';
import { iniciarSockets } from './sockets.js';
import { purgarIncidentesVencidos } from './services/incidentes.js';

export const app = express();
const publicDir = fileURLToPath(new URL('../public', import.meta.url));

// Solo detrás de Nginx (producción): sin proxy, X-Forwarded-For lo puede falsear cualquiera y evadir los límites.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.get('/api/salud', async (req, res) => {
  let db = false;
  try {
    await pool.query('SELECT 1');
    db = true;
  } catch (err) {
    console.error('Salud: sin conexión a la base de datos:', err.message);
  }
  res.status(db ? 200 : 503).json({ ok: db, data: { servidor: true, db } });
});

app.use('/api', cargarSesion);
app.use('/api/auth', auth);
app.use('/api/admin', admin);
app.use('/api/docente/examenes', examenes);
app.use('/api/docente', calificacion);
app.use('/api/docente', docente);
app.use('/api/imagenes', imagenes);
app.use('/api/alumno', alumno);
app.use('/api/alumno', presentacion);
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Ruta no encontrada.' }));

// Páginas por rol, protegidas en el servidor (RNF-05)
app.use('/alumno', cargarSesion, requierePagina('ALUMNO'));
app.use('/docente', cargarSesion, requierePagina('DOCENTE'));
app.use('/admin', cargarSesion, requierePagina('ADMIN'));
// Con sesión iniciada, la página de acceso lleva directo al panel del rol
app.get(['/', '/index.html'], cargarSesion, (req, res, next) => (req.usuario ? res.redirect(PANEL_POR_ROL[req.usuario.rol]) : next()));

app.use(express.static(publicDir));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'Petición mal formada.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'La petición es demasiado grande.' });
  console.error(err);
  res.status(500).json({ ok: false, error: 'Ocurrió un error en el servidor. Inténtalo de nuevo.' });
});

if (import.meta.main) {
  const port = Number(process.env.PORT) || 3000;
  iniciarSockets(app.listen(port, () => console.log(`Servidor en http://localhost:${port}`)));
  // Evidencias vencidas: al arrancar y una vez al día (RF-37, CU-30).
  const purgar = () => purgarIncidentesVencidos()
    .then((n) => n && console.log(`Purga: ${n} incidentes vencidos eliminados.`))
    .catch((err) => console.error('Purga de incidentes:', err));
  purgar();
  setInterval(purgar, 24 * 60 * 60 * 1000).unref();
}

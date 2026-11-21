# Plataforma de exámenes · Tecnológico de Cuautla (TecNM)

Plataforma web para aplicar exámenes asíncronos y no presenciales, desde computadora o celular, con medidas antiplagio: detecta el cambio de pestaña, la inactividad, la pérdida de conexión y las sesiones duplicadas, guarda la evidencia y deja la decisión al docente.

- **Alumno:** se registra, se inscribe a grupos con un código, presenta exámenes (una pregunta a la vez, reloj del servidor, autoguardado) y consulta sus resultados.
- **Docente:** crea materias, grupos y exámenes (opción múltiple, verdadero/falso y abiertas, con imágenes), revisa incidentes, califica, publica y exporta reportes a Excel y PDF.
- **Administrador:** crea y administra las cuentas de los docentes y supervisa el sistema.

Node.js + Express, PostgreSQL, Socket.IO y Bootstrap 5, todo en JavaScript y sin paso de compilación.

## Instalación local

Requisitos: **Node.js 24.2 o mayor** y **PostgreSQL** (probado con la 18).

1. Crea la base de datos, desde `psql` con el usuario `postgres`:
   ```sql
   CREATE ROLE webfranco LOGIN PASSWORD '<clave>';
   CREATE DATABASE webfranco OWNER webfranco;
   ```
2. Instala las dependencias y configura el entorno:
   ```powershell
   npm ci
   Copy-Item .env.example .env      # en Linux o macOS: cp .env.example .env
   ```
   En `.env`, pon tu clave en `DATABASE_URL`. Deja `NODE_ENV` y `TRUST_PROXY` comentados: en local se entra por `http://`, y con `NODE_ENV=production` la cookie de sesión solo viaja por HTTPS. `URL_PUBLICA` y `SMTP_*` (envío de contraseñas y recuperación por correo) son opcionales en local: sin ellas, las contraseñas se muestran en pantalla.
3. Crea las tablas y el administrador inicial:
   ```powershell
   npm run db:migrar
   ```
   Anota la contraseña que imprime: no se vuelve a mostrar. Para generar otra: `npm run db:migrar -- --nueva-contrasena-admin`.
4. Arranca y abre <http://localhost:3000>:
   ```powershell
   npm start        # o npm run dev, que se reinicia al guardar cambios
   ```

Entra como `admin`, crea un docente y registra un alumno desde la pantalla de acceso para recorrer todo el flujo.

## Pruebas

```powershell
npm test                                   # 47 pruebas de integración contra la BD local
npm run carga -- http://localhost:3000 200 10   # carga: 200 alumnos, 10 preguntas (con el servidor encendido)
```

Las pruebas crean usuarios `prueba_*` en la base configurada en `.env` y los borran al terminar. No las corras contra la base de producción. Resultados en [`docs/Resultados_de_Pruebas.docx`](docs/Resultados_de_Pruebas.docx).

## Publicar en internet

[`DESPLIEGUE.md`](DESPLIEGUE.md) explica cómo publicar desde una PC con Windows usando Tailscale Funnel: arranque automático, reinicio ante fallas, respaldos diarios y comprobación final. La alternativa con Oracle Cloud está en [`docs/DESPLIEGUE_ORACLE.md`](docs/DESPLIEGUE_ORACLE.md).

## Estructura

```
server/
  app.js            Express: seguridad, rutas, páginas por rol y errores
  sockets.js        presencia del alumno durante el examen (Socket.IO)
  db/               conexión, schema.sql y migración
  middleware/       sesiones y control de acceso por rol
  routes/           API: auth, admin, docente, examenes, imagenes, alumno, presentacion, calificacion
  services/         lógica: intentos, incidentes, exámenes, reportes, contraseñas, códigos
public/             páginas HTML por rol, css/app.css y js/ (sin framework)
test/               pruebas (*.test.js), ayudantes y script de carga
deploy/             arranque automático y respaldo para Windows
docs/               manual de usuario, resultados de pruebas, reporte y guía de Oracle
```

## Documentación

| Documento | Contenido |
|---|---|
| [`Req.md`](Req.md) | Requerimientos funcionales y no funcionales |
| [`CasosD_Uso.md`](CasosD_Uso.md) | Casos de uso y diagrama de Gantt |
| [`modelo_de_datos.md`](modelo_de_datos.md) | Tablas de la base de datos |
| [`disenos_de_interfaz.md`](disenos_de_interfaz.md), [`DESIGN.md`](DESIGN.md) | Diseño de pantallas y sistema de diseño |
| [`PLAN_DESARROLLO.md`](PLAN_DESARROLLO.md) | Fases, decisiones técnicas, riesgos y changelog |
| [`PLAN_COMPLEMENTARIO.md`](PLAN_COMPLEMENTARIO.md) | Documentación y reporte de desarrollo |
| [`docs/Manual_de_Usuario.docx`](docs/Manual_de_Usuario.docx) | Manual para alumno, docente y administrador |

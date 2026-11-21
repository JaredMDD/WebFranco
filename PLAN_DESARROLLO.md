# Plan de desarrollo y changelog
## Plataforma web para la aplicación segura de exámenes asíncronos · Tecnológico de Cuautla (TecNM)

**Inicio:** 18 nov 2026 · **Entrega:** 27 nov 2026 · **Presentación:** 30 nov – 4 dic 2026

Documentos fuente: [`Req.md`](Req.md) (RF/RNF), [`CasosD_Uso.md`](CasosD_Uso.md) (CU y Gantt), [`modelo_de_datos.md`](modelo_de_datos.md) (tablas), [`disenos_de_interfaz.md`](disenos_de_interfaz.md) (pantallas), [`example.html`](example.html) (maquetas visuales de referencia, ver §1.1), [`DESIGN.md`](DESIGN.md) (sistema de diseño implementado: tokens, componentes y reglas).

Este archivo es la **referencia única de avance**: cada tarea tiene casilla, y cada cambio terminado se anota en el [Changelog](#9-changelog) al final.

**Leyenda:** `[ ]` pendiente · `[~]` en curso · `[x]` terminado · `[-]` recortado · Prioridad `I` imprescindible, `M` importante, `D` deseable.

---

## 1. Decisiones técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| Frontend | Páginas **HTML estáticas + Bootstrap 5.3.9** (ya incluido en `css/` y `js/`) + JavaScript sin framework (`fetch` a la API). | Lo pide el proyecto; sin paso de compilación. |
| Estilos TecNM | Un solo archivo `public/css/app.css` que redefine las variables de Bootstrap (`--bs-primary`, etc.) con la paleta provisional (RNF-22). | Cambio de paleta en un solo lugar. |
| Backend | Node.js LTS + Express. | Un solo lenguaje (Req §4). |
| Base de datos | PostgreSQL con la librería **`pg`** y un archivo `server/db/schema.sql`. | Menos herramientas que Prisma/Knex; el modelo ya está escrito en SQL. |
| Sesiones | Cookie `httpOnly`, `secure`, `sameSite=strict` con token aleatorio; en BD se guarda su hash (tabla `sesion`). Una sesión activa por alumno (RF-34). | Coincide con el modelo de datos. |
| Tiempo real | Socket.IO: el navegador reporta `visibilitychange`, `blur` e inactividad; la desconexión del socket marca el intento como abandonado. | RF-27, RF-30, RF-31. |
| Seguridad | `bcrypt`, `helmet`, `express-rate-limit`, consultas parametrizadas, escape de HTML en el cliente (`textContent`), validación de rol en cada ruta. | RNF-01, 04, 05, 06. |
| Imágenes | `multer` a `server/uploads/` (solo PNG/JPG, tamaño máximo). | RF-13. |
| Exportación | `exceljs` (Excel) y `pdfkit` (PDF). | RF-44. |
| Tareas programadas | Borrado diario de evidencias dentro de la app; respaldo con `pg_dump` + cron del sistema. | RF-37, RNF-14. |
| Pruebas de carga | `autocannon` o `artillery` contra el servidor real. | RNF-10, RNF-12. |

### 1.1 Referencia visual: `example.html`

`example.html` es un paquete autoextraíble (necesita JavaScript para mostrarse) con **5 maquetas** que reproducen `disenos_de_interfaz.md`:

| Maqueta en `example.html` | Tamaño | Página a construir |
|---|---|---|
| 1 · Acceso y registro | 1280×720 | `public/index.html` |
| 2 · Panel del alumno | 1280×720 | `public/alumno/panel.html` |
| 3 · Instrucciones y reglas | 1280×720 | `public/alumno/instrucciones.html` |
| 4 · Examen (celular) | 390×844 | `public/alumno/examen.html` |
| 5 · Revisión del docente | 1280×720 | `public/docente/revision.html` |

Las maquetas usan estilos en línea y clases propias. Se rehacen con Bootstrap 5.3.9 sin copiar su código (es un paquete generado, no fuente). Equivalencias:

| En `example.html` | En Bootstrap + `app.css` |
|---|---|
| Encabezado `#1F3A6E`, logo punteado 44×44, rol a la derecha | `navbar bg-primary` + `.logo-placeholder` en `app.css` |
| Fondo de página `#F4F6FA` | `body { background: var(--color-fondo) }` |
| `.c` tarjeta (radio 12 px, relleno 28 px, sombra suave) | `.card .shadow-sm` + `--bs-card-border-radius: 12px`, `.card-body p-4` |
| `.b` botón principal (radio 8 px, 12×20, 600 15 px) | `.btn .btn-primary` + variables `--bs-btn-*` en `app.css` |
| `.s` botón secundario (borde azul 2 px) | `.btn .btn-outline-primary` con `--bs-btn-border-width: 2px` |
| `label` en negrita encima de campo, `input` radio 8 px | `.form-label .fw-semibold` + `.form-control` |
| Tabla con línea inferior `#D5D9E2` | `.table` dentro de `.table-responsive` |
| Píldora amarilla "Bloqueado: en revisión del docente" | `.badge .rounded-pill .text-bg-warning` (lleva texto, no solo color) |
| Barra de progreso de 8 px | `.progress` con `height: 8px` + `.progress-bar` |
| Opciones del examen como tarjetas con radio de 22 px | `.card` + `.form-check` con `.form-check-input` de 22 px |
| "Respuesta guardada" en verde `#1E6B3C` | `.text-success` con `--bs-success-rgb` ajustado |
| Contenedores de 760 / 960 / 1100 px | `.container` con `max-width` por pantalla en `app.css` |

> Las pantallas que no están en `example.html` (§3 de `disenos_de_interfaz.md`) siguen los mismos componentes.

## 2. Estructura de carpetas objetivo

```
WebFranco/
├── *.md, example.html      ← documentación y maquetas de referencia (no se publican)
├── package.json
├── .env.example            ← DATABASE_URL, SESSION_SECRET, PORT
├── server/
│   ├── app.js              ← Express + Socket.IO + estáticos de public/
│   ├── db/
│   │   ├── pool.js
│   │   ├── schema.sql      ← tablas e índices de modelo_de_datos.md
│   │   └── migrar.js       ← aplica schema.sql y crea el administrador inicial
│   ├── middleware/         ← auth (sesión + rol), rate limits
│   ├── routes/             ← auth, admin, docente, alumno, examen, reportes
│   ├── services/           ← temporizador, calificación, aleatorización, incidentes
│   ├── jobs/               ← borrado de evidencias
│   └── uploads/            ← imágenes de preguntas
├── public/                 ← lo único servido al navegador
│   ├── css/  (bootstrap.min.css + app.css)
│   ├── js/   (bootstrap.bundle.min.js + api.js, layout.js, una por pantalla)
│   ├── img/  logo.png (original TecNM), emblema.png (encabezado), icono.png (pestaña e inicio en celular)
│   ├── index.html          ← acceso y registro
│   ├── recuperar.html      ← olvidé mi contraseña (pedir enlace y elegir una nueva)
│   ├── alumno/   panel.html, instrucciones.html, examen.html, bloqueado.html, resultados.html
│   ├── docente/  panel.html, examen-editar.html, revision.html, calificar.html, reportes.html, cuenta.html
│   └── admin/    panel.html, cuenta.html
└── deploy/                 ← nginx.conf, webfranco.service, backup.sh
```

> Las carpetas actuales `css/` y `js/` se mueven a `public/` en la Fase 0 para no publicar el código del servidor ni los `.md`.

## 3. Convenciones

- **Una tarea = un cambio verificable.** Al terminarla: marcar `[x]` aquí y agregar línea en el Changelog con fecha, IDs (RF/CU) y archivos.
- La API vive en `/api/...` y responde JSON `{ ok, data | error }` con mensajes en español claros (RNF-16).
- Toda ruta de docente filtra por `docente_id` del recurso (RNF-05, RF-45). Nunca se confía en IDs enviados por el navegador sin verificar dueño.
- Las respuestas correctas (`opcion.es_correcta`) **jamás** se incluyen en las respuestas de la API del alumno mientras el intento esté `EN_CURSO` (RNF-07).
- HTML accesible: `<label>` en cada campo, `<button>` reales, tablas dentro de `.table-responsive`, estados con texto y no solo color, áreas táctiles ≥ 44 px.
- Encabezado y pie institucional comunes en todas las pantallas (RNF-20), insertados por `layout.js`.

---

## 4. Fases de desarrollo

### Fase 0 · Preparación del proyecto — 18–19 nov
- [x] Crear `package.json` e instalar dependencias (express 5, pg, bcrypt, helmet, express-rate-limit, socket.io, multer, exceljs, pdfkit). `.env` se carga con `--env-file-if-exists` de Node, sin `dotenv`.
- [x] Mover `css/` y `js/` a `public/`. (Borrar mapas y variantes RTL: no se hizo, opcional.)
- [x] `server/app.js` mínimo sirviendo `public/` y `GET /api/salud` (200 con BD, 503 sin BD).
- [x] PostgreSQL local (v18): usuario y BD `webfranco` creados; `/api/salud` responde `db: true`.
- [x] Inicializar repositorio git con `.gitignore` (`node_modules`, `.env`, `server/uploads`, `.DS_Store`, `.idea/workspace.xml`). Sin commit inicial aún.
- [-] **(Recortado el 19 nov: Oracle exige tarjeta de crédito; ver Fase 8)** **(En paralelo, no bloquea Fases 1–7)** Cuenta Oracle Cloud y VM Ubuntu ARM64 (Req §4.1 pasos 1–3). Fecha límite: 23 nov, para que la Fase 8 empiece el 24. Riesgo: sin capacidad en la región → contingencia local.

**Listo cuando:** `npm start` abre una página Bootstrap en `http://localhost:3000` y `/api/salud` responde.

### Fase 1 · Maquetas HTML con Bootstrap e identidad TecNM — 20–21 nov
Pantallas estáticas con datos de ejemplo, que luego se conectan a la API. **Referencia visual: `example.html`** (§1.1). Cada pantalla se compara lado a lado con su maqueta antes de marcarla terminada.
- [x] `app.css`: variables de paleta provisional (`--color-primario: #1F3A6E`, etc.) mapeadas a Bootstrap; tipografía Inter/Arial; botones, tarjetas y píldoras de estado según `disenos_de_interfaz.md` §1. (RNF-19, RNF-22)
- [x] `layout.js`: encabezado azul con marcador de logotipo 44×44, "Tecnológico de Cuautla / TecNM · Plataforma de exámenes", rol a la derecha, menú por rol (colapsable en celular), enlace "Saltar al contenido"; pie institucional. (RNF-20, RNF-21)
- [x] Pantalla 1 · Acceso y registro (`index.html`).
- [x] Pantalla 2 · Panel del alumno (en celular la tabla se apila para que "Presentar" quede visible).
- [x] Pantalla 3 · Instrucciones y reglas (botón habilitado solo con casilla marcada, `instrucciones.js`).
- [x] Pantalla 4 · Examen en curso, **mobile-first 390×844**, sin botón "Anterior", sin menú, aviso de tiempo agotado (modal).
- [x] Pantalla 5 · Revisión del docente (modales de confirmar plagio y de reabrir con tiempo extra).
- [x] Pantallas pendientes (diseño §3): panel docente, crear/configurar examen, calificación manual, reportes, panel admin, examen anulado/bloqueado, resultados del alumno.
- [x] Revisión responsive en celular (390×844) y escritorio (1280×720): sin desbordes horizontales ni errores de consola en las 13 páginas; contraste ≥ 4.5:1. (RNF-15, RNF-16)
- [x] Pasada de auditoría/pulido con la skill Impeccable: sin tarjetas anidadas, superficies del navegador con la paleta (selección, `accent-color`, foco, interruptores), números tabulares en tablas.
- [x] Borrar `public/maquetas.html` (índice temporal) en la Fase 2.

**Listo cuando:** se navega por todas las pantallas en celular y escritorio sin desbordes horizontales.

### Fase 2 · Base de datos, cuentas y roles — 21–22 nov ✔ (terminada el 19 nov)
- [x] `schema.sql` con todas las tablas, restricciones únicas, `CHECK` de estados e índices de `modelo_de_datos.md` (idempotente).
- [x] Administrador inicial con `npm run db:migrar` (contraseña aleatoria mostrada una vez; `-- --nueva-contrasena-admin` la regenera). Sustituye a `seed.sql`.
- [x] Registro de alumnos con validación (usuario en minúsculas; contraseña ≥ 8 con letras y números), campo trampa y límite por IP. Sin captcha. (RF-01, RNF-04 · CU-18)
- [x] Inicio/cierre de sesión por rol: cookie `httpOnly`/`sameSite=strict`, token guardado como hash SHA-256, expiración fija de 8 h, bcrypt costo 10, redirección al panel del rol. (RF-02, RNF-01 · CU-01, 06, 19)
- [x] Una sola sesión activa por alumno: un nuevo inicio invalida la anterior. (RF-34, RNF-02)
- [x] Middleware `requiereRol(...)` en la API (401/403) y `requierePagina` en `/alumno`, `/docente`, `/admin` (redirige; `no-store`). (RNF-05)
- [x] Panel admin conectado: crear, desactivar y activar docentes; restablecer la contraseña de docentes o alumnos (cierra sus sesiones); estado del sistema e incidentes recientes reales. Los docentes reciben 403. (RF-03, 04, 05, 06 · CU-02 a 05)
- [x] Bitácora de auditoría para acciones del administrador. (RNF-08)
- [x] `helmet`, consultas parametrizadas y límite de intentos de inicio de sesión (10 fallos/15 min por IP + usuario, para no bloquear al plantel completo). `TRUST_PROXY` solo detrás de Nginx. (RNF-04, RNF-06)
- [x] Prueba de integración `npm test` (5 casos, `test/auth.test.js`).

**Listo cuando:** cada rol entra a su panel y un alumno recibe 403 al llamar rutas de docente/admin.

### Fase 3 · Materias, grupos e inscripción — 22–23 nov ✔ (terminada el 19 nov)
- [x] Materias y grupos del docente: crear materia, crear grupo, activar/desactivar grupo (inactivo = no acepta inscripciones), eliminar materia solo si no tiene grupos, ver alumnos inscritos. Todo filtrado por `docente_id`; lo ajeno responde 404. (RF-07, RF-45 · CU-07)
- [x] Código de inscripción único de 6 caracteres sin ambiguos (sin 0/O/1/I/L), aleatorio criptográfico, con reintento ante colisión. (RF-08)
- [x] Inscripción del alumno por código (acepta minúsculas y espacios) con mensajes de código inválido / grupo inactivo / ya inscrito; límite de 20 códigos inválidos por 15 min contra adivinación. (RF-09 · CU-20)
- [x] Panel del docente conectado: materias, grupos con código (botón Copiar), conteo de alumnos con lista, y lista real de exámenes (vacía hasta la Fase 4). Panel del alumno: inscripción y "Mis grupos" reales; la tabla de exámenes muestra un aviso honesto hasta la Fase 5.
- [x] Prueba de integración `test/grupos.test.js` (5 casos); ayudantes comunes en `test/ayuda.js` con limpieza por sufijo (los archivos corren en paralelo).

### Fase 4 · Creación y configuración de exámenes — 23–24 nov ✔ (terminada el 19 nov)
- [x] Editor de examen (`examen-editar.html?id=`): preguntas abiertas, opción múltiple (2–10 opciones, una correcta) y V/F capturadas a mano, con puntos y resumen de total; aviso al salir con cambios sin guardar. (RF-11, RF-12 · CU-08)
- [x] Imagen por pregunta: PNG/JPG ≤ 2 MB, tipo verificado por sus primeros bytes, nombre aleatorio con prefijo del docente, servida solo por `/api/imagenes` (no estática) y solo a su dueño por ahora. (RF-13)
- [x] Configuración: ventana abre/cierra (varios días), duración, umbral de inactividad, mostrar respuestas, calculadora permitida. (RF-14, 15, 17, 18, RF-31 · CU-09)
- [x] Asignación a uno o varios grupos propios (el servidor verifica que sean del docente). (RF-10 · CU-10)
- [x] Validación en el servidor (`services/examenes.js`): un borrador solo exige título; programar exige preguntas, ventana futura válida, duración y grupos, y muestra la lista de faltantes. Guardar reemplaza el examen en una transacción con `FOR UPDATE`; un examen iniciado por algún alumno ya no se edita ni elimina. El panel muestra Borrador / Programado / Abierto / Cerrado según la ventana, con Editar (o Consultar) y Eliminar.
- [x] Tiempo extra por alumno (1–240 min) solo para alumnos inscritos en los grupos del examen. **Cambio al modelo:** tabla nueva `tiempo_extra` (documentada en `modelo_de_datos.md`); se copia a `intento.tiempo_extra_min` al iniciar (Fase 5). (RF-16 · CU-11)
- [x] Prueba `test/examenes.test.js` (7 casos: validador + API + imágenes). Suite completa: 17/17.

### Fase 5 · Presentación del examen (núcleo) — 23–25 nov ✔ (terminada el 19 nov)
- [x] Lista de exámenes del alumno con su estado (Presentar, Continuar, Aún no disponible, Cerrado, Enviado: pendiente, Calificado, Bloqueado, Abandonado). (RF-20 · CU-21)
- [x] Pantalla de instrucciones con datos reales (preguntas, duración + tiempo extra, umbral, instrucciones del docente, calculadora) y aceptación explícita; al aceptar se crea el `intento` con IP, `inicio_en`, semilla y tiempo extra copiado. La sesión se extiende hasta el fin del examen + 15 min. (RF-21, RF-32 · CU-22)
- [x] Una sola oportunidad (restricción única); fuera de ventana, no asignado o ya presentado → sin acceso. **Decisión:** la ventana limita el inicio; una vez iniciado, el alumno tiene su duración completa. (RF-22)
- [x] Orden aleatorio de preguntas y de opciones múltiples con `semilla_aleatoria` reproducible (mulberry32 + Fisher-Yates); V/F conserva su orden. (RF-19)
- [x] Una pregunta a la vez; el servidor solo acepta respuestas de la pregunta en `intento.posicion` (**columna nueva**), y el avance es idempotente ante doble clic. (RF-23)
- [x] Autoguardado con *upsert* en una cola ordenada (radio al instante, texto con 1.2 s de retardo) y confirmación "Respuesta guardada". (RF-24, RNF-11 · CU-26)
- [x] Tiempo calculado por PostgreSQL (`inicio_en + duración + extra − now()`), reloj local monótono resincronizado cada 30 s, color de aviso y anuncio a lectores de pantalla en los últimos 5 y 1 min; el servidor rechaza respuestas fuera de tiempo (gracia de 5 s por latencia). (RF-25 · CU-25)
- [x] Al agotarse el tiempo: el servidor cierra el intento y el alumno ve el aviso con lo respondido guardado. (RF-26)
- [x] Envío final (con confirmación) → `ENVIADO` y calificación automática de cerradas en escala 0–10 sobre el total de puntos; las abiertas cuentan 0 hasta la calificación manual. (RF-38 · CU-29)
- [x] Ninguna respuesta de la API del alumno contiene `es_correcta` (verificado por prueba). Imágenes visibles para el alumno solo durante su intento abierto. (RNF-07, RF-13)
- [x] Prueba `test/presentacion.test.js` (8 casos). Suite completa: 25/25.

### Fase 6 · Seguridad y antiplagio — 24–25 nov ✔ (terminada el 19 nov)
- [x] Socket.IO autenticado con la misma cookie de sesión y ligado al intento abierto (`server/sockets.js`); latidos cada 10 s.
- [x] Cambio de pestaña (`visibilitychange`) o de ventana (pérdida de foco confirmada a 1.5 s, sin contar los `confirm()` propios) → `CAMBIO_PESTANA`, intento `ANULADO`. (RF-30 · CU-27)
- [x] Inactividad ≥ umbral del examen → `INACTIVIDAD` y anulación; aviso visible 30 s antes. (RF-31)
- [x] Sin socket más de 20 s (o la página del examen nunca se conecta tras iniciar) → `CONEXION_PERDIDA`, intento `ABANDONADO`; aviso inmediato al alumno. Recargar dentro de la tolerancia retoma el examen. (RF-27)
- [x] Iniciar sesión con un examen abierto y otra sesión viva → `SESION_DUPLICADA`, anulación y cierre de la sesión anterior. (RF-34)
- [x] Evidencia: tipo, hora, IP (respeta `TRUST_PROXY`) y user agent; `expira_en = ocurrio_en + 7 días`. El navegador solo puede reportar `CAMBIO_PESTANA` e `INACTIVIDAD`; un incidente con el tiempo ya agotado solo envía el examen. (RF-32, RF-36 · CU-28)
- [x] Pantalla `bloqueado.html` con motivo, fecha y respuestas guardadas; el panel enlaza "ver motivo". (RF-28)
- [x] Bloqueo de copiar, cortar, pegar, soltar, clic derecho y Ctrl+P en `examen.html`; la impresión sale en blanco. (RF-35)
- [x] Purga de incidentes vencidos al arrancar y cada 24 h; no toca intentos ni respuestas. (RF-37, RNF-09 · CU-30)
- [x] Prueba `test/seguridad.test.js` (6 casos, incluye un cliente Socket.IO mínimo por long-polling). Suite completa: 31/31.

### Fase 7 · Revisión, calificación y reportes — 25–26 nov ✔ (terminada el 19 nov)
- [x] Lista de exámenes anulados o abandonados pendientes de decisión, con evidencia (tipo, hora, IP, dispositivo resumido) o aviso si ya expiró. (RF-40 · CU-12)
- [x] Confirmar plagio → anulación definitiva en `intento.plagio_confirmado` (**columna nueva**: la decisión sobrevive a la purga de evidencias). (RF-33 · CU-13)
- [x] Descartar y reabrir → `REABIERTO`: recupera el tiempo que le quedaba al anularse más el extra (0–240 min); el tiempo corre desde que se reabre y continúa en la pregunta donde iba. (RF-41 · CU-14)
- [x] Calificación manual de abiertas (0 a los puntos de la pregunta, hasta 2 decimales) con comentario y recálculo 0–10. (RF-39 · CU-15)
- [x] Publicar resultados de los enviados; se rechaza si faltan abiertas por calificar y se puede repetir para los que envíen después. El alumno ve su nota y, si el docente lo permite, sus respuestas, las correctas y los comentarios. (RF-17, RF-29 · CU-16, CU-24)
- [x] Reportes de calificaciones (incluye a quien no presentó), incidentes y estadísticas (promedio, aprobados con 7 o más, máx./mín., distribución), solo de exámenes propios. (RF-43, RF-45 · CU-17)
- [x] Exportar a Excel (3 hojas, con el user agent completo) y PDF. (RF-44)
- [x] Panel admin: estado del sistema e incidentes (hecho en la Fase 2). (RF-06 · CU-05)
- [x] Auditoría de confirmar, reabrir, calificar y publicar. (RNF-08)
- [x] Prueba `test/calificacion.test.js` (6 casos). Suite completa: 37/37.

### Fase 8 · Despliegue — 24–25 nov (en paralelo) · cambio de plan: túnel de Cloudflare
> **Decisión (19 nov):** Oracle Cloud pide tarjeta de crédito para crear la cuenta y no se pudo obtener. El sistema se publica desde una PC con **Cloudflare Tunnel** (modo rápido, `cloudflared tunnel --url http://localhost:3000`), que da HTTPS sin abrir puertos. Primera dirección pública: `https://makes-fence-railroad-wells.trycloudflare.com`. Los pasos de Oracle (VM, Nginx, DuckDNS, Certbot, systemd) se recortan.
- [x] Aplicación accesible por internet con HTTPS, base de datos conectada y Socket.IO respondiendo. Comprobado el 19 nov: `/api/salud` → `db: true`, cabeceras HSTS y CSP presentes, `/.env` → 404. (RNF-03)
- [x] Confirmar en el `.env` del servidor `NODE_ENV=production` y `TRUST_PROXY=1`, y que los incidentes registran la IP real del alumno, no `127.0.0.1`. (RF-32, RF-36) — 20 nov: un incidente de prueba por Tailscale Funnel registró una IP pública (no `127.0.0.1` ni `100.x`): Funnel envía `X-Forwarded-For` con la IP del cliente.
- [x] Dirección estable: se adopta **Tailscale Funnel** (`https://xero.tail2ea70b.ts.net`), que además no tiene el límite de 200 peticiones del túnel rápido. Antes: la del modo rápido cambia cada vez que se reinicia `cloudflared`. Opciones: túnel con nombre (requiere dominio) o Tailscale Funnel. Si no, avisar la dirección nueva antes de cada examen.
- [~] Arranque automático de la app y del túnel al encender la PC, y PC sin suspensión ni reinicios de Windows en días de examen. — `deploy/iniciar-servidor.cmd` (reinicia node a los 5 s si se cae; probado en local) + tarea programada como SYSTEM + Tailscale *Run unattended* + `powercfg` (`DESPLIEGUE.md` pasos 5–7). Falta aplicarlo en la PC del compañero y probar un reinicio sin iniciar sesión.
- [~] Respaldo de la base con `pg_dump` (diario y antes de cada ventana de examen) copiado fuera de esa PC. (RNF-14) — `deploy/respaldo.ps1` (BD en formato `pg_restore` + imágenes en zip, 14 días; probado en local: 14 tablas con datos) y tarea diaria a una carpeta de OneDrive/Google Drive (`DESPLIEGUE.md` paso 8). Falta aplicarlo en la PC del compañero.
- [~] Guía de despliegue repetible (RNF-17): `DESPLIEGUE.md` reescrito para Windows + Tailscale Funnel; la de Oracle pasa a `docs/DESPLIEGUE_ORACLE.md`. Se cierra al completar su comprobación final (paso 9) en la PC del compañero.

### Fase 9 · Pruebas — 25–26 nov
- [x] Pruebas funcionales por caso de uso (CU-01 a CU-30): los 30 tienen prueba automática de la API (`npm test`, 45 pruebas) y recorrido de pantallas en Chrome durante su fase (ver Changelog). Lo que solo ocurre en el navegador (detección de pestaña e inactividad, temporizador visible) se repite en celulares reales (abajo) y en la comprobación final de `DESPLIEGUE.md` §9.

  | CU | Prueba automática (`test/…` · prueba) | Pantallas (recorrido en Chrome) |
  |---|---|---|
  | 01, 06, 19 · Iniciar y cerrar sesión | `auth` · inicio de sesión por rol; sesión única y cierre · `ataques` · cada rol solo entra a su API | Fase 2 |
  | 02 · Crear docente | `auth` · el administrador gestiona docentes (contraseña mostrada una vez, auditoría) | Fase 2 |
  | 03 · Desactivar docente | `auth` · ídem (desactivar y reactivar) | Fase 2 |
  | 04 · Restablecer contraseña | `auth` · ídem (no restablece administradores) | Fase 2 |
  | 05 · Estado e incidentes | `seguridad` · inactividad… el administrador la ve en su panel | Fase 2 |
  | 07 · Materias y grupos | `grupos` · crea materias y grupos con código; no ve lo de otro; grupo inactivo | Fase 3 |
  | 08 · Crear examen | `examenes` · borrador y programar; reglas por tipo; imágenes PNG/JPG | Fase 4 |
  | 09 · Configurar examen | `examenes` · `validarExamen` (ventana, duración, umbral); `calificacion` · respuestas visibles solo si se permite | Fase 4 (herramienta permitida: solo muestra la regla en instrucciones) |
  | 10 · Asignar a grupos | `examenes` · grupos validados contra el docente; `presentacion` · el alumno ve solo lo asignado | Fase 4 |
  | 11 · Tiempo extra | `examenes` · tiempo extra validado; `presentacion` · el intento copia los 10 min extra | Fase 4 |
  | 12 · Revisar anulados | `calificacion` · el docente ve solo sus anulados, con evidencia | Fase 7 |
  | 13 · Confirmar o descartar | `calificacion` · confirmar plagio (definitivo, en bitácora); descartar = reabrir | Fase 7 |
  | 14 · Reabrir | `calificacion` · recupera el tiempo restante más el extra y continúa donde iba | Fase 7 |
  | 15 · Calificar abiertas | `calificacion` · calificación manual con comentario y recálculo | Fase 7 |
  | 16 · Publicar | `calificacion` · publicar exige calificar todo | Fase 7 |
  | 17 · Reportes y exportación | `calificacion` · JSON, Excel y PDF, solo del dueño | Fase 7 |
  | 18 · Registrarse | `auth` · valida datos y duplicados; `ataques` · no permite elegir rol | Fase 2 |
  | 20 · Inscribirse con código | `grupos` · inscripción con código | Fase 3 |
  | 21 · Exámenes asignados | `presentacion` · solo los asignados a sus grupos | Fase 5 |
  | 22 · Instrucciones y reglas | `presentacion` · iniciar exige aceptar y crea un solo intento | Fase 5 |
  | 23 · Presentar | `presentacion` · solo la pregunta actual, en orden; sin respuesta correcta en el navegador | Fase 5 (a 390 px) |
  | 24 · Consultar resultados | `calificacion` · el alumno ve su nota y el detalle solo si se permite | Fase 7 |
  | 25 · Temporizador | `presentacion` · al agotarse el tiempo el servidor cierra y rechaza respuestas | Fase 5 |
  | 26 · Autoguardado | `presentacion` · autoguardado (upsert); `tolerancia` · sobrevive a una caída del servidor; `carga` · 2 000/2 000 | Fase 5 |
  | 27 · Detectar y anular | `seguridad` · cambio de pestaña; inactividad; sesión duplicada; socket abandonado | Fase 6 (detección en el navegador) |
  | 28 · IP y evidencias | `seguridad` · IP, dispositivo y retención de 7 días; IP real comprobada por Funnel (Fase 8) | Fase 6 |
  | 29 · Calificación automática | `presentacion` · al enviar se califica automáticamente | Fase 5 |
  | 30 · Eliminar evidencias | `seguridad` · la purga borra evidencias vencidas sin tocar calificaciones | — (tarea interna) |
- [x] Pruebas de seguridad: acceso cruzado entre roles y docentes, inyección SQL, XSS en enunciados y respuestas, manipulación de IDs. (RNF-05, RNF-06) — `test/ataques.test.js`, más las de dueño en `grupos`, `examenes`, `presentacion` y `calificacion`. Hallazgo corregido: una petición de más de 100 KB respondía 500 en vez de 413.
- [x] Prueba de tolerancia: el servidor (en otro proceso) se mata sin aviso a mitad de examen y al volver el alumno sigue en su pregunta con lo autoguardado. (RNF-13) — `test/tolerancia.test.js`. Observación: los temporizadores de abandono viven en memoria y se pierden al reiniciar; un alumno que no vuelve queda `EN_CURSO` hasta que se acaba su tiempo.
- [x] **Prueba de carga con 200 alumnos simultáneos** (`npm run carga -- <url> 200 10`): 200 alumnos entran en 10 s, abren socket y responden 10 preguntas con autoguardado. (RNF-10, RNF-11, RNF-12)
  - [x] Local (19 nov, PC de desarrollo): 6 800 operaciones en 53.6 s, 0 errores, 200/200 enviados, 2 000/2 000 respuestas guardadas, 0 abandonados. p95: entrar 47 ms, pedir pregunta 3 ms, autoguardar 4 ms, avanzar 4 ms; máximo 138 ms.
  - [x] Servidor real (PC del compañero, túnel rápido de Cloudflare), 19 nov: **no aprobada**. 6 377 operaciones en 56.7 s; 40 respuestas 429 (*Too Many Requests*) repartidas en todas las rutas; 173/200 enviados, 1 846/2 000 respuestas. p95 120–322 ms. Causa: los túneles rápidos de Cloudflare admiten como máximo 200 peticiones en curso y responden 429 al rebasarlo ([docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)); cada alumno mantiene abierta su conexión de Socket.IO, así que 200 alumnos ocupan casi todo el cupo. Los 429 no vienen de la app: esas rutas no tienen límite propio, y en local no hubo ninguno. Los "abandonados" y "sin terminar" son en parte del script, que se rinde al primer 429 y cierra el socket; un navegador real mostraría el error y el alumno reintentaría.
  - [x] Repetir en un medio sin ese límite. Tailscale Funnel (`https://xero.tail2ea70b.ts.net`), 20 nov: 0 errores 429 y HTTP rápido (p95 ≤ 74 ms), pero el servidor rechazó los 200 sockets del script; sin socket, a los 20 s cada intento quedó abandonado (RF-27 funcionando) y de ahí los 409. Desde internet un socket sí abre a través de Funnel y el servidor responde `sin-sesion` a uno sin cookie, así que el túnel deja pasar WebSocket. Causa encontrada (segunda corrida, "error de conexión"): fallo del script, no del servidor. La URL se pasó con "/" final y el script armaba el socket en `//socket.io/`; ya se normaliza. **Tercera corrida con el script corregido: APROBADA** (200/200 enviados, 2 000/2 000 respuestas, sin errores). Faltan las cifras de tiempos de esa corrida para el reporte de pruebas. Nota: corrido en la misma PC del servidor, el tráfico a `*.ts.net` puede no pasar por el relevo público de Funnel.
- [ ] Pruebas en celular reales (Android/iOS) para falsos positivos de cambio de pestaña:
  - [ ] Examen completo en Android (Chrome) y en iPhone (Safari) con datos móviles, no Wi-Fi.
  - [ ] Llega una notificación y no se toca: no debe anular.
  - [ ] Se abre otra app o se cambia de pestaña: debe anular y mostrar el motivo.
  - [ ] Se bloquea la pantalla 10 s y se vuelve: anotar qué pasa (ver advertencia en instrucciones).
  - [ ] Se activa el modo avión 10 s y se quita: aviso de conexión y continúa; más de 20 s: abandonado.
  - [ ] Girar el celular y escribir una respuesta abierta larga con el teclado en pantalla: no debe anular.

### Fase 11 · Cambios del cliente: cuentas, contraseñas y logotipo — 20 nov ✔ (terminada el 20 nov)
Requerimientos nuevos que pidió el cliente el 20 nov (amplían RF-03 a RF-05; aún no están numerados en `Req.md`).
- [x] Docentes y administradores cambian su contraseña en **Mi cuenta** (piden la actual; cierra las sesiones de otros equipos y deja abierta la de este).
- [x] Docentes y administradores registran o cambian su correo en **Mi cuenta** (pide la contraseña actual, para que una sesión robada no pueda desviar la recuperación).
- [x] Al crear un docente, el correo es obligatorio y la contraseña inicial **se envía a ese correo** (Nodemailer por SMTP, p. ej. Gmail con contraseña de aplicación). Si no hay SMTP configurado o el envío falla, se muestra una vez en pantalla como respaldo.
- [x] El administrador crea **otros administradores** (mismo formulario, "Tipo de cuenta") y los activa o desactiva; nadie puede desactivarse a sí mismo, así siempre queda uno. La tabla del panel lista docentes y administradores con su correo, que el administrador puede editar.
- [x] **"¿Olvidaste tu contraseña?"** en el acceso, para docentes y administradores con correo: enlace de un solo uso, válido 60 min, guardado como hash; respuesta idéntica exista o no la cuenta; límite de 10 solicitudes/15 min por IP; el enlace usa `URL_PUBLICA`, nunca el encabezado `Host`. Al usarlo se cierran todas sus sesiones. Los alumnos siguen pidiendo el restablecimiento al administrador.
- [x] El restablecimiento que hace el administrador manda la nueva contraseña al correo del docente (al alumno se le sigue mostrando en pantalla).
- [x] Logotipo oficial: `logo.png` pasa a `public/img/`; de él salen el emblema blanco del encabezado y el icono de la pestaña (emblema sobre el azul institucional) en las 15 páginas.
- [x] Pruebas: 4 casos nuevos en `test/auth.test.js` (alta con correo, otros administradores, Mi cuenta, recuperación de un solo uso). Los correos se capturan en memoria; no se envía nada real.
- [ ] Probar el envío real con la cuenta de Gmail de la plataforma en el servidor (`DESPLIEGUE.md` §4 y §9) y registrar el correo del administrador y de los docentes existentes, que hoy no tienen.
- [ ] Actualizar `Req.md`, `CasosD_Uso.md`, el manual de usuario y la presentación con estas funciones.

### Fase 10 · Documentación y entrega — 26–27 nov
- Manual de usuario, resultados de pruebas, `README.md`, presentación y reporte de desarrollo: se siguen en [`PLAN_COMPLEMENTARIO.md`](PLAN_COMPLEMENTARIO.md) §3.
- [ ] ◆ **Entrega 27 nov.**

---

## 5. Recortes si falta tiempo (en este orden)
1. Estadísticas avanzadas (dejar promedio y distribución simple).
2. Exportación a PDF (dejar Excel).
3. Herramienta externa permitida (RF-18).
4. Bloqueo de copiar/pegar (RF-35).

**No se recortan:** Fases 5 y 6 (presentación del examen y seguridad).

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| ~~Oracle sin capacidad o cambio de cuota gratuita~~ Ocurrió: Oracle exige tarjeta de crédito | Se publica con Cloudflare Tunnel desde una PC (Fase 8). |
| La PC que hospeda se apaga, se suspende o se reinicia durante un examen | Desactivar suspensión y posponer actualizaciones; los alumnos desconectados más de 20 s quedan como abandonados y el docente puede reabrir. |
| El túnel rápido admite máximo 200 peticiones en curso; con unos 200 alumnos conectados responde 429 (comprobado en la prueba de carga) | Cambiar a Tailscale Funnel o túnel con nombre; mientras tanto, el túnel rápido sirve para grupos bien por debajo de 200 alumnos a la vez. |
| La dirección del túnel rápido cambia al reiniciar | Túnel con nombre o Tailscale Funnel; si no, comunicar la nueva dirección antes del examen. |
| Falsos positivos en celular (llamadas, notificaciones) | Advertencia explícita en instrucciones; el docente revisa y puede reabrir. |
| Pérdida de respuestas con carga alta | Autoguardado por *upsert* inmediato; prueba de carga antes de uso real. |
| IP compartida o cambiante | Se guarda solo como evidencia, nunca como prueba automática. |

## 6.1 Hallazgos abiertos
- [x] **Calculadora integrada (RF-18, prioridad D):** la opción existía pero la pantalla del examen no tenía calculadora. Corregido el 20 nov: calculadora en la misma página (+ − × ÷, paréntesis, decimales), solo cuando el docente la permite.
- [ ] Temporizadores de abandono en memoria (ver Fase 9, prueba de tolerancia).

## 7. Pendientes con el cliente (de `Req.md` §9) que afectan el desarrollo
- [ ] Umbral de inactividad por defecto (propuesta: 3 min, configurable por examen).
- [ ] Retención de 7 días desde el incidente o desde el cierre del examen (implementado: desde el incidente).
- [ ] Alcance del plagio (implementado: solo comportamiento).
- [~] Logotipos, colores y tipografía oficiales del TecNM: el logotipo ya se recibió y está aplicado (Fase 11); colores y tipografía siguen provisionales.
- [ ] Cuenta de correo desde la que la plataforma envía contraseñas y enlaces de recuperación (propuesta: una cuenta de Gmail solo para la plataforma).

## 8. Trazabilidad rápida

| Fase | Requerimientos | Casos de uso |
|---|---|---|
| 1 | RNF-15, 16, 19–22 | — |
| 2 | RF-01–05, RF-34, RNF-01, 02, 04, 05, 06, 08 | CU-01–04, 06, 18, 19 |
| 3 | RF-07–09 | CU-07, 20 |
| 4 | RF-10–19 | CU-08–11 |
| 5 | RF-19–26, RF-32, RF-38, RNF-07, 11 | CU-21–23, 25, 26, 29 |
| 6 | RF-27, 28, 30, 31, 34–37, RNF-09 | CU-27, 28, 30 |
| 7 | RF-06, 17, 29, 33, 39–45, RNF-08 | CU-05, 12–17, 24 |
| 8 | RNF-03, 14, 17 | — |
| 9 | RNF-05, 06, 10, 12, 13 | todos |
| 11 | RF-03–05 ampliados (cambios del cliente del 20 nov), RNF-04, 06, 08, 21 | CU-01–04 |

---

## 9. Changelog

Formato: `AAAA-MM-DD · Fase · descripción · (RF/CU) · archivos`. Lo más reciente arriba.

- **2026-11-20** · Fase 11 · Cambios del cliente. Mi cuenta para docentes y administradores (cambiar contraseña y correo, ambos con la contraseña actual). Alta de cuentas con correo obligatorio y tipo Docente/Administrador; la contraseña inicial y la restablecida se envían por correo con Nodemailer, con respaldo en pantalla si no hay SMTP. "¿Olvidaste tu contraseña?" con enlace de un solo uso de 60 min. API: `POST /api/auth/contrasena`, `/correo`, `/olvide`, `/recuperar`; `/api/admin/docentes` pasa a `/api/admin/cuentas` (GET, POST, PATCH con `activo` o `correo`). Cambio al modelo: `usuario.correo` (único), `recuperacion_hash`, `recuperacion_expira`; se aplican con `npm run db:migrar`. Nuevas variables `URL_PUBLICA` y `SMTP_*` en `.env`. Logotipo oficial en `public/img/` con emblema del encabezado e icono de pestaña generados a partir de él. El panel del administrador pone la tabla de cuentas a todo el ancho. Verificado: `npm test` 50/50 (4 nuevas; la de caída del servidor falló una vez y pasó en tres corridas más); recorrido en Chrome a 1280 y 390 px (acceso con enlace, recuperar con mensaje genérico y con enlace inválido, alta de docente sin SMTP con respaldo en pantalla, tabla de cuentas, Mi cuenta con contraseña errónea y correo guardado) sin errores de consola ni desbordes. Sin probar: envío real por SMTP. (RF-03 a 05 · RNF-04, 06, 08, 21 · CU-01 a 04) · `server/db/schema.sql`, `server/services/correo.js`, `server/routes/auth.js`, `server/routes/admin.js`, `public/index.html`, `public/recuperar.html`, `public/admin/panel.html`, `public/admin/cuenta.html`, `public/docente/cuenta.html`, `public/js/admin.js`, `public/js/cuenta.js`, `public/js/recuperar.js`, `public/js/acceso.js`, `public/js/layout.js`, `public/css/app.css`, `public/img/*`, todas las páginas (icono), `test/auth.test.js`, `.env.example`, `DESPLIEGUE.md`, `modelo_de_datos.md`, `package.json`

- **2026-11-20** · Fase 10 · Presentación de 16 diapositivas (problema, estado del arte, objetivo, roles, flujo, antiplagio, pantallas, arquitectura, seguridad, pruebas, despliegue, metodología, demostración con plan de contingencia y cierre), con notas del orador y capturas reales. Publicada como artifact privado en claude.ai; se descarga como PowerPoint o PDF. · `PLAN_COMPLEMENTARIO.md`

- **2026-11-20** · Fase 10 · `README.md` (qué es, instalación local, pruebas, despliegue, estructura y documentos). En `CasosD_Uso.md`: avance real frente al Gantt planeado (§1.1) y descripción de la metodología de desarrollo (§1.2), que pide `Req.md` §10. · `README.md`, `CasosD_Uso.md`, `PLAN_COMPLEMENTARIO.md`

- **2026-11-20** · Fase 10 · Primer commit del proyecto (`17ee9ae`, 132 archivos; sin `.env`, `node_modules`, imágenes subidas ni registros). Documento de resultados de pruebas en Word (11 páginas); la tabla de casos de uso se toma de este plan al generarlo. Falta la tabla de tiempos de la corrida aprobada en Tailscale y las pruebas en celulares. Se marca como recortada la cuenta de Oracle (Fase 0). · `docs/Resultados_de_Pruebas.docx`, `PLAN_COMPLEMENTARIO.md`

- **2026-11-20** · Corrección · Calculadora integrada en la pantalla del examen, visible solo si el docente activó «Permitir calculadora integrada». Evaluador propio sin `eval` (solo números, + − × ÷, paréntesis y decimales; rechaza cualquier otro texto), teclas de 48 px y uso con teclado (Enter calcula). Va en la misma página, así que no cuenta como cambio de pestaña. Las reglas de las instrucciones ahora dicen dónde está y advierten no usar la del celular. Verificado: `npm test` 47/47 (2 pruebas nuevas del evaluador); en Chrome a 390×844, `12×(3+4)=84` y `÷7` desde el teclado `=12`, el intento sigue `EN_CURSO` y en un examen sin permiso la calculadora no aparece. Manual de usuario actualizado (16 figuras). (RF-18 · CU-09, CU-23) · `public/js/calculadora.js`, `public/alumno/examen.html`, `public/js/examen.js`, `public/alumno/instrucciones.html`, `public/css/app.css`, `test/calculadora.test.js`, `docs/Manual_de_Usuario.docx`

- **2026-11-20** · Fase 10 · Manual de usuario en Word (21 páginas): acceso, alumno (cuenta, inscripción, estados, reglas, presentar, anulado, resultados), docente (materias y grupos, editor de exámenes, revisión, calificar y publicar, reportes), administrador y problemas frecuentes, con 15 capturas reales tomadas con Chrome en español sobre datos de ejemplo que se borran al terminar. Hallazgo: la opción de calculadora integrada no tiene calculadora en la pantalla del examen (§6.1). · `docs/Manual_de_Usuario.docx`, `PLAN_COMPLEMENTARIO.md`

- **2026-11-20** · Fase 9 · Trazabilidad de pruebas por caso de uso: tabla CU-01 a CU-30 con su prueba automática y su recorrido en Chrome. Se cubren los dos huecos encontrados con una prueba nueva: incidente por inactividad (antes solo se probaba el cambio de pestaña) y contenido del panel del administrador (antes solo el acceso). IP real por Funnel confirmada con un incidente de prueba. Verificado: `npm test` 45/45. (CU-01 a CU-30, RF-31, RF-32) · `test/seguridad.test.js`, `PLAN_DESARROLLO.md`

- **2026-11-20** · Fase 8 · `DESPLIEGUE.md` reescrito para una PC con Windows y Tailscale Funnel: instalación, base de datos, `.env`, Funnel con *Run unattended*, arranque automático con tarea programada y reinicio ante fallas, energía y Windows Update, respaldos diarios a la nube con restauración, comprobación final, operación y problemas frecuentes. Scripts nuevos `deploy/iniciar-servidor.cmd` y `deploy/respaldo.ps1`, probados en local (reinicio tras matar node; respaldo legible por `pg_restore`). La guía de Oracle se mueve a `docs/`. `logs/` al `.gitignore`. Sin probar: registro de tareas (requiere administrador) y lectura de la IP real detrás de Funnel. (RNF-14, RNF-17) · `DESPLIEGUE.md`, `docs/DESPLIEGUE_ORACLE.md`, `deploy/iniciar-servidor.cmd`, `deploy/respaldo.ps1`, `.gitignore`

- **2026-11-20** · Fase 8/9 · Prueba de carga **aprobada** en el servidor real con Tailscale Funnel (200 alumnos, 10 preguntas, todos enviados y sin respuestas perdidas). Se adopta Tailscale Funnel como medio de publicación. Corrección del script: normaliza la URL con "/" final, que rompía el socket. (RNF-10, RNF-11, RNF-12) · `test/carga.js`, `PLAN_DESARROLLO.md`

- **2026-11-19** · Fase 9 · Prueba de carga en el servidor real (túnel rápido de Cloudflare): no aprobada por el límite de 200 peticiones en curso del túnel rápido (40 respuestas 429; 173/200 exámenes enviados). La app no generó los 429. Se registra el riesgo y queda pendiente repetirla en un medio sin ese límite. (RNF-10, RNF-12) · `PLAN_DESARROLLO.md`

- **2026-11-19** · Fase 9 · Pruebas de seguridad (roles, inyección SQL, XSS, IDs manipulados, asignación masiva, cuerpos mal formados), de tolerancia a caídas (proceso del servidor matado a mitad de examen) y script de carga `npm run carga`. Corrección: el manejador de errores devolvía 500 para peticiones demasiado grandes; ahora 413. `ayuda.js` separa `cliente(base)` para probar servidores en otro proceso. Verificado: `npm test` 44/44 sin restos; carga local con 200 alumnos y 10 preguntas sin errores ni respuestas perdidas (p95 ≤ 47 ms). Falta la carga en el servidor real y las pruebas en celulares. (RNF-05, 06, 10–13) · `server/app.js`, `test/ataques.test.js`, `test/tolerancia.test.js`, `test/carga.js`, `test/ayuda.js`, `package.json`

- **2026-11-19** · Fase 8 · Cambio de despliegue: Oracle Cloud descartado (exige tarjeta de crédito); el sistema se publica con Cloudflare Tunnel desde una PC. Verificado desde fuera: página 200, `/api/salud` con BD conectada, Socket.IO 200, HSTS y CSP presentes, `/.env` 404. Se actualizan las tareas de la fase y los riesgos. (RNF-03) · `PLAN_DESARROLLO.md`

- **2026-11-19** · Fase 10 · Borrador del reporte de desarrollo, primer avance (.docx, individual): portada, índice, introducción, descripción del problema, estado del arte con 7 referencias APA 7 verificadas (DOI comprobados en Crossref), justificación y objetivos. Faltan en la portada carrera, asignatura, docente y número de control. · `docs/reporte/Reporte_Primer_Avance.docx`, `PLAN_COMPLEMENTARIO.md`

- **2026-11-19** · Fase 10 · Se crea `PLAN_COMPLEMENTARIO.md` para la documentación y el reporte de desarrollo: datos por confirmar, guía del primer avance (portada, introducción, descripción del problema, estado del arte, justificación, objetivos) y estado de cada entregable de `Req.md` §10. Las tareas de documentación de la Fase 10 se mueven ahí. · `PLAN_COMPLEMENTARIO.md`, `PLAN_DESARROLLO.md`

- **2026-11-19** · Fase 8 · Manual de despliegue `DESPLIEGUE.md`: cuenta de Oracle Cloud, VM Ampere A1 con Ubuntu 24.04, puertos (lista de seguridad e iptables), Node 24, PostgreSQL, Nginx con WebSocket, DuckDNS, HTTPS con Certbot, servicio systemd, respaldos diarios con copia fuera del servidor, comprobación final, actualización y problemas frecuentes. El empaquetado con `tar` de Windows se probó en local; el resto falta ejecutarlo en la VM. (Req §4.1, RNF-03, RNF-14, RNF-17) · `DESPLIEGUE.md`
- **2026-11-19** · Fase 7 · Revisión, calificación y reportes. Router `calificacion.js` en `/api/docente` (revisión, confirmar, reabrir, calificar, publicar, reporte JSON/XLSX/PDF) y servicio `reportes.js` (datos, estadísticas, Excel con exceljs y PDF con pdfkit). API del alumno `GET /api/alumno/intentos/:id/resultado`. Pantallas conectadas: En revisión (modales de decisión), Calificar (lista de alumnos y abiertas con puntos y comentario), Reportes (tres pestañas y descargas), Resultados del alumno; el panel del docente gana "Calificar" y el del alumno "Ver resultado"; `bloqueado.html` distingue la anulación confirmada. Cambio al modelo: columna `intento.plagio_confirmado`. Decisiones: al reabrir, el tiempo en pausa no cuenta y el reloj corre desde la reapertura; aprobatoria 7. Verificado: `npm test` 37/37 sin restos; recorrido en Chrome (revisión, confirmar, reabrir con 5 min y terminar, calificar dos alumnos, publicar con y sin pendientes, reportes y descargas reales de Excel y PDF, resultado del alumno con comentario, bloqueo confirmado) a 1280 y 390 px sin errores de consola ni desbordes; detector Impeccable sin hallazgos. (RF-17, RF-29, RF-33, RF-39 a 45 · RNF-08 · CU-12 a 17, CU-24) · `server/db/schema.sql`, `server/routes/calificacion.js`, `server/services/reportes.js`, `server/services/incidentes.js`, `server/services/intentos.js`, `server/routes/presentacion.js`, `server/app.js`, `public/docente/revision.html`, `public/docente/calificar.html`, `public/docente/reportes.html`, `public/alumno/resultados.html`, `public/alumno/bloqueado.html`, `public/js/revision.js`, `public/js/calificar.js`, `public/js/reportes.js`, `public/js/resultados.js`, `public/js/bloqueado.js`, `public/js/alumno.js`, `public/js/docente.js`, `public/js/api.js`, `public/css/app.css`, `test/calificacion.test.js`, `modelo_de_datos.md`
- **2026-11-19** · Fase 6 · Seguridad y antiplagio. Servicio `incidentes.js` (registrar con evidencia y cerrar el intento, sesión duplicada, purga), `sockets.js` (presencia por Socket.IO con tolerancia de 20 s), ruta `POST /api/alumno/intentos/:id/incidente`, detección de sesión duplicada al entrar y purga diaria en `app.js`. Cliente del examen: detección de cambio de pestaña/ventana e inactividad (con aviso previo), aviso de conexión perdida y bloqueo de copiar/pegar/clic derecho/impresión. `bloqueado.html` muestra el motivo real. Sin cambios al modelo. Verificado: `npm test` 31/31 sin restos; recorrido en Chrome a 390×844 (socket conectado, `confirm()` propio sin falso positivo, pestaña oculta → anulado, aviso y anulación por inactividad, conexión cortada → aviso y abandonado a los 20 s, panel con "ver motivo", 3 incidentes con IP y dispositivo en la BD) sin errores de consola ni desbordes; detector Impeccable sin hallazgos. (RF-27, RF-28, RF-30 a 37 · RNF-09 · CU-27, 28, 30) · `server/services/incidentes.js`, `server/sockets.js`, `server/routes/presentacion.js`, `server/routes/auth.js`, `server/app.js`, `public/alumno/examen.html`, `public/alumno/bloqueado.html`, `public/js/examen.js`, `public/js/bloqueado.js`, `public/js/alumno.js`, `public/css/app.css`, `test/ayuda.js`, `test/seguridad.test.js`
- **2026-11-19** · Fase 5 · Presentación del examen. API `/api/alumno/examenes` (lista, instrucciones, iniciar) e `/api/alumno/intentos/:id` (pregunta actual, autoguardar, avanzar). Servicios `aleatorio.js` (barajado reproducible) e `intentos.js` (tiempo en la BD, finalizar y calificar). Pantallas del alumno conectadas: panel con estados, instrucciones e examen (una pregunta a la vez, reloj del servidor, autoguardado en cola, envío con confirmación, aviso de tiempo agotado). Cambio al modelo: columna `intento.posicion`. Decisión: la ventana limita el inicio, no recorta la duración. La sesión se extiende al iniciar un examen. Verificado: `npm test` 25/25 sin restos; recorrido en Chrome a 390×844 (inscripción, Presentar, instrucciones, 3 preguntas en orden barajado con autoguardado, envío, panel "Enviado", tiempo agotado con aviso) sin errores de consola ni desbordes; detector Impeccable sin hallazgos. (RF-19 a 26, RF-32, RF-38 · RNF-07, 11 · CU-21 a 26, CU-29) · `server/db/schema.sql`, `server/services/aleatorio.js`, `server/services/intentos.js`, `server/routes/presentacion.js`, `server/routes/imagenes.js`, `server/middleware/auth.js`, `server/app.js`, `public/alumno/instrucciones.html`, `public/alumno/examen.html`, `public/js/instrucciones.js`, `public/js/examen.js`, `public/js/alumno.js`, `public/js/api.js`, `public/css/app.css`, `test/presentacion.test.js`, `modelo_de_datos.md`
- **2026-11-19** · Fase 4 · Creación y configuración de exámenes. API `/api/docente/examenes` (listar, ver, crear, reemplazar, eliminar) y `/api/imagenes` (subir y ver). Editor conectado con plantillas por tipo de pregunta, subida de imagen con vista previa, grupos y tiempo extra; el panel lista los exámenes con estado según la ventana. Cambio al modelo: tabla `tiempo_extra`. Corrección de raíz: `pg` devolvía los `bigint` como texto y fallaban las comparaciones de ID (`pool.js` ahora los convierte a número). Se renombra la clase de las opciones del examen a `opcion-respuesta` para no chocar con el editor. Verificado: `npm test` 17/17 sin restos; recorrido en Chrome headless (tres tipos de pregunta, imagen real subida y mostrada, borrador, programar incompleto con lista de faltantes, tiempo extra, programar, panel, reabrir y restaurar todo) sin errores de consola ni desbordes en celular; detector Impeccable sin hallazgos. (RF-10 a 18 · CU-08 a 11) · `server/db/schema.sql`, `server/db/pool.js`, `server/services/examenes.js`, `server/routes/examenes.js`, `server/routes/imagenes.js`, `server/routes/docente.js`, `server/app.js`, `public/docente/examen-editar.html`, `public/js/examen-editar.js`, `public/js/docente.js`, `public/js/api.js`, `public/docente/panel.html`, `public/alumno/examen.html`, `public/css/app.css`, `test/ayuda.js`, `test/examenes.test.js`, `modelo_de_datos.md`
- **2026-11-19** · Fase 3 · Materias, grupos e inscripción. API `/api/docente` (materias, grupos, activar, alumnos, exámenes) y `/api/alumno` (grupos, inscripciones). Toda consulta del docente filtra por su `docente_id`. Paneles del docente y del alumno conectados; los ayudantes de DOM (`el`, `filaVacia`, `$`) pasan a `api.js`. `DESIGN.md` gana los tokens tipográficos que faltaban (brand, clock, stat, control, logo-placeholder). Verificado: `npm test` 10/10 sin restos en BD; recorrido en Chrome headless (docente crea materia y grupos, alumno con código inválido, inscripción y repetida, docente ve 1 alumno en la lista) sin errores de consola ni desbordes en celular; detector Impeccable sin hallazgos. (RF-07 a 09, RF-45 · RNF-05 · CU-07, CU-20) · `server/services/codigos.js`, `server/routes/docente.js`, `server/routes/alumno.js`, `server/app.js`, `public/js/api.js`, `public/js/admin.js`, `public/js/docente.js`, `public/js/alumno.js`, `public/docente/panel.html`, `public/alumno/panel.html`, `public/css/app.css`, `test/ayuda.js`, `test/auth.test.js`, `test/grupos.test.js`, `DESIGN.md`, `.impeccable/*`
- **2026-11-19** · Fase 2 · Base de datos, cuentas y roles. Esquema completo en PostgreSQL (`npm run db:migrar`, se puede repetir) con administrador inicial. API `/api/auth` (registro, entrar, salir, yo) y `/api/admin` (estado, docentes, restablecer, incidentes). Sesiones propias en la tabla `sesion`, sesión única por alumno, páginas por rol protegidas en el servidor, límites de intentos, campo trampa en el registro y bitácora de auditoría. Pantallas conectadas: acceso/registro, cierre de sesión y panel del administrador (modal de contraseña que se muestra una vez). Se borra `maquetas.html`. Verificado: `npm test` 5/5 y recorrido en Chrome headless (registro con error y correcto, login de admin, alta de docente, cierre de sesión, redirección sin sesión, sin desbordes en celular, 0 errores de consola). (RF-01 a 06, RF-34 · RNF-01, 02, 04, 05, 06, 08 · CU-01 a 06, 18, 19) · `server/db/schema.sql`, `server/db/migrar.js`, `server/middleware/auth.js`, `server/routes/auth.js`, `server/routes/admin.js`, `server/services/contrasenas.js`, `server/services/auditoria.js`, `server/app.js`, `public/js/api.js`, `public/js/acceso.js`, `public/js/admin.js`, `public/js/layout.js`, `public/index.html`, `public/admin/panel.html`, `public/css/app.css`, `test/auth.test.js`, `package.json`
- **2026-11-18** · Fase 1 · Sistema de diseño documentado. Impeccable actualizado a v4.10.0 con el hook de diseño activo. Se crea `DESIGN.md` (idea central "El Aula Serena": sobrio e institucional, componentes firmes y claros), con tokens extraídos de `app.css`, y su complemento `.impeccable/design.json` (8 componentes de referencia). Las pantallas nuevas deben seguir `DESIGN.md`. · `DESIGN.md`, `.impeccable/design.json`, `.gitignore`
- **2026-11-18** · Fase 1 · Maquetas HTML + Bootstrap con la identidad provisional: 12 pantallas con datos de ejemplo más un índice temporal (`/maquetas.html`). Paleta centralizada en `app.css`; encabezado y pie comunes en `layout.js`. Verificado con Chrome headless a 390×844 y 1280×720: 0 desbordes y 0 errores de consola. Detector Impeccable: quedan 2 avisos aceptados (espacio para captcha en registro; etiqueta "Puntos" por pregunta) y la fuente Inter, que fija `disenos_de_interfaz.md`. (RNF-15, 16, 19–22 · RF-21, 23, 28) · `public/css/app.css`, `public/js/layout.js`, `public/js/instrucciones.js`, `public/index.html`, `public/maquetas.html`, `public/alumno/*`, `public/docente/*`, `public/admin/panel.html`
- **2026-11-18** · Fase 0 · BD local `webfranco` creada y verificada (`/api/salud` → 200, `db: true`). Fase 0 cerrada salvo Oracle, que sigue en paralelo. · `PLAN_DESARROLLO.md`
- **2026-11-18** · Fase 0 · Esqueleto del proyecto: dependencias instaladas, Bootstrap movido a `public/`, servidor Express con `helmet` y `/api/salud`, `.env`/`.env.example`, `.gitignore`, repositorio git. Verificado: `/` y Bootstrap responden 200, `/.env` y `/Req.md` responden 404. Aviso de `npm audit`: `uuid` (moderada) dentro de `exceljs`; no afecta al uso del proyecto. · `package.json`, `server/app.js`, `server/db/pool.js`, `public/index.html`, `.env.example`, `.gitignore`
- **2026-11-18** · Planeación · Se agrega `example.html` (5 maquetas) como referencia visual, con su equivalencia a clases de Bootstrap (§1.1). · `PLAN_DESARROLLO.md`
- **2026-11-18** · Planeación · Se analizan `Req.md`, `CasosD_Uso.md`, `modelo_de_datos.md` y `disenos_de_interfaz.md` y se crea este plan de desarrollo. Bootstrap 5.3.9 ya presente en `css/` y `js/`. · `PLAN_DESARROLLO.md`

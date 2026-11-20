# Plan del proyecto y casos de uso
## Plataforma web para la aplicación segura de exámenes asíncronos
**Institución:** Tecnológico de Cuautla (TecNM) · **Entrega:** 27 de noviembre de 2026 · **Presentación:** 30 de noviembre al 4 de diciembre

---

## 1. Diagrama de Gantt (18 al 27 de noviembre)

Se asume trabajo todos los días, incluido el fin de semana (21 y 22). Si descansas esos días, hay que comprimir tareas o recortar prioridades "Deseable".

| # | Actividad | 18 mié | 19 jue | 20 vie | 21 sáb | 22 dom | 23 lun | 24 mar | 25 mié | 26 jue | 27 vie |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Cierre de requisitos y cuestionario | ██ | ██ | | | | | | | | |
| 2 | Cuenta Oracle y creación de la máquina virtual | ██ | ██ | | | | | | | | |
| 3 | Casos de uso y modelo de datos | | ██ | ██ | | | | | | | |
| 4 | Maquetas de pantallas (identidad TecNM, paleta provisional) | | | ██ | ██ | | | | | | |
| 5 | Base: registro, inicio de sesión, roles, administración de docentes | | | | ██ | ██ | | | | | |
| 6 | Materias, grupos y código de inscripción | | | | | ██ | ██ | | | | |
| 7 | Creación y configuración de exámenes (docente) | | | | | | ██ | ██ | | | |
| 8 | Presentación del examen (alumno): temporizador del servidor, autoguardado, secuencial, aleatorización | | | | | | ██ | ██ | ██ | | |
| 9 | Seguridad: cambio de pestaña, inactividad, IP, anulación y bloqueo | | | | | | | ██ | ██ | | |
| 10 | Calificación, revisión del docente, reapertura y reportes (Excel/PDF) | | | | | | | | ██ | ██ | |
| 11 | Despliegue en Oracle: HTTPS, dominio, servicio y respaldos | | | | | | | ██ | ██ | | |
| 12 | Pruebas y prueba de carga (200 alumnos simultáneos) | | | | | | | | ██ | ██ | |
| 13 | Documentación, manual de usuario y preparación de la presentación | | | | | | | | | ██ | ██ |
| ◆ | **Entrega** | | | | | | | | | | ◆ |
| → | **Presentación** (30 nov al 4 dic) | | | | | | | | | | → |

### Rutas críticas y riesgos
- **Oracle (tarea 2):** inicia el primer día porque puede no haber capacidad en la región; si falla, el plan de contingencia es correr el sistema en tu computadora para la presentación.
- **Presentación del examen y seguridad (8 y 9)** son el núcleo del proyecto y lo más delicado. No se deben recortar.
- **Si falta tiempo**, recorta en este orden: estadísticas avanzadas, exportación a PDF (deja Excel), excepción de herramientas externas (RF-18) y bloqueo de copiar/pegar (RF-35).
- La **prueba de carga** va después del despliegue (11) porque debe hacerse en el servidor real.

### 1.1 Avance real (actualizado al 20 de noviembre)

El diagrama de arriba es la línea base. Las fechas reales salen del changelog de [`PLAN_DESARROLLO.md`](PLAN_DESARROLLO.md) y del historial de git.

| # | Actividad | Planeado | Real | Estado |
|---|---|---|---|---|
| 1 | Cierre de requisitos | 18–19 nov | 18 nov | Terminado. Quedan 4 puntos por confirmar con el cliente (`PLAN_DESARROLLO.md` §7). |
| 2 | Cuenta Oracle y máquina virtual | 18–19 nov | 19 nov | **Recortado:** Oracle exige tarjeta de crédito. Se reemplazó por una PC con Windows publicada con Tailscale Funnel (tarea 11). |
| 3 | Casos de uso y modelo de datos | 19–20 nov | 18 nov | Terminado. El modelo se actualizó en las fases 4, 5 y 7. |
| 4 | Maquetas de pantallas | 20–21 nov | 18 nov | Terminado, con sistema de diseño en `DESIGN.md`. |
| 5 | Registro, sesión, roles y docentes | 21–22 nov | 19 nov | Terminado. |
| 6 | Materias, grupos y código | 22–23 nov | 19 nov | Terminado. |
| 7 | Creación de exámenes | 23–24 nov | 19 nov | Terminado. |
| 8 | Presentación del examen | 23–25 nov | 19 nov | Terminado. |
| 9 | Seguridad y antiplagio | 24–25 nov | 19 nov | Terminado. |
| 10 | Calificación, revisión y reportes | 25–26 nov | 19 nov | Terminado. La calculadora integrada (RF-18) se completó el 20 nov. |
| 11 | Despliegue | 24–25 nov | 19–20 nov | Publicado con Tailscale Funnel. Falta la comprobación final en la PC servidor (arranque automático y respaldos). |
| 12 | Pruebas y prueba de carga | 25–26 nov | 19–20 nov | Carga de 200 alumnos aprobada en el servidor real. Faltan las pruebas en celulares reales. |
| 13 | Documentación y presentación | 26–27 nov | 19 nov – | En curso: reporte de primer avance, manual de usuario, resultados de pruebas y README terminados; falta la presentación. |

**Por qué se adelantó:** las fases 2 a 7 se terminaron el 19 de noviembre, cinco a siete días antes de lo planeado. El margen se usó para el cambio de despliegue (Oracle → Cloudflare → Tailscale), que no estaba previsto, y para documentar.

### 1.2 Metodología de desarrollo

Se usó un modelo **iterativo e incremental**: el sistema se dividió en fases (0 a 10), y cada fase entrega una parte que funciona de punta a punta (base de datos, API y pantallas) y se puede probar sola. Es un proyecto individual, así que no se usaron las reuniones de un marco ágil como Scrum, pero sí sus prácticas centrales: entregas cortas, prioridades explícitas y pruebas continuas.

**Prioridades.** Cada requerimiento de `Req.md` tiene prioridad *Imprescindible*, *Importante* o *Deseable*. Se definió de antemano qué recortar si faltaba tiempo (`PLAN_DESARROLLO.md` §5) y qué no se recorta nunca: la presentación del examen y la seguridad.

**Ciclo de cada fase:**
1. Tomar los requerimientos y casos de uso de la fase (tabla de trazabilidad, `PLAN_DESARROLLO.md` §8).
2. Implementar la API, la lógica del servidor y las pantallas, partiendo de las maquetas de la Fase 1 y del sistema de diseño.
3. Escribir pruebas de integración automáticas que levantan la aplicación real contra PostgreSQL (`npm test`).
4. Recorrer las pantallas en Chrome, en computadora (1280 px) y en celular (390 px), sin errores de consola ni contenido desbordado, y pasar el detector de diseño.
5. Marcar las tareas como terminadas y registrar el cambio en el changelog, con fecha, requerimientos y archivos.

**Definición de terminado:** una tarea se cierra solo cuando su prueba pasa y el recorrido en navegador se hizo. Si algo no se pudo comprobar, queda anotado como pendiente en el plan.

**Control de cambios y riesgos.** `PLAN_DESARROLLO.md` es la referencia única de avance: casillas por tarea, tabla de riesgos y changelog. El código se versiona con git desde el 20 de noviembre. Los riesgos se revisan al cerrar cada fase; el ejemplo principal fue el despliegue: cuando Oracle pidió tarjeta, se pasó a un túnel desde una PC, y cuando la prueba de carga mostró el límite del túnel rápido de Cloudflare, se cambió a Tailscale Funnel.

**Herramientas:** Node.js 24 con Express, PostgreSQL 18, Socket.IO, Bootstrap 5, el ejecutor de pruebas de Node (`node --test`), Puppeteer para los recorridos en Chrome, git e IntelliJ IDEA.

---

## 2. Actores

| Actor | Descripción |
|---|---|
| Administrador | Gestiona cuentas de docentes y supervisa el sistema y los incidentes. |
| Docente | Gestiona materias, grupos y exámenes; revisa, califica y consulta reportes. |
| Alumno | Se registra, se inscribe a grupos y presenta exámenes. |
| Sistema | Detecta incidentes, controla el tiempo, guarda respuestas y borra evidencias. |

## 3. Lista de casos de uso

### Administrador
| ID | Caso de uso |
|---|---|
| CU-01 | Iniciar y cerrar sesión |
| CU-02 | Crear cuenta de docente |
| CU-03 | Desactivar cuenta de docente |
| CU-04 | Restablecer contraseña |
| CU-05 | Consultar estado general del sistema e incidentes |

### Docente
| ID | Caso de uso |
|---|---|
| CU-06 | Iniciar y cerrar sesión |
| CU-07 | Crear y administrar materias y grupos (genera código de inscripción) |
| CU-08 | Crear un examen (preguntas abiertas, opción múltiple, verdadero/falso, con imágenes) |
| CU-09 | Configurar un examen (ventana, duración, respuestas visibles, herramienta permitida, umbral de inactividad) |
| CU-10 | Asignar un examen a uno o varios grupos |
| CU-11 | Asignar tiempo extra a un alumno |
| CU-12 | Revisar exámenes anulados o bloqueados y su evidencia |
| CU-13 | Confirmar o descartar un incidente de plagio |
| CU-14 | Reabrir un examen a un alumno |
| CU-15 | Calificar preguntas abiertas |
| CU-16 | Publicar resultados |
| CU-17 | Consultar reportes y exportarlos (Excel y PDF) |

### Alumno
| ID | Caso de uso |
|---|---|
| CU-18 | Registrarse |
| CU-19 | Iniciar y cerrar sesión |
| CU-20 | Inscribirse a un grupo con código |
| CU-21 | Consultar exámenes asignados |
| CU-22 | Leer instrucciones y aceptar las reglas |
| CU-23 | Presentar el examen |
| CU-24 | Consultar resultados |

### Sistema
| ID | Caso de uso |
|---|---|
| CU-25 | Controlar el temporizador y cerrar el examen al agotarse el tiempo |
| CU-26 | Autoguardar respuestas |
| CU-27 | Detectar cambio de pestaña o inactividad, y anular/bloquear el examen |
| CU-28 | Registrar IP y evidencias |
| CU-29 | Calificar automáticamente preguntas cerradas |
| CU-30 | Eliminar evidencias a la semana |

---

## 4. Descripción de los casos de uso principales

### CU-18 · Registrarse (alumno)
- **Actor:** alumno.
- **Precondición:** ninguna.
- **Flujo principal:**
  1. El alumno abre la página de registro.
  2. Captura sus datos mínimos (usuario y contraseña) y resuelve la protección contra bots.
  3. El sistema valida los datos y crea la cuenta con rol de alumno.
  4. El sistema lo envía al inicio de sesión.
- **Flujos alternos:** usuario ya existente, contraseña débil o demasiados intentos (se rechaza y se muestra el motivo).
- **Postcondición:** cuenta de alumno creada.

### CU-20 · Inscribirse a un grupo
- **Actor:** alumno.
- **Precondición:** sesión iniciada; el docente ya generó el código del grupo.
- **Flujo principal:** el alumno captura el código; el sistema verifica que existe y lo inscribe; el grupo aparece en su lista.
- **Flujo alterno:** código inválido o ya inscrito (mensaje claro).

### CU-08 / CU-09 / CU-10 · Crear, configurar y asignar un examen
- **Actor:** docente.
- **Precondición:** sesión iniciada; existe al menos un grupo.
- **Flujo principal:**
  1. El docente crea el examen y captura las preguntas a mano, con imágenes si las necesita.
  2. Define puntos, ventana de aplicación (fechas y horas), duración, umbral de inactividad y si se muestran las respuestas.
  3. Asigna el examen a uno o varios grupos.
  4. El sistema valida y deja el examen programado.
- **Flujo alterno:** examen sin preguntas o ventana inválida (el sistema no lo permite).

### CU-22 y CU-23 · Presentar el examen
- **Actor:** alumno. **Apoyo:** sistema.
- **Precondición:** el examen está dentro de su ventana y el alumno no lo ha presentado.
- **Flujo principal:**
  1. El alumno elige el examen y ve la pantalla de **instrucciones y advertencia de reglas**.
  2. Acepta explícitamente las reglas y el sistema registra su IP y la hora de inicio.
  3. El sistema muestra la primera pregunta (orden aleatorio por alumno) y el temporizador controlado por el servidor.
  4. El alumno responde; cada respuesta se autoguarda en el servidor.
  5. El alumno avanza (sin poder regresar) hasta terminar y enviar.
  6. El sistema cierra el examen y califica automáticamente las preguntas cerradas.
- **Flujos alternos:**
  - *Se agota el tiempo:* el sistema alerta al alumno y cierra el examen con lo respondido (CU-25).
  - *Pérdida de conexión:* el examen se marca como abandonado y se bloquea.
  - *Cambio de pestaña o inactividad:* ver CU-27.
  - *Ya lo presentó o fuera de ventana:* el sistema no permite el ingreso.
- **Postcondición:** intento registrado como enviado, abandonado o anulado.

### CU-27 · Detectar incidente y anular el examen
- **Actor:** sistema.
- **Disparador:** el alumno cambia de pestaña o ventana, o supera el umbral de inactividad.
- **Flujo principal:**
  1. El navegador notifica el evento al servidor.
  2. El servidor lo registra con tipo, hora, IP y dispositivo.
  3. El servidor **anula y bloquea** el examen del alumno.
  4. El alumno ve un mensaje claro con el motivo.
  5. El examen queda en la lista de revisión del docente.
- **Postcondición:** examen bloqueado hasta que el docente lo revise.

### CU-12, CU-13, CU-14 · Revisar incidente y reabrir
- **Actor:** docente.
- **Precondición:** existe un examen anulado o bloqueado.
- **Flujo principal:**
  1. El docente abre la lista de exámenes en revisión y ve la evidencia.
  2. Decide: **confirmar el plagio** (se mantiene la anulación) o **descartar el incidente**.
  3. Si lo descarta, puede **reabrir** el examen, opcionalmente con tiempo extra.
  4. El sistema registra la decisión en la bitácora de auditoría.
- **Flujo alterno:** la evidencia ya fue eliminada por el plazo de una semana (el docente decide sin ella y el sistema lo indica).

### CU-15 · Calificar preguntas abiertas
- **Actor:** docente.
- **Flujo principal:** el docente abre un examen cerrado, califica cada respuesta abierta (y puede agregar comentarios), y el sistema recalcula la calificación final.

### CU-17 · Consultar y exportar reportes
- **Actor:** docente.
- **Flujo principal:** el docente elige un examen **propio**, selecciona el reporte (calificaciones, incidentes o estadísticas) y lo exporta a Excel o PDF.
- **Regla:** solo el docente que aplicó el examen puede acceder a sus datos.

### CU-02 · Crear cuenta de docente
- **Actor:** administrador.
- **Flujo principal:** el administrador captura los datos del docente; el sistema crea la cuenta con rol de docente y una contraseña inicial.
- **Regla:** los docentes no pueden crear cuentas de otros docentes.

---

## 5. Relación con los requerimientos

| Caso de uso | Requerimientos relacionados |
|---|---|
| CU-02 a CU-05 | RF-03, RF-04, RF-05, RF-06 |
| CU-07, CU-10, CU-20 | RF-07, RF-08, RF-09, RF-10 |
| CU-08, CU-09, CU-11 | RF-11 a RF-19 |
| CU-18, CU-19 | RF-01, RF-02, RNF-04 |
| CU-22, CU-23, CU-25, CU-26 | RF-20 a RF-28, RNF-11, RNF-13 |
| CU-27, CU-28, CU-30 | RF-30 a RF-37, RNF-09 |
| CU-12 a CU-15, CU-29 | RF-38 a RF-42 |
| CU-17 | RF-43 a RF-45 |

# Documento de requerimientos
## Plataforma web para la aplicación segura de exámenes asíncronos

**Versión:** 1.0  
**Fecha:** 18 de noviembre de 2026  
**Entrega:** 27 de noviembre de 2026  
**Presentación:** 30 de noviembre al 4 de diciembre de 2026

**Prioridad:** `I` = Imprescindible · `M` = Importante · `D` = Deseable

---

## 1. Descripción general

Plataforma web que permite a los alumnos presentar exámenes **fuera de la institución, de forma asíncrona y no presencial**, aplicando medidas de seguridad para evitar el plagio y el uso de herramientas externas. Todo el procesamiento y la validación se realiza en el servidor. La interfaz debe ser de acceso rápido, fácil e intuitiva.

## 2. Alcance

### Incluido
- Gestión de usuarios con tres roles: administrador, docente y alumno.
- Gestión de materias, grupos e inscripción por código.
- Creación y aplicación de exámenes con distintos tipos de pregunta.
- Calificación automática y manual.
- Detección de incidentes (cambio de pestaña, inactividad), anulación y revisión del docente.
- Reportes y exportación a Excel y PDF.

### Fuera de alcance
- Cámara, micrófono y grabación de pantalla.
- Notificaciones por correo electrónico.
- Migración de datos existentes.
- Importación de preguntas desde Word o Excel (se capturan a mano).
- Banco de preguntas reutilizable.

## 3. Roles

| Rol | Descripción |
|---|---|
| **Administrador** | Gestiona cuentas de docentes, restablece contraseñas y supervisa el estado del sistema y los incidentes. |
| **Docente** | Crea materias, grupos y exámenes; califica; revisa incidentes; reabre exámenes; consulta y exporta reportes de sus propios exámenes. |
| **Alumno** | Se registra, se inscribe a grupos con un código y presenta los exámenes asignados. |

> Los docentes **no** pueden crear cuentas de otros docentes. Esa función es exclusiva del administrador.

## 4. Tecnologías y despliegue

| Componente | Elección |
|---|---|
| Frontend | HTML, CSS (diseño responsive) y **JavaScript** en el navegador, con la identidad visual del TecNM (RNF-19 a RNF-22). JavaScript se usa para el temporizador visible, el autoguardado y la detección de cambio de pestaña e inactividad. |
| Backend | **JavaScript (Node.js)** con Express (API y lógica en el servidor). El proyecto usa un solo lenguaje en el navegador y en el servidor. |
| Tiempo real | WebSockets (Socket.IO) para detectar al instante desconexión, cambio de pestaña e inactividad del alumno. |
| Acceso a datos y seguridad | Librería para PostgreSQL (Prisma, Knex o `pg`); `bcrypt` para contraseñas, `helmet` para cabeceras seguras y `express-rate-limit` contra abuso e intentos masivos. |
| Base de datos | PostgreSQL. |
| Servidor (definido, gratuito) | Máquina virtual Linux (Ubuntu LTS) en el plan gratuito permanente de **Oracle Cloud (Always Free)**, con IP pública. Dominio gratuito mediante un servicio de DNS dinámico (por ejemplo, DuckDNS). |
| Servidor web / proxy | Nginx como proxy inverso hacia la aplicación Node.js. |
| Seguridad de transporte | HTTPS con certificado Let's Encrypt. |
| Ejecución | La aplicación corre como servicio del sistema (systemd) para reiniciarse automáticamente. |
| Respaldos | Respaldo automático de la base de datos, más uno antes de cada ventana de examen. |

> **Nota:** todo el software (Node.js, Express, PostgreSQL, Nginx, Let's Encrypt) es gratuito. Solo el servidor tiene costo normalmente, por lo que se usan planes gratuitos de hosting. Los límites de estos planes cambian con frecuencia (Oracle, por ejemplo, redujo en 2026 su asignación gratuita de procesadores ARM); deben verificarse en la documentación oficial del proveedor antes del despliegue. El servidor debe quedar accesible en línea para que alumnos y docentes ingresen desde cualquier lugar.

### 4.1 Plan de despliegue en Oracle Cloud (Always Free)

1. Crear la cuenta de Oracle Cloud y elegir con cuidado la región de origen (no se puede cambiar después).
2. Crear la máquina virtual Ubuntu LTS (forma Ampere A1, arquitectura ARM64) con llaves SSH. Planear los recursos con la asignación gratuita vigente, que Oracle redujo en 2026; verificarla en su documentación oficial.
3. Abrir los puertos 80 y 443 en la lista de seguridad de la red virtual de Oracle y en el firewall de Ubuntu.
4. Instalar Node.js (versión LTS para ARM64), PostgreSQL y Nginx.
5. Registrar un dominio gratuito (DuckDNS) apuntando a la IP pública de la máquina.
6. Instalar el certificado HTTPS con Let's Encrypt (Certbot) y configurar Nginx como proxy inverso.
7. Ejecutar la aplicación como servicio systemd, con reinicio automático.
8. Programar respaldos automáticos de PostgreSQL (`pg_dump` con cron) y guardar una copia fuera del servidor.
9. Ejecutar las pruebas de carga (200 usuarios simultáneos) sobre este mismo servidor.

> **Riesgos a vigilar:** la región elegida puede no tener capacidad disponible al crear la máquina; la asignación gratuita puede cambiar; y, hasta donde se sabe, Oracle puede reclamar instancias gratuitas con uso muy bajo, por lo que conviene mantener el servidor activo y con respaldos. Como contingencia para la presentación, el sistema puede ejecutarse localmente.

---

## 5. Requerimientos funcionales

### 5.1 Cuentas y acceso

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-01 | El sistema permite **registro abierto** para alumnos. | I |
| RF-02 | El sistema ofrece inicio y cierre de sesión por rol (administrador, docente, alumno). | I |
| RF-03 | Los docentes no pueden crear cuentas de otros docentes. | I |
| RF-04 | El administrador crea y desactiva cuentas de docentes. | I |
| RF-05 | El administrador restablece contraseñas. | M |
| RF-06 | El administrador consulta el estado general del sistema y los incidentes. | M |

### 5.2 Materias y grupos

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-07 | El docente crea y administra sus materias y grupos. | I |
| RF-08 | Cada grupo genera un **código de inscripción**. | I |
| RF-09 | El alumno se inscribe a un grupo introduciendo el código. | I |
| RF-10 | El docente asigna un examen a uno o varios grupos. | I |

### 5.3 Creación y configuración de exámenes

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-11 | El docente crea exámenes capturando las preguntas **a mano**. | I |
| RF-12 | Tipos de pregunta: abierta, opción múltiple y verdadero/falso. | I |
| RF-13 | Las preguntas pueden incluir **imágenes**. | M |
| RF-14 | El docente define la ventana de aplicación (fecha y hora de apertura y cierre, que puede abarcar varios días). | I |
| RF-15 | El docente define la duración del examen. | I |
| RF-16 | El docente asigna tiempo extra a alumnos específicos. | M |
| RF-17 | El docente decide si se muestran las respuestas correctas y la retroalimentación al terminar. | M |
| RF-18 | El docente puede permitir una herramienta externa como excepción en un examen concreto (por ejemplo, calculadora integrada). Por defecto está desactivada. | D |
| RF-19 | El sistema **aleatoriza el orden de preguntas y de respuestas** para cada alumno (sin banco de preguntas). | M |

### 5.4 Presentación del examen (alumno)

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-20 | El alumno ve los exámenes asignados y su disponibilidad. | I |
| RF-21 | Antes de iniciar, se muestra una **pantalla de instrucciones y advertencia de reglas** con aceptación explícita (importante por los falsos positivos en celular). | I |
| RF-22 | El examen puede presentarse **una sola vez**, con ingreso único. | I |
| RF-23 | Las preguntas son **secuenciales**: no se puede regresar a una anterior. | I |
| RF-24 | Cada respuesta se **autoguarda en el servidor**. | I |
| RF-25 | El **temporizador es visible** y está **controlado por el servidor**, no por el navegador. | I |
| RF-26 | Al agotarse el tiempo, el sistema alerta al alumno y cierra el examen, guardando lo respondido. | I |
| RF-27 | Si se pierde la conexión, el examen se considera abandonado y se bloquea. | I |
| RF-28 | Cuando el examen se anula o se bloquea, el sistema muestra un **mensaje claro** al alumno con el motivo. | I |
| RF-29 | El alumno consulta sus resultados cuando el docente los publica. | I |

### 5.5 Seguridad y antiplagio

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-30 | Si el alumno cambia de pestaña o ventana, el examen se **anula y se bloquea hasta la revisión del docente**. | I |
| RF-31 | Si hay inactividad prolongada, el examen se anula y se bloquea del mismo modo. El umbral es configurable. | I |
| RF-32 | El sistema registra la **IP** del alumno como evidencia de identidad. | I |
| RF-33 | El sistema detecta los incidentes y el **docente los comprueba** (confirma o descarta). | I |
| RF-34 | Una sola sesión activa por alumno. | M |
| RF-35 | Bloqueo de copiar, pegar, clic derecho e impresión durante el examen. | M |
| RF-36 | Se registran las evidencias de cada incidente (tipo, fecha y hora, IP, dispositivo). | I |
| RF-37 | Las evidencias se **eliminan automáticamente a la semana**. Las calificaciones no se eliminan. | M |

### 5.6 Revisión y calificación (docente)

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-38 | El sistema califica **automáticamente** las preguntas cerradas. | I |
| RF-39 | El docente califica **manualmente** las preguntas abiertas. | I |
| RF-40 | El docente consulta los exámenes anulados o bloqueados y su evidencia. | I |
| RF-41 | El docente puede **reabrir** el examen a un alumno (por ejemplo, ante una falla técnica). | I |
| RF-42 | Las aclaraciones de calificación se resuelven directamente con el docente. | D |

### 5.7 Reportes

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-43 | Reportes de calificaciones, incidentes y estadísticas. | M |
| RF-44 | Exportación a **Excel y PDF**. | M |
| RF-45 | Solo el docente que aplicó el examen puede acceder a sus datos y reportes. | I |

---

## 6. Reglas de negocio

1. El examen se presenta una sola vez por alumno, salvo que el docente lo reabra.
2. Un cambio de pestaña o ventana anula el examen hasta que el docente lo revise.
3. La inactividad prolongada se trata como una posible trampa.
4. Una conexión perdida marca el examen como abandonado.
5. El tiempo de cada examen lo define el docente, y puede ampliarlo por alumno.
6. El docente decide si el alumno ve las respuestas correctas.
7. El plagio se evalúa únicamente sobre las respuestas de los **alumnos**.
8. El sistema detecta el incidente y el docente lo confirma.
9. Las bitácoras y evidencias se conservan **1 semana**.
10. El docente solo accede a los exámenes y reportes que él mismo creó.

---

## 7. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Prioridad |
|---|---|---|---|
| RNF-01 | Autenticación | Contraseñas almacenadas con **hash**; sesiones con expiración. | I |
| RNF-02 | Autenticación | Una sola sesión activa por alumno. | M |
| RNF-03 | Comunicación | **HTTPS obligatorio**. | I |
| RNF-04 | Registro seguro | Protección contra registros masivos y bots (captcha o límite de intentos) y control de intentos de inicio de sesión. | M |
| RNF-05 | Control de acceso | Control de acceso por rol **en el servidor**: un alumno no puede acceder a pantallas o datos del docente, ni un docente a los exámenes de otro. | I |
| RNF-06 | Protección | Defensa contra inyección SQL, XSS y manipulación de peticiones. | I |
| RNF-07 | Protección | Las **respuestas correctas nunca viajan al navegador** durante el examen. | I |
| RNF-08 | Auditoría | Bitácora de acciones importantes (quién reabrió o calificó qué), además de las evidencias de incidentes. | M |
| RNF-09 | Retención | Borrado automático de evidencias a la semana. | M |
| RNF-10 | Rendimiento | Soporte de **al menos 200 alumnos simultáneos** con tiempos de respuesta razonables. | I |
| RNF-11 | Rendimiento | El guardado de respuestas no se pierde ante picos de carga. | I |
| RNF-12 | Pruebas | **Pruebas de carga** obligatorias antes de usar el sistema en exámenes reales. | I |
| RNF-13 | Tolerancia a fallas | Si el servidor se cae a mitad de un examen, queda registrado el último estado guardado. | I |
| RNF-14 | Respaldos | Respaldo automático de la base de datos; frecuencia según los exámenes pendientes (propuesta: diario y antes de cada ventana de examen). | M |
| RNF-15 | Compatibilidad | Navegadores modernos en **computadora y celular**; diseño responsive. | I |
| RNF-16 | Usabilidad | Interfaz rápida e intuitiva, con textos claros y mensajes de error entendibles. | I |
| RNF-17 | Mantenibilidad | Código documentado y estructurado; despliegue repetible en el servidor. | M |
| RNF-18 | Privacidad | No se almacenan datos personales más allá de lo mínimo necesario para operar (usuario, contraseña con hash e IP como evidencia). | M |
| RNF-19 | Identidad visual | La interfaz se basa en la identidad gráfica del **Tecnológico Nacional de México (TecNM)**: logotipo oficial, colores y tipografía institucionales según su manual de identidad vigente. | I |
| RNF-20 | Identidad visual | Encabezado con el logotipo y el nombre de la institución (**Tecnológico de Cuautla**, TecNM), y pie de página institucional, en todas las pantallas. Mientras no se tengan los logotipos oficiales, se usan marcadores de posición con el nombre en texto, fáciles de reemplazar por los archivos oficiales. | M |
| RNF-21 | Identidad visual | Los logotipos se usan sin deformarse y respetando su área de protección y tamaño mínimo, y se verifica que sean las versiones vigentes. | M |
| RNF-22 | Identidad visual | Los colores institucionales se definen como variables centrales de estilo (CSS), de modo que un cambio de paleta se haga en un solo lugar. Se mantiene buen contraste y legibilidad en computadora y celular. | M |

---

## 8. Restricciones y supuestos

- Todo el proyecto en **JavaScript**: HTML, CSS y JavaScript en el navegador, y Node.js en el servidor.
- Servidor independiente por ahora, hospedado en línea y de libre elección.
- Sin cámara, micrófono, correos, migración de datos ni importación de preguntas.
- Sin preferencia de tecnología de base de datos ni de normativas de datos por parte del cliente.
- Los alumnos usan computadora y celular.
- Plazo de **9 días** para el desarrollo.

## 9. Puntos pendientes de confirmar con el cliente

1. **Identidad por IP:** varios alumnos pueden compartir la misma IP y en celular puede cambiar; se registra como evidencia, no como prueba automática.
2. **Falsos positivos en celular:** llamadas, notificaciones o cambio de app pueden activar la anulación.
3. **Umbral de inactividad:** definir cuántos minutos y si lo configura el docente.
4. **Retención de 1 semana:** confirmar si cuenta desde el cierre del examen.
5. **Herramientas externas:** confirmar qué se permite y bajo qué condiciones.
6. **Alcance del plagio:** solo comportamiento (pestañas, inactividad, sesiones) o también comparación de respuestas abiertas entre alumnos.
7. **Alta de docentes y administrador:** confirmar que el administrador crea las cuentas de docentes.
8. **Privacidad:** si existe alguna ley, reglamento o política institucional que limite qué información de los alumnos se guarda.
9. **Entrega:** quién del lado del cliente valida el sistema y qué se espera recibir (sistema, manuales, documentación).
10. **Identidad visual:** el plantel es el **Tecnológico de Cuautla**. Pendiente obtener los archivos oficiales de los logotipos y los códigos exactos de color y tipografía del manual de identidad vigente del TecNM, y confirmar si se permite usar el logotipo en el sistema. Mientras tanto se usa una paleta provisional y marcadores de logotipo.

## 10. Entregables

- Documento de requerimientos y casos de uso.
- Modelo de datos y diseño de interfaz.
- Diagrama de Gantt y descripción de la metodología de desarrollo.
- Sistema funcionando y hospedado en línea.
- Resultados de pruebas, incluida la prueba de carga.
- Manual de usuario.

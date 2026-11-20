# Diseños de interfaz
## Plataforma web para la aplicación segura de exámenes asíncronos
**Institución:** Tecnológico de Cuautla (TecNM)  
**Tecnologías:** todo en JavaScript: HTML, CSS y JavaScript en el navegador; backend en Node.js (Express)

> Este documento describe las pantallas ya maquetadas para que se puedan reproducir o ampliar en otra conversación. Los logotipos, colores y tipografía son **provisionales**: faltan los archivos oficiales del TecNM y del Tecnológico de Cuautla. Los nombres, fechas y exámenes son datos de ejemplo.

---

## 1. Sistema de diseño (provisional)

### Identidad
- Encabezado azul en todas las pantallas, con un **cuadro de logotipo provisional** (44×44 px, borde punteado blanco, texto "LOGO") a la izquierda.
- Junto al logotipo: **"Tecnológico de Cuautla"** (negrita, 18 px) y debajo **"TecNM · Plataforma de exámenes"** (13 px).
- A la derecha del encabezado, el rol de la persona: "Acceso", "Alumno" o "Docente".
- Cuando haya logotipos oficiales, se reemplaza el cuadro por la imagen sin deformarla y se ajustan los colores en un solo lugar (variables de CSS).

### Colores provisionales (variables CSS sugeridas)
| Uso | Valor | Variable sugerida |
|---|---|---|
| Azul principal (encabezado, botones) | `#1F3A6E` | `--color-primario` |
| Fondo de página | `#F4F6FA` | `--color-fondo` |
| Tarjetas | `#FFFFFF` | `--color-tarjeta` |
| Texto principal | `#1A1A1A` | `--color-texto` |
| Texto secundario | `#4A5160` | `--color-texto-suave` |
| Borde de campos | `#8A92A3` | `--color-borde` |
| Líneas de tabla y barra de progreso (fondo) | `#D5D9E2` | `--color-linea` |
| Advertencia (estado "bloqueado") | `#F2C14E` | `--color-aviso` |
| Éxito (respuesta guardada) | `#1E6B3C` | `--color-exito` |

### Tipografía
- `Inter, Arial, sans-serif`. Títulos de pantalla 26 px, secciones 20 px, texto 14–16 px.

### Componentes
- **Botón principal:** fondo azul, texto blanco, esquinas de 8 px, relleno 12×20 px, texto en negrita 15 px.
- **Botón secundario:** fondo blanco, texto y borde azul de 2 px.
- **Campos de texto:** ancho completo, borde de 1 px, esquinas de 8 px, 12 px de relleno, con su `<label>` visible encima.
- **Tarjeta:** fondo blanco, esquinas de 12 px, relleno de 28 px, sombra suave.
- **Tabla:** encabezados y filas con líneas inferiores, relleno de 12 px, texto de 14 px.
- **Etiqueta de estado:** píldora con fondo de color y texto en negrita.

### Accesibilidad
- Usar `<button>`, `<input>` con `<label>` y tablas reales, no `div` clicables.
- Contraste de texto mínimo 4.5:1.
- Áreas táctiles de al menos 44 px en celular.
- Los estados no dependen solo del color: llevan texto.

### Responsividad
- Páginas de escritorio: ancho fluido con contenedor centrado (`max-width` entre 760 y 1100 px); en celular las columnas se apilan y las tablas anchas se desplazan dentro de su propio contenedor.
- El examen se diseña **primero para celular** (390×844), porque los alumnos usan computadora y celular.

---

## 2. Pantallas

### Pantalla 1 · Acceso y registro
**Quién:** todos los roles (el registro es solo para alumnos).  
**Tamaño de referencia:** 1280×720, fluida.

```
┌────────────────────────────────────────────────────────────┐
│ [LOGO] Tecnológico de Cuautla                      Acceso  │
│        TecNM · Plataforma de exámenes                      │
├────────────────────────────────────────────────────────────┤
│   ┌──────────────────────┐   ┌──────────────────────────┐  │
│   │ Iniciar sesión       │   │ Crear cuenta de alumno   │  │
│   │ Alumnos, docentes y  │   │ Solo necesitas usuario   │  │
│   │ administradores.     │   │ y contraseña.            │  │
│   │ Usuario [__________] │   │ Usuario [______________] │  │
│   │ Contraseña [_______] │   │ Contraseña [___________] │  │
│   │                      │   │ Confirmar [____________] │  │
│   │ [ Entrar ]           │   │ [ Verificación anti-bots]│  │
│   │                      │   │ [ Registrarme ]          │  │
│   └──────────────────────┘   └──────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```
- Dos tarjetas lado a lado; en celular se apilan.
- El registro incluye un espacio para la verificación anti-bots (captcha).
- Errores a mostrar: usuario existente, contraseña débil, contraseñas distintas, demasiados intentos.

### Pantalla 2 · Panel del alumno
**Quién:** alumno.

```
┌────────────────────────────────────────────────────────────┐
│ [LOGO] Tecnológico de Cuautla                      Alumno  │
├────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Inscribirme a un grupo                                 │ │
│ │ Código del grupo [____________]  [ Inscribirme ]       │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Mis exámenes                                           │ │
│ │ Examen            | Disponibilidad | Duración | Estado  │ │
│ │ Cálculo integral  | Hasta 28 nov   | 60 min   |[Presentar]│
│ │ Programación web  | Abre 30 nov    | 45 min   | Aún no disponible │
│ │ Álgebra lineal    | Cerrado        | 90 min   | Bloqueado: en revisión del docente │
│ │ Física · Quiz 4   | Cerrado        | 20 min   | Calificado: 8.5 │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```
Estados posibles de un examen: **Presentar** (disponible), **Aún no disponible**, **Bloqueado: en revisión del docente** (etiqueta de aviso), **Calificado** (con nota), **Cerrado/Abandonado**.

### Pantalla 3 · Instrucciones y reglas
**Quién:** alumno, antes de iniciar el examen.

```
┌────────────────────────────────────────────────────────────┐
│ [LOGO] Tecnológico de Cuautla                      Alumno  │
├────────────────────────────────────────────────────────────┤
│   ┌────────────────────────────────────────────────────┐   │
│   │ Antes de comenzar                                  │   │
│   │ Cálculo integral · Parcial 2 · 10 preguntas · 60 min│  │
│   │ • Solo tienes una oportunidad. No puedes regresar. │   │
│   │ • Cambiar de pestaña o ventana anula y bloquea el  │   │
│   │   examen hasta que lo revise tu docente.           │   │
│   │ • La inactividad prolongada hace lo mismo.         │   │
│   │ • Si pierdes la conexión, se considera abandonado. │   │
│   │ • El tiempo lo controla el servidor; tus respuestas│   │
│   │   se guardan automáticamente.                      │   │
│   │ • Se registra tu dirección IP como evidencia.      │   │
│   │ [x] He leído y acepto las reglas                   │   │
│   │ [ Cancelar ]  [ Comenzar examen ]                  │   │
│   └────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```
- "Comenzar examen" solo se habilita si la casilla está marcada.
- El umbral de inactividad debe mostrarse con el valor que configuró el docente.

### Pantalla 4 · Examen en curso (celular)
**Quién:** alumno. **Tamaño de referencia:** 390×844.

```
┌──────────────────────────┐
│ Pregunta 3 de 10   38:12 │  ← barra azul: avance y temporizador del servidor
├──────────────────────────┤
│ ▓▓▓▓░░░░░░░░░░░░░░░░░░░░ │  ← barra de progreso
│                          │
│ ¿Cuál es la integral de  │
│ 2x respecto de x?        │
│ ( ) x² + C               │
│ ( ) 2x² + C              │
│ ( ) x + C                │
│ Respuesta guardada       │  ← texto verde
├──────────────────────────┤
│ No cambies de pestaña: el│
│ examen se anulará.       │
│ [ Guardar y continuar ]  │
└──────────────────────────┘
```
- Sin botón "Anterior": las preguntas son secuenciales.
- Cada respuesta se autoguarda; el temporizador viene del servidor.
- Las opciones son tarjetas con botón de radio de 22 px y etiqueta.
- Estados adicionales a diseñar: aviso de tiempo agotado (se alerta y se cierra) y **pantalla de examen anulado o bloqueado** con el motivo y la indicación de hablar con el docente.

### Pantalla 5 · Revisión del docente
**Quién:** docente.

```
┌────────────────────────────────────────────────────────────┐
│ [LOGO] Tecnológico de Cuautla                      Docente │
├────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Exámenes en revisión                                   │ │
│ │ La evidencia se conserva 7 días.                       │ │
│ │ Alumno | Examen | Incidente | Hora | IP | Decisión     │ │
│ │ alumno_204 | Álgebra lineal | Cambio de pestaña | 10:42│ │
│ │            | [Confirmar plagio] [Descartar y reabrir]  │ │
│ │ alumno_117 | Álgebra lineal | Inactividad (4 min) | 10:58│
│ │            | [Confirmar plagio] [Descartar y reabrir]  │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```
- "Descartar y reabrir" debe permitir asignar tiempo extra.
- Toda decisión queda en la bitácora de auditoría.
- La tabla se desplaza horizontalmente en pantallas pequeñas.

---

## 3. Pantallas pendientes de diseñar

| Pantalla | Rol | Contenido principal |
|---|---|---|
| Panel del docente | Docente | Materias, grupos con su código, exámenes y accesos a reportes |
| Crear y configurar examen | Docente | Preguntas (abierta, opción múltiple, V/F, con imagen), ventana, duración, umbral de inactividad, mostrar respuestas, asignación a grupos |
| Calificación manual | Docente | Respuestas abiertas, puntos y comentarios |
| Reportes y exportación | Docente | Calificaciones, incidentes y estadísticas; exportar a Excel y PDF |
| Panel del administrador | Administrador | Crear y desactivar docentes, restablecer contraseñas, estado del sistema e incidentes |
| Examen anulado o bloqueado | Alumno | Motivo claro y siguiente paso |
| Resultados | Alumno | Calificación y, si el docente lo permite, respuestas correctas |

## 4. Reglas de diseño que deben respetarse

1. No existe botón para regresar a preguntas anteriores.
2. El temporizador siempre se muestra y proviene del servidor.
3. Las reglas se aceptan explícitamente antes de comenzar.
4. Todo mensaje de anulación o bloqueo es claro y explica el motivo.
5. Los datos personales visibles se limitan a lo mínimo (usuario, IP como evidencia).
6. Los logotipos y colores oficiales se aplican al final, sin rediseñar las pantallas.

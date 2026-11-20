---
name: Plataforma de exámenes · Tecnológico de Cuautla
description: Aplicación segura de exámenes asíncronos con identidad provisional del TecNM.
colors:
  azul-institucional: "#1F3A6E"
  azul-institucional-hover: "#172C54"
  azul-institucional-activo: "#122343"
  gris-aula: "#F4F6FA"
  blanco-hoja: "#FFFFFF"
  tinta: "#1A1A1A"
  grafito: "#4A5160"
  gris-contorno: "#8A92A3"
  linea-cuaderno: "#D5D9E2"
  ambar-revision: "#F2C14E"
  verde-guardado: "#1E6B3C"
  rojo-abandono: "#842029"
  rosa-abandono: "#F8D7DA"
typography:
  headline:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  question:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  meta:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  brand:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
  clock:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  stat:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  control:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.5
  logo-placeholder:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1
rounded:
  barra: "4px"
  control: "8px"
  tarjeta: "12px"
  pildora: "50rem"
spacing:
  bloque-interno: "4px"
  control: "12px"
  medianil: "16px"
  tarjeta-movil: "20px"
  bloque: "24px"
  tarjeta: "28px"
components:
  button-primary:
    backgroundColor: "{colors.azul-institucional}"
    textColor: "{colors.blanco-hoja}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.azul-institucional-hover}"
    textColor: "{colors.blanco-hoja}"
  button-primary-active:
    backgroundColor: "{colors.azul-institucional-activo}"
    textColor: "{colors.blanco-hoja}"
  button-secondary:
    backgroundColor: "{colors.blanco-hoja}"
    textColor: "{colors.azul-institucional}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.azul-institucional}"
    textColor: "{colors.blanco-hoja}"
  card:
    backgroundColor: "{colors.blanco-hoja}"
    rounded: "{rounded.tarjeta}"
    padding: "{spacing.tarjeta}"
  input:
    backgroundColor: "{colors.blanco-hoja}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "{spacing.control}"
  header:
    backgroundColor: "{colors.azul-institucional}"
    textColor: "{colors.blanco-hoja}"
  exam-bar:
    backgroundColor: "{colors.azul-institucional}"
    textColor: "{colors.blanco-hoja}"
    padding: "16px"
  status-review:
    backgroundColor: "{colors.ambar-revision}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pildora}"
    padding: "5px 10px"
  status-success:
    backgroundColor: "#E4EEE8"
    textColor: "{colors.verde-guardado}"
    rounded: "{rounded.pildora}"
    padding: "5px 10px"
  status-neutral:
    backgroundColor: "{colors.linea-cuaderno}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pildora}"
    padding: "5px 10px"
  status-danger:
    backgroundColor: "{colors.rosa-abandono}"
    textColor: "{colors.rojo-abandono}"
    rounded: "{rounded.pildora}"
    padding: "5px 10px"
---

<!-- Identidad PROVISIONAL: colores, tipografía y logotipo se sustituyen por los oficiales del TecNM cuando se obtengan (Req.md §9.10). El cambio se hace solo en public/css/app.css; este archivo se actualiza con /impeccable document. -->

# Design System: Plataforma de exámenes · Tecnológico de Cuautla

## Overview

**Creative North Star: "El Aula Serena"**

Presentar un examen fuera del plantel genera tensión: el alumno sabe que un cambio de pestaña anula su intento y que el reloj corre en el servidor. La interfaz responde a eso con calma. Durante el examen se aparta: una pregunta a la vez, un reloj siempre visible, un solo botón para avanzar. Nada compite con la pregunta.

El carácter es sobrio e institucional. Un solo azul profundo carga la identidad (encabezado, botones, progreso) sobre un gris muy claro y hojas blancas. Los demás colores existen solo para comunicar estados, y siempre van con texto que los explica. Es serio sin ser frío: tipografía legible, espacios generosos y mensajes que dicen qué pasó y qué sigue.

Los controles son firmes y claros. Los botones son sólidos y en negrita, cada campo tiene su etiqueta visible encima y toda área táctil mide al menos 44 px, porque muchos alumnos presentan desde el celular.

**Key Characteristics:**
- Una sola voz de color (el azul institucional); el resto son neutros y estados.
- Primero celular en el examen (390×844); escritorio fluido para docente y administrador.
- Estados siempre con texto, nunca solo color.
- Profundidad mínima: hojas blancas con una sombra suave sobre fondo gris.
- Encabezado y pie institucionales en todas las pantallas.

## Colors

Un azul institucional profundo sobre neutros fríos y claros, con tres colores de estado reservados para comunicar.

### Primary
- **Azul Institucional Profundo** (#1F3A6E): encabezado, barra del examen, botón principal, borde del botón secundario, enlaces, barra de progreso, casillas marcadas y anillo de foco (al 35 %). Pasa a **Azul Hover** (#172C54) al pasar el cursor y a **Azul Activo** (#122343) al presionar.

### Neutral
- **Gris Aula** (#F4F6FA): fondo de todas las páginas. Solo se aplica a `body`.
- **Blanco Hoja** (#FFFFFF): tarjetas, campos, modales y pie de página.
- **Tinta** (#1A1A1A): texto principal.
- **Grafito** (#4A5160): texto secundario, encabezados de tabla, ayudas de campo y etiquetas de datos.
- **Gris Contorno** (#8A92A3): borde de campos, casillas y radios; perilla del interruptor apagado.
- **Línea de Cuaderno** (#D5D9E2): líneas de tabla, divisores entre bloques, fondo de la barra de progreso y píldora de estado neutro.

### Estados
- **Ámbar de Revisión** (#F2C14E): fondo de "Bloqueado: en revisión del docente", siempre con texto Tinta encima.
- **Verde Guardado** (#1E6B3C): "Respuesta guardada", "Calificado", "Activo" y respuestas correctas, sobre un tinte claro del mismo verde.
- **Rojo Abandono** (#842029) sobre **Rosa Abandono** (#F8D7DA): "Abandonado" y respuestas incorrectas.

### Named Rules
**The One Voice Rule.** El azul institucional es el único color de identidad. Ámbar, verde y rojo solo aparecen para comunicar un estado, nunca como decoración.

**The Single Source Rule.** Ningún color se escribe fuera de `:root` en `app.css`. Bootstrap recibe la paleta a través de sus variables (`--bs-primary`, `--bs-btn-*`), así que cambiar a la paleta oficial del TecNM toca un solo archivo.

## Typography

**Display Font:** Inter (con Arial y sans-serif de respaldo)
**Body Font:** Inter (con Arial y sans-serif de respaldo)

**Character:** una sola familia sans neutra y muy legible. La jerarquía sale del peso y el tamaño, no de mezclar familias. Es provisional hasta tener la tipografía del manual de identidad del TecNM.

### Hierarchy
- **Headline** (700, 26 px / 1.625rem, 1.2): título de pantalla, uno por página ("Antes de comenzar", "Exámenes en revisión").
- **Title** (700, 20 px / 1.25rem, 1.2): título de sección dentro de una tarjeta.
- **Question** (700, 20 px, 1.4): enunciado de la pregunta durante el examen.
- **Body** (400, 16 px, 1.5): texto corrido, reglas del examen y opciones de respuesta.
- **Label** (600, 14 px): etiquetas de campo, encabezados de tabla y texto de botón (botón a 15 px).
- **Meta** (400, 13 px): ayudas, pie institucional, etiquetas de datos y píldoras de estado (en 600).

### Named Rules
**The Visible Label Rule.** Todo campo lleva su `<label>` visible encima, en Label 600. Un placeholder nunca reemplaza a la etiqueta.

## Layout

Un contenedor centrado y fluido con tres anchos según la tarea: angosto (760 px) para leer y decidir (instrucciones, examen bloqueado, resultados), medio (960 px) para formularios (acceso, panel del alumno, editor de examen) y ancho (1100 px) para tablas (revisión, panel del docente, reportes, administrador). El examen usa su propio ancho (640 px) y está pensado primero para 390×844, con la barra de avance y reloj fija arriba y el botón "Guardar y continuar" fijo abajo.

El ritmo vertical se apoya en 24 px entre bloques y 16 px de medianil en celular. En pantallas de menos de 576 px, las columnas se apilan. Las tablas anchas se desplazan dentro de su propio contenedor, salvo las que tienen la acción principal (exámenes del alumno, docentes del administrador): esas se convierten en bloques etiquetados para que la acción siempre quede visible.

## Elevation & Depth

El sistema es casi plano. La única profundidad es la hoja: tarjetas blancas con una sombra ambiental suave sobre el fondo Gris Aula. Dentro de una tarjeta no hay más capas; los grupos se separan con una línea de 1 px.

### Shadow Vocabulary
- **Hoja** (`box-shadow: 0 1px 4px rgba(0, 0, 0, .12)`): toda tarjeta.
- **Pie de examen** (`box-shadow: 0 -1px 4px rgba(0, 0, 0, .08)`): la barra inferior fija del examen, para separarla del contenido que se desplaza.

### Named Rules
**The One Sheet Rule.** Nunca hay una tarjeta dentro de otra. Los bloques internos se separan con una línea Línea de Cuaderno y 24 px de aire arriba.

## Shapes

Esquinas suavemente redondeadas y consistentes por rol: 8 px en controles (botones, campos), 12 px en tarjetas y modales, 4 px en la barra de progreso y forma de píldora solo en etiquetas de estado. Los bordes son de 1 px en campos y de 2 px en el botón secundario. El logotipo provisional es un cuadro de 44×44 px con borde punteado blanco, que se sustituye por el oficial sin deformarlo.

## Components

### Buttons
- **Shape:** esquinas suaves (8 px), mínimo 44 px de alto.
- **Primary:** fondo Azul Institucional, texto blanco en negrita de 15 px, relleno de 12×20 px. Una acción principal por vista.
- **Hover / Focus:** se oscurece a Azul Hover y luego a Azul Activo al presionar; el foco muestra un anillo azul al 35 % de 0.25rem.
- **Secondary:** fondo blanco, texto y borde de 2 px en Azul Institucional; al pasar el cursor se rellena de azul. Para cancelar, alternativas y acciones de tabla.
- **Small:** relleno de 8×14 px y texto de 14 px, para acciones dentro de tablas.

### Chips (estados)
- **Style:** píldora con texto en 600 de 13 px. Revisión en ámbar, éxito en verde sobre tinte verde, neutro en Línea de Cuaderno y peligro en rojo sobre rosa.
- **State:** el texto siempre nombra el estado completo ("Bloqueado: en revisión del docente", "Calificado: 8.5").

### Cards / Containers
- **Corner Style:** 12 px.
- **Background:** Blanco Hoja.
- **Shadow Strategy:** sombra Hoja (ver Elevation & Depth), sin borde.
- **Internal Padding:** 28 px (20 px en celular).

### Inputs / Fields
- **Style:** fondo blanco, borde de 1 px en Gris Contorno, 8 px de radio, 12 px de relleno, texto de 15 px.
- **Focus:** el borde pasa a Azul Institucional con el anillo de foco azul.
- **Casillas y radios:** borde Gris Contorno; marcados en Azul Institucional. En reglas y opciones del examen miden 22 px.

### Navigation
- **Encabezado:** barra Azul Institucional con logotipo, "Tecnológico de Cuautla" (700, 18 px) y "TecNM · Plataforma de exámenes" (13 px). A la derecha, los enlaces del rol en blanco al 85 %. La página activa va en blanco con subrayado separado 6 px. El rol aparece al final, separado por una línea vertical blanca al 30 %.
- **Mobile:** el menú se pliega en un botón; el rol aparece dentro del menú como "Sesión: Alumno".
- **Examen:** sin menú, porque salir de la página cuenta como abandono.

### Barra del examen (Signature Component)
Barra Azul Institucional fija arriba, con "Pregunta 3 de 10" a la izquierda y el reloj a la derecha (700, 18 px, números tabulares). Debajo, una barra de progreso de 8 px. Cada opción de respuesta es una hoja con radio de 22 px y su texto; al elegirla se marca con un contorno azul de 2 px. No existe botón "Anterior".

## Do's and Don'ts

### Do:
- **Do** usar Azul Institucional (#1F3A6E) para la única acción principal de cada vista.
- **Do** acompañar todo color de estado con texto que lo explique.
- **Do** mantener las áreas táctiles en 44 px o más y las casillas del examen en 22 px.
- **Do** separar los grupos dentro de una tarjeta con una línea de 1 px Línea de Cuaderno y 24 px de aire.
- **Do** escribir los mensajes de anulación o bloqueo con el motivo y el siguiente paso.
- **Do** cambiar colores solo en las variables de `:root` de `app.css`.

### Don't:
- **Don't** anidar tarjetas ni dibujar cajas con borde dentro de una tarjeta.
- **Don't** usar el azul por defecto de Bootstrap (#0d6efd) en ningún componente.
- **Don't** poner un botón "Anterior" ni navegación dentro del examen.
- **Don't** deformar el logotipo ni invadir su área de protección.
- **Don't** usar ámbar, verde o rojo como decoración.

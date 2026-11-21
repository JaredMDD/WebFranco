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

# Design System: Plataforma de exámenes · Tecnológico de Cuautla

<!-- impeccable:design-map -->
Name: Plataforma de exámenes · Tecnológico de Cuautla
Colors: primary: azul-institucional #1F3A6E; neutral: gris-aula #F4F6FA; status: ambar-revision #F2C14E; primary: azul-institucional-hover #172C54; primary: azul-institucional-activo #122343 (+8 more in the sidecar)
Fonts: Inter (headline, title, question, body, label, meta)
Spacing: bloque-interno 4px, control 12px, medianil 16px, tarjeta-movil 20px, bloque 24px, tarjeta 28px
Radius: barra 4px, control 8px, tarjeta 12px, pildora 50rem
North Star: "El Aula Serena"
Rules:
- The One Voice Rule. El azul institucional es el único color de identidad.
- The Single Source Rule. Ningún color se escribe fuera de `:root` en `app.css`.
- The Visible Label Rule. Todo campo lleva su `<label>` visible encima, en Label 600.
- The One Sheet Rule. Nunca hay una tarjeta dentro de otra.
Elevation:
- Hoja: 0 1px 4px rgba(0, 0, 0, .12)
- Pie de examen: 0 -1px 4px rgba(0, 0, 0, .08)
Don't:
- Don't anidar tarjetas ni dibujar cajas con borde dentro de una tarjeta.
- Don't usar el azul por defecto de Bootstrap (#0d6efd) en ningún componente.
- Don't poner un botón "Anterior" ni navegación dentro del examen.
- Don't deformar el logotipo ni invadir su área de protección.
- Don't usar ámbar, verde o rojo como decoración.
Do:
- Do usar Azul Institucional (#1F3A6E) para la única acción principal de cada vista.
- Do acompañar todo color de estado con texto que lo explique.
- Do mantener las áreas táctiles en 44 px o más y las casillas del examen en 22 px.
- Do separar los grupos dentro de una tarjeta con una línea de 1 px Línea de Cuaderno y 24 px de aire.
- Do escribir los mensajes de anulación o bloqueo con el motivo y el siguiente paso.
- Do cambiar colores solo en las variables de `:root` de `app.css`.
Full: .impeccable/design-full.md (read a section when you need its detail)

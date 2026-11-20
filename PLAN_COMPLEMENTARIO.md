# Plan de tareas complementarias
## Documentación y reporte de desarrollo · Plataforma de exámenes asíncronos · Tecnológico de Cuautla (TecNM)

**Entrega del proyecto:** 27 nov 2026 · **Presentación:** 30 nov – 4 dic 2026

Este plan cubre lo que se entrega **además del sistema**: la documentación y el reporte de desarrollo. El avance del software se lleva en [`PLAN_DESARROLLO.md`](PLAN_DESARROLLO.md), y su changelog también registra los cambios de este plan.

**Leyenda:** `[ ]` pendiente · `[~]` en curso · `[x]` terminado · `[-]` recortado.

---

## 1. Datos por confirmar (bloquean la portada y el formato)

- [x] Fecha del reporte: el día en que se comienza el archivo (primer avance: 19 nov 2026).
- [x] Formato de entrega: **Word (.docx)**.
- [x] Estilo de citas: **APA 7.ª edición** (propuesto, sin objeción).
- [x] Proyecto **individual**: Franco Navarrete Marques.
- [ ] Datos de la portada que faltan: carrera, asignatura, nombre del docente y número de control (marcados en amarillo en el .docx).
- [ ] Logotipos oficiales del TecNM y del Tecnológico de Cuautla (mismo pendiente que `Req.md` §9, punto 10).
- [ ] Contenido esperado de los avances siguientes (por ahora solo se conoce el primero).

## 2. Reporte de desarrollo · Primer avance

Archivo: [`docs/reporte/Reporte_Primer_Avance.docx`](docs/reporte/Reporte_Primer_Avance.docx) (10 páginas, carta, Arial 12, interlineado 1.5, índice automático). Redactado el 19 nov 2026; las casillas quedan en `[~]` hasta que se revise y se completen los datos de §1.

| # | Sección | Qué debe contener | Fuentes en el proyecto |
|---|---|---|---|
| [~] 2.1 | **Portada** | Logotipos TecNM / Tecnológico de Cuautla, nombre del instituto, carrera, asignatura, título del proyecto ("Plataforma web para la aplicación segura de exámenes asíncronos"), "Reporte de desarrollo · Primer avance", integrantes con número de control, docente, lugar y fecha (Cuautla, Morelos). | §1 de este plan |
| [~] 2.2 | **Introducción** | Contexto general (evaluación no presencial en educación superior), qué es la plataforma en un párrafo, a quién sirve (administrador, docente, alumno) y cómo está organizado el documento. Se escribe al final, cuando las demás secciones estén listas. | `Req.md` §1–3 |
| [~] 2.3 | **Descripción del problema** | Situación actual: exámenes fuera de la institución sin control sobre cambio de pestaña, uso de herramientas externas o suplantación; carga del docente para calificar y revisar. Consecuencias para la validez de la evaluación. Alcance y lo que queda fuera (sin cámara, micrófono ni correo) para delimitar el problema. | `Req.md` §1, §2, §8, §9 |
| [~] 2.4 | **Estado del arte** | Revisión de soluciones existentes y sus limitaciones frente a este caso. Mínimo 5 trabajos o productos, con tabla comparativa (detección de pestaña, bloqueo del navegador, supervisión por cámara, costo, requisitos de instalación, uso en celular). Candidatos a investigar: Moodle Quiz, Safe Exam Browser, Respondus LockDown Browser, Google Formularios (modo bloqueado), Proctorio, artículos sobre detección de deshonestidad en exámenes en línea. Cerrar con el hueco que cubre este proyecto: sin instalar nada, funciona en celular, sin cámara y gratuito. | Búsqueda externa; `Req.md` §2 y §4 para la comparación |
| [~] 2.5 | **Justificación** | Por qué vale la pena: beneficio para docentes (calificación automática, reportes, evidencia de incidentes) y alumnos (acceso desde celular, reglas claras, revisión antes de sancionar); por qué con estas tecnologías (un solo lenguaje, software libre, hospedaje gratuito); viabilidad en 9 días. | `Req.md` §4, §6; `PLAN_DESARROLLO.md` §1 |
| [~] 2.6 | **Objetivos** | Un objetivo general (verbo en infinitivo + qué + para qué) y de 4 a 6 específicos medibles, alineados con los módulos: cuentas y roles, materias y grupos, creación de exámenes, presentación con antiplagio, revisión y calificación, reportes y despliegue. | `Req.md` §5, §7; `PLAN_DESARROLLO.md` §4 |
| [~] 2.7 | **Referencias** | Lista en el estilo de citas acordado. Cada fuente del estado del arte debe estar consultada y tener enlace o DOI comprobable. | — |
| [ ] 2.8 | **Revisión final** | Ortografía, numeración de páginas, índice, citas en el texto contra la lista de referencias, conversión al formato de entrega. | — |

**Orden de redacción:** 2.3 → 2.4 → 2.5 → 2.6 → 2.2 → 2.1 → 2.7 → 2.8. La introducción se escribe al final porque resume lo demás.

## 3. Documentación del proyecto

Lo que pide `Req.md` §10 como entregable, con su estado actual:

| Documento | Estado | Archivo |
|---|---|---|
| Requerimientos y casos de uso | [x] | `Req.md`, `CasosD_Uso.md` |
| Modelo de datos | [x] — revisar que refleje las columnas agregadas en las fases 4, 5 y 7 | `modelo_de_datos.md` |
| Diseño de interfaz y sistema de diseño | [x] | `disenos_de_interfaz.md`, `DESIGN.md` |
| Diagrama de Gantt | [x] — línea base más tabla planeado vs. real (20 nov) | `CasosD_Uso.md` §1 y §1.1 |
| Descripción de la metodología de desarrollo | [x] — iterativa e incremental por fases, ciclo de cada fase y definición de terminado (20 nov) | `CasosD_Uso.md` §1.2 |
| Guía de despliegue | [~] — reescrita para Windows + Tailscale Funnel (20 nov); falta completar su comprobación final en la PC del compañero | `DESPLIEGUE.md`, `deploy/` |
| Manual de usuario (alumno, docente, administrador) | [x] — 21 páginas, 15 capturas reales con datos de ejemplo (20 nov); faltan los logotipos de la portada | `docs/Manual_de_Usuario.docx` |
| Resultados de pruebas, incluida la de carga | [~] — 11 páginas (20 nov): resumen, entorno, 47 pruebas automáticas, casos de uso, seguridad, tolerancia, tres escenarios de carga, navegador, pendientes con formato de registro y hallazgos. Falta: tabla de tiempos de la corrida aprobada en Tailscale y resultados de celulares | `docs/Resultados_de_Pruebas.docx` |
| `README.md` con instalación local y despliegue | [x] (20 nov) | `README.md` |
| Presentación y plan de contingencia local | [ ] | por crear |

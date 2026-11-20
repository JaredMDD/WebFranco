import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { pool } from '../db/pool.js';
import { resumenDispositivo } from './incidentes.js';

// Reportes de calificaciones, incidentes y estadísticas de un examen propio (RF-43 a RF-45 · CU-17).

export const APROBATORIA = 7; // escala 0–10; mínima aprobatoria del TecNM (70/100)

export const ESTADOS = {
  NO_PRESENTADO: 'No presentado', EN_CURSO: 'En curso', REABIERTO: 'Reabierto', ENVIADO: 'Enviado',
  ANULADO: 'Anulado (en revisión)', ANULADO_CONFIRMADO: 'Anulado (plagio confirmado)', ABANDONADO: 'Abandonado',
};
export const INCIDENTES = { CAMBIO_PESTANA: 'Cambio de pestaña', INACTIVIDAD: 'Inactividad', SESION_DUPLICADA: 'Sesión duplicada', CONEXION_PERDIDA: 'Conexión perdida' };
export const DECISIONES = { PENDIENTE: 'Pendiente', CONFIRMADO: 'Plagio confirmado', DESCARTADO: 'Descartado' };

// null si el examen no es del docente.
export async function datosReporte(examenId, docenteId) {
  const { rows: [examen] } = await pool.query(
    `SELECT e.id, e.titulo,
            COALESCE((SELECT string_agg(m.nombre || ' ' || g.nombre, ', ' ORDER BY m.nombre, g.nombre)
                        FROM examen_grupo eg JOIN grupo g ON g.id = eg.grupo_id JOIN materia m ON m.id = g.materia_id
                       WHERE eg.examen_id = e.id), '') AS grupos
       FROM examen e WHERE e.id = $1 AND e.docente_id = $2`,
    [examenId, docenteId],
  );
  if (!examen) return null;
  const [{ rows: calificaciones }, { rows: incidentes }] = await Promise.all([
    // Todos los alumnos asignados (presentaran o no) y cualquiera con intento.
    pool.query(
      `WITH asignados AS (
         SELECT ins.alumno_id, string_agg(g.nombre, ', ' ORDER BY g.nombre) AS grupos
           FROM examen_grupo eg JOIN grupo g ON g.id = eg.grupo_id JOIN inscripcion ins ON ins.grupo_id = g.id
          WHERE eg.examen_id = $1 GROUP BY ins.alumno_id),
       intentos AS (SELECT * FROM intento WHERE examen_id = $1)
       SELECT u.nombre_usuario AS alumno, COALESCE(a.grupos, '') AS grupos,
              CASE WHEN i.id IS NULL THEN 'NO_PRESENTADO' WHEN i.estado = 'ANULADO' AND i.plagio_confirmado THEN 'ANULADO_CONFIRMADO' ELSE i.estado END AS estado,
              CASE WHEN i.estado = 'ENVIADO' THEN i.calificacion::float END AS calificacion,
              COALESCE(i.publicado, false) AS publicado
         FROM asignados a FULL JOIN intentos i ON i.alumno_id = a.alumno_id
         JOIN usuario u ON u.id = COALESCE(a.alumno_id, i.alumno_id)
        ORDER BY u.nombre_usuario`,
      [examenId],
    ),
    pool.query(
      `SELECT u.nombre_usuario AS alumno, inc.tipo, inc.ocurrio_en, inc.ip, inc.dispositivo, inc.decision
         FROM incidente inc JOIN intento i ON i.id = inc.intento_id JOIN usuario u ON u.id = i.alumno_id
        WHERE i.examen_id = $1 ORDER BY inc.ocurrio_en`,
      [examenId],
    ),
  ]);
  for (const i of incidentes) i.dispositivo_resumen = resumenDispositivo(i.dispositivo);
  return { examen, calificaciones, incidentes, estadisticas: estadisticas(calificaciones, incidentes) };
}

export function estadisticas(calificaciones, incidentes) {
  const notas = calificaciones.map((c) => c.calificacion).filter((n) => n !== null);
  const cuenta = (f) => notas.filter(f).length;
  return {
    asignados: calificaciones.length,
    calificados: notas.length,
    no_presentados: calificaciones.filter((c) => c.estado === 'NO_PRESENTADO').length,
    // En centésimas enteras: 9.165 en flotante es 9.16499… y se redondearía mal.
    promedio: notas.length ? Math.round(notas.reduce((a, n) => a + Math.round(n * 100), 0) / notas.length) / 100 : null,
    aprobados: cuenta((n) => n >= APROBATORIA),
    maxima: notas.length ? Math.max(...notas) : null,
    minima: notas.length ? Math.min(...notas) : null,
    incidentes: incidentes.length,
    distribucion: [
      { rango: '9 – 10', alumnos: cuenta((n) => n >= 9) },
      { rango: `${APROBATORIA} – 8.9`, alumnos: cuenta((n) => n >= APROBATORIA && n < 9) },
      { rango: `Menos de ${APROBATORIA}`, alumnos: cuenta((n) => n < APROBATORIA) },
    ],
  };
}

const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' });
const nota = (n) => (n === null ? '—' : n.toFixed(2));

// Filas ya legibles, comunes a Excel y PDF.
function tablas({ calificaciones, incidentes, estadisticas: s }) {
  return {
    calificaciones: {
      columnas: ['Alumno', 'Grupo', 'Estado', 'Calificación', 'Publicado'],
      filas: calificaciones.map((c) => [c.alumno, c.grupos, ESTADOS[c.estado], c.calificacion, c.publicado ? 'Sí' : 'No']),
    },
    incidentes: {
      columnas: ['Alumno', 'Tipo', 'Fecha y hora', 'IP', 'Dispositivo', 'Decisión', 'User agent'],
      filas: incidentes.map((i) => [i.alumno, INCIDENTES[i.tipo], fecha.format(i.ocurrio_en), i.ip, i.dispositivo_resumen, DECISIONES[i.decision], i.dispositivo]),
    },
    estadisticas: {
      columnas: ['Indicador', 'Valor'],
      filas: [
        ['Alumnos asignados', s.asignados], ['Calificados', s.calificados], ['No presentaron', s.no_presentados],
        ['Promedio', s.promedio], [`Aprobados (${APROBATORIA} o más)`, s.aprobados], ['Máxima', s.maxima], ['Mínima', s.minima], ['Incidentes', s.incidentes],
        ...s.distribucion.map((d) => [`Alumnos con ${d.rango.replace('Menos', 'menos')}`, d.alumnos]),
      ],
    },
  };
}

export async function reporteExcel(datos) {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Plataforma de exámenes · Tecnológico de Cuautla';
  const t = tablas(datos);
  for (const [nombre, tabla] of [['Calificaciones', t.calificaciones], ['Incidentes', t.incidentes], ['Estadísticas', t.estadisticas]]) {
    const hoja = libro.addWorksheet(nombre);
    hoja.addRow([datos.examen.titulo]).font = { bold: true, size: 13 };
    hoja.addRow([datos.examen.grupos]);
    hoja.addRow([]);
    hoja.addRow(tabla.columnas).font = { bold: true };
    // Las celdas de texto se escriben como texto: un "=…" nunca se evalúa como fórmula.
    for (const fila of tabla.filas) hoja.addRow(fila.map((v) => (v ?? '')));
    hoja.columns.forEach((c, i) => { c.width = Math.min(45, Math.max(12, ...tabla.filas.map((f) => String(f[i] ?? '').length + 2), String(tabla.columnas[i] ?? '').length + 2)); });
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

export function reportePdf(datos) {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50, info: { Title: `Reporte · ${datos.examen.titulo}` } });
  const partes = [];
  doc.on('data', (p) => partes.push(p));
  const fin = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(partes))));
  const t = tablas(datos);
  const ancho = doc.page.width - 100;

  const tabla = (titulo, { columnas, filas }, proporciones) => {
    doc.moveDown(1).font('Helvetica-Bold').fontSize(12).fillColor('#1F3A6E').text(titulo, 50).fillColor('black').moveDown(0.3);
    const xs = proporciones.reduce((acc, p) => [...acc, acc.at(-1) + p * ancho], [50]);
    const fila = (valores, negrita) => {
      if (doc.y > doc.page.height - 80) doc.addPage();
      const y = doc.y;
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
      const altos = valores.map((v, i) => doc.heightOfString(String(v ?? '—'), { width: xs[i + 1] - xs[i] - 6 }));
      valores.forEach((v, i) => doc.text(String(v ?? '—'), xs[i], y, { width: xs[i + 1] - xs[i] - 6 }));
      doc.y = y + Math.max(...altos) + 4;
      doc.moveTo(50, doc.y - 2).lineTo(50 + ancho, doc.y - 2).lineWidth(0.5).strokeColor('#D5DAE3').stroke();
    };
    fila(columnas, true);
    if (!filas.length) fila(['Sin registros.'], false);
    for (const f of filas) fila(f, false);
  };

  doc.font('Helvetica-Bold').fontSize(16).text(datos.examen.titulo);
  doc.font('Helvetica').fontSize(10).fillColor('#5B6475').text(datos.examen.grupos || 'Sin grupos asignados')
    .text(`Generado: ${fecha.format(new Date())}`).fillColor('black');
  tabla('Estadísticas', t.estadisticas, [0.6, 0.4]);
  tabla('Calificaciones', { ...t.calificaciones, filas: t.calificaciones.filas.map((f) => [f[0], f[1], f[2], nota(f[3]), f[4]]) }, [0.28, 0.18, 0.26, 0.15, 0.13]);
  tabla('Incidentes', { columnas: t.incidentes.columnas.slice(0, 6), filas: t.incidentes.filas.map((f) => f.slice(0, 6)) }, [0.2, 0.17, 0.2, 0.14, 0.15, 0.14]);
  doc.end();
  return fin;
}

// Validación del examen que envía el docente (frontera de confianza). Función pura: no toca la BD.
// Un borrador puede estar incompleto; programarlo exige todo lo necesario para que un alumno lo presente.

export const TIPOS = ['ABIERTA', 'OPCION_MULTIPLE', 'VERDADERO_FALSO'];
export const IMAGEN_VALIDA = /^(\d+)-[a-z0-9]{16}\.(png|jpg)$/; // <docente_id>-<aleatorio>.<ext>

const esEnteroEn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const fecha = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined = inválida
};

/**
 * @returns {{ errores: string[], datos: object }} datos normalizados listos para guardar.
 */
export function validarExamen(cuerpo, { programar = false, docenteId, ahora = new Date() } = {}) {
  const errores = [];
  const c = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};

  const titulo = texto(c.titulo);
  if (!titulo || titulo.length > 150) errores.push('Escribe el título del examen (máximo 150 caracteres).');
  const instrucciones = texto(c.instrucciones);
  if (instrucciones.length > 5000) errores.push('Las instrucciones son demasiado largas (máximo 5000 caracteres).');

  const abreEn = fecha(c.abre_en);
  const cierraEn = fecha(c.cierra_en);
  if (abreEn === undefined || cierraEn === undefined) errores.push('La fecha de apertura o de cierre no es válida.');
  if (abreEn && cierraEn && cierraEn <= abreEn) errores.push('El cierre debe ser posterior a la apertura.');

  const duracion = c.duracion_min === null || c.duracion_min === undefined || c.duracion_min === '' ? null : Number(c.duracion_min);
  if (duracion !== null && !esEnteroEn(duracion, 1, 600)) errores.push('La duración debe ser de 1 a 600 minutos.');
  const umbral = Number(c.umbral_inactividad_min ?? 3);
  if (!esEnteroEn(umbral, 1, 60)) errores.push('La inactividad que anula el examen debe ser de 1 a 60 minutos.');

  const grupos = Array.isArray(c.grupos) ? [...new Set(c.grupos.map(Number))] : [];
  if (grupos.some((g) => !esEnteroEn(g, 1, Number.MAX_SAFE_INTEGER))) errores.push('Hay un grupo inválido.');

  const tiemposExtra = Array.isArray(c.tiempos_extra) ? c.tiempos_extra : [];
  const vistos = new Set();
  for (const t of tiemposExtra) {
    if (!esEnteroEn(Number(t?.alumno_id), 1, Number.MAX_SAFE_INTEGER) || !esEnteroEn(Number(t?.minutos), 1, 240)) {
      errores.push('El tiempo extra debe ser de 1 a 240 minutos para un alumno válido.');
      break;
    }
    if (vistos.has(Number(t.alumno_id))) { errores.push('Un alumno aparece dos veces en el tiempo extra.'); break; }
    vistos.add(Number(t.alumno_id));
  }

  const entrada = Array.isArray(c.preguntas) ? c.preguntas : [];
  if (entrada.length > 200) errores.push('Un examen admite como máximo 200 preguntas.');
  const preguntas = entrada.slice(0, 200).map((p, i) => {
    const n = `Pregunta ${i + 1}`;
    const tipo = TIPOS.includes(p?.tipo) ? p.tipo : null;
    if (!tipo) errores.push(`${n}: tipo de pregunta inválido.`);
    const enunciado = texto(p?.enunciado);
    if (!enunciado || enunciado.length > 5000) errores.push(`${n}: escribe el enunciado (máximo 5000 caracteres).`);
    const puntos = Number(p?.puntos);
    if (!Number.isFinite(puntos) || puntos < 0 || puntos > 100) errores.push(`${n}: los puntos deben estar entre 0 y 100.`);

    let imagen = null;
    if (p?.imagen_ruta) {
      const m = IMAGEN_VALIDA.exec(String(p.imagen_ruta));
      if (!m || Number(m[1]) !== docenteId) errores.push(`${n}: la imagen no es válida.`);
      else imagen = p.imagen_ruta;
    }

    let opciones = [];
    if (tipo === 'OPCION_MULTIPLE') {
      const lista = Array.isArray(p.opciones) ? p.opciones : [];
      opciones = lista.map((o) => ({ texto: texto(o?.texto), es_correcta: o?.es_correcta === true }));
      if (opciones.length < 2 || opciones.length > 10) errores.push(`${n}: debe tener de 2 a 10 opciones.`);
      if (opciones.some((o) => !o.texto || o.texto.length > 1000)) errores.push(`${n}: todas las opciones necesitan texto (máximo 1000 caracteres).`);
      if (opciones.filter((o) => o.es_correcta).length !== 1) errores.push(`${n}: marca exactamente una opción correcta.`);
    } else if (tipo === 'VERDADERO_FALSO') {
      if (typeof p.correcta !== 'boolean') errores.push(`${n}: indica si la respuesta correcta es Verdadero o Falso.`);
      opciones = [{ texto: 'Verdadero', es_correcta: p.correcta === true }, { texto: 'Falso', es_correcta: p.correcta === false }];
    }
    return { tipo, enunciado, puntos: Number.isFinite(puntos) ? Math.round(puntos * 100) / 100 : 0, imagen_ruta: imagen, opciones };
  });

  if (programar) {
    if (!preguntas.length) errores.push('Para programarlo, agrega al menos una pregunta.');
    if (!abreEn || !cierraEn) errores.push('Para programarlo, define la apertura y el cierre.');
    else if (cierraEn <= ahora) errores.push('Para programarlo, el cierre debe ser una fecha futura.');
    if (duracion === null) errores.push('Para programarlo, define la duración.');
    if (!grupos.length) errores.push('Para programarlo, asígnalo al menos a un grupo.');
  }

  return {
    errores,
    datos: {
      titulo, instrucciones,
      abre_en: abreEn || null, cierra_en: cierraEn || null,
      duracion_min: duracion, umbral_inactividad_min: umbral,
      mostrar_respuestas: c.mostrar_respuestas === true,
      permite_herramienta: c.permite_herramienta === true,
      grupos, preguntas,
      tiempos_extra: tiemposExtra.map((t) => ({ alumno_id: Number(t.alumno_id), minutos: Number(t.minutos) })),
      estado: programar ? 'PROGRAMADO' : 'BORRADOR',
    },
  };
}

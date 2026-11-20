import { pool } from '../db/pool.js';

// Bitácora de acciones importantes: quién hizo qué sobre qué (RNF-08).
export function registrarAuditoria(usuarioId, accion, entidad, entidadId, detalle = '') {
  return pool.query(
    'INSERT INTO bitacora_auditoria (usuario_id, accion, entidad, entidad_id, detalle) VALUES ($1, $2, $3, $4, $5)',
    [usuarioId, accion, entidad, entidadId, detalle],
  );
}

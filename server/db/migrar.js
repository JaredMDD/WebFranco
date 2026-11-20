// Aplica schema.sql y crea el administrador inicial si no existe ninguno.
// Uso: npm run db:migrar   (ADMIN_USUARIO opcional; la contraseña se genera y se muestra una sola vez)
//      npm run db:migrar -- --nueva-contrasena-admin   (genera otra contraseña para los administradores existentes)
import { readFileSync } from 'node:fs';
import { pool } from './pool.js';
import { hashContrasena, contrasenaAleatoria } from '../services/contrasenas.js';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
await pool.query(schema);
console.log('Esquema aplicado.');

const { rowCount } = await pool.query("SELECT 1 FROM usuario WHERE rol = 'ADMIN'");
if (rowCount === 0) {
  const usuario = process.env.ADMIN_USUARIO || 'admin';
  const contrasena = contrasenaAleatoria();
  await pool.query(
    "INSERT INTO usuario (nombre_usuario, contrasena_hash, rol) VALUES ($1, $2, 'ADMIN')",
    [usuario, await hashContrasena(contrasena)],
  );
  console.log(`Administrador creado. Usuario: ${usuario}  Contraseña: ${contrasena}`);
  console.log('Guárdala ahora: no se vuelve a mostrar. Si la pierdes: npm run db:migrar -- --nueva-contrasena-admin');
} else if (process.argv.includes('--nueva-contrasena-admin')) {
  const { rows } = await pool.query("SELECT id, nombre_usuario FROM usuario WHERE rol = 'ADMIN'");
  for (const a of rows) {
    const contrasena = contrasenaAleatoria();
    await pool.query('UPDATE usuario SET contrasena_hash = $1 WHERE id = $2', [await hashContrasena(contrasena), a.id]);
    await pool.query('UPDATE sesion SET activa = false WHERE usuario_id = $1', [a.id]);
    console.log(`Nueva contraseña. Usuario: ${a.nombre_usuario}  Contraseña: ${contrasena}`);
  }
}
await pool.end();

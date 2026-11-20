import pg from 'pg';

// bigint (OID 20) llega como texto por defecto; los IDs nunca rebasan 2^53, así que se leen como número
// para que comparar req.usuario.id con otros números funcione.
pg.types.setTypeParser(20, Number);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Sin esto, un error en una conexión inactiva tumba el proceso.
pool.on('error', (err) => console.error('Error en conexión inactiva de PostgreSQL:', err.message));

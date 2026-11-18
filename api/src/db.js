import pg from 'pg';
import { config } from './config.js';

// Les dates et nombres restent en texte : le JSON est produit par Postgres
// lui-même (json_agg), l'API ne re-sérialise rien.
export const pool = new pg.Pool(config.db);
pool.on('error', (err) => console.error('[pg] erreur de connexion inactive :', err.message));

/**
 * Exécute fn dans une transaction avec l'identité de l'appelant, exactement
 * comme Supabase : rôle Postgres + claims JWT locaux à la transaction.
 * Les policies RLS et auth.uid() s'appliquent donc sans rien réécrire.
 */
export async function withIdentity({ role, claims }, { readOnly = false }, fn) {
  const client = await pool.connect();
  try {
    await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
    await client.query(
      `select set_config('role', $1, true),
              set_config('request.jwt.claims', $2, true),
              set_config('statement_timeout', $3, true)`,
      [role, JSON.stringify(claims), String(config.statementTimeout[role])],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

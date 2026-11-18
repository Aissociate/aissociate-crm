// Accès au schéma auth, avec un rôle Postgres dédié (auth_admin).
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { config } from '../config.js';

export const authPool = new pg.Pool(config.auth.db);
authPool.on('error', (err) => console.error('[pg auth] erreur de connexion inactive :', err.message));

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

const USER_COLS = `id, aud, role, email, encrypted_password, email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, banned_until, deleted_at, created_at, updated_at`;

export async function findUserByEmail(email) {
  const r = await authPool.query(`select ${USER_COLS} from auth.users where lower(email) = lower($1) and deleted_at is null`, [email]);
  return r.rows[0] ?? null;
}

export async function findUserById(id) {
  const r = await authPool.query(`select ${USER_COLS} from auth.users where id = $1 and deleted_at is null`, [id]);
  return r.rows[0] ?? null;
}

export async function createUser(email, passwordHash, metadata) {
  const r = await authPool.query(
    `insert into auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
     values (lower($1), $2, now(), '{"provider":"email","providers":["email"]}', $3)
     returning ${USER_COLS}`,
    [email, passwordHash, JSON.stringify(metadata ?? {})],
  );
  return r.rows[0];
}

export async function updateUser(id, { passwordHash, metadata }) {
  const r = await authPool.query(
    `update auth.users set
       encrypted_password = coalesce($2, encrypted_password),
       raw_user_meta_data = case when $3::jsonb is null then raw_user_meta_data else raw_user_meta_data || $3::jsonb end,
       updated_at = now()
     where id = $1 and deleted_at is null returning ${USER_COLS}`,
    [id, passwordHash ?? null, metadata ? JSON.stringify(metadata) : null],
  );
  return r.rows[0] ?? null;
}

export async function deleteUser(id) {
  const r = await authPool.query('delete from auth.users where id = $1', [id]);
  return r.rowCount > 0;
}

/** Ouvre une session : nouveau jeton de rafraîchissement (seul son hachage est stocké). */
export async function createSession(userId, sessionId = randomUUID()) {
  const token = newToken();
  await authPool.query(
    `insert into auth.refresh_tokens (token_hash, user_id, session_id, expires_at)
     values ($1, $2, $3, now() + make_interval(days => $4))`,
    [sha256(token), userId, sessionId, config.auth.refreshTokenTtlDays],
  );
  await authPool.query('update auth.users set last_sign_in_at = now() where id = $1', [userId]);
  return { sessionId, refreshToken: token };
}

/**
 * Rotation : le jeton présenté est révoqué et remplacé. Un jeton déjà révoqué
 * rejoué hors tolérance signale un vol : toute la session est fermée.
 */
export async function rotateRefreshToken(token) {
  const client = await authPool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `select token_hash, user_id, session_id, revoked_at, expires_at < now() as expired,
              revoked_at is not null and revoked_at > now() - make_interval(secs => $2) as in_grace
         from auth.refresh_tokens where token_hash = $1 for update`,
      [sha256(token), config.auth.refreshReuseSeconds],
    );
    const row = r.rows[0];
    if (!row || row.expired) { await client.query('COMMIT'); return { error: 'not_found' }; }
    if (row.revoked_at && !row.in_grace) {
      await client.query('update auth.refresh_tokens set revoked_at = coalesce(revoked_at, now()) where session_id = $1', [row.session_id]);
      await client.query('COMMIT');
      return { error: 'reused' };
    }
    if (!row.revoked_at) await client.query('update auth.refresh_tokens set revoked_at = now() where token_hash = $1', [row.token_hash]);
    const next = newToken();
    await client.query(
      `insert into auth.refresh_tokens (token_hash, user_id, session_id, expires_at)
       values ($1, $2, $3, now() + make_interval(days => $4))`,
      [sha256(next), row.user_id, row.session_id, config.auth.refreshTokenTtlDays],
    );
    await client.query('COMMIT');
    return { userId: row.user_id, sessionId: row.session_id, refreshToken: next };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function sessionIsActive(sessionId) {
  if (!sessionId) return false;
  const r = await authPool.query(
    'select 1 from auth.refresh_tokens where session_id = $1 and revoked_at is null and expires_at > now() limit 1', [sessionId]);
  return r.rowCount > 0;
}

export async function revokeSessions(userId, sessionId, scope) {
  const where = scope === 'global' ? 'user_id = $1' : scope === 'others' ? 'user_id = $1 and session_id <> $2' : 'user_id = $1 and session_id = $2';
  await authPool.query(
    `update auth.refresh_tokens set revoked_at = now() where ${where} and revoked_at is null`,
    scope === 'global' ? [userId] : [userId, sessionId],
  );
}

/** Jeton à usage unique (réinitialisation, lien magique) : renvoie la valeur en clair, stocke son hachage. */
export async function createOneTimeToken(userId, kind) {
  const token = randomBytes(32).toString('hex');
  await authPool.query('delete from auth.one_time_tokens where user_id = $1 and (used_at is not null or expires_at < now())', [userId]);
  await authPool.query(
    `insert into auth.one_time_tokens (token_hash, user_id, kind, expires_at)
     values ($1, $2, $3, now() + make_interval(mins => $4))`,
    [sha256(token), userId, kind, config.auth.oneTimeTokenTtlMinutes],
  );
  return token;
}

/** Consomme le jeton de façon atomique : un seul appel peut réussir. */
export async function consumeOneTimeToken(token, kind) {
  const r = await authPool.query(
    `update auth.one_time_tokens set used_at = now()
      where token_hash = $1 and kind = $2 and used_at is null and expires_at > now()
      returning user_id`,
    [sha256(String(token)), kind],
  );
  return r.rows[0]?.user_id ?? null;
}

export async function smtpSettings() {
  const r = await authPool.query(`select valeur from public.parametres where cle = 'smtp'`);
  return r.rows[0]?.valeur ?? null;
}

// Purge quotidienne des jetons expirés ou révoqués depuis longtemps.
setInterval(() => {
  authPool.query(`delete from auth.refresh_tokens where expires_at < now() or revoked_at < now() - interval '7 days';
                  delete from auth.one_time_tokens where expires_at < now() - interval '1 day'`).catch(() => {});
}, 24 * 3_600_000).unref();

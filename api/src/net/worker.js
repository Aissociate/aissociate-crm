// Exécute les appels HTTP mis en file par la base (net.http_post) : tâches
// pg_cron et triggers. Remplace l'extension pg_net de Supabase.
// Garde-fou : seules les URL de notre propre API sont appelées.
import pg from 'pg';
import { config } from '../config.js';
import { authPool } from '../auth/store.js';

const OWN = `${config.auth.externalUrl}/`;

/** URL de la file → URL interne de l'API, ou null si elle sort de notre périmètre. */
export function internalTarget(url, own = OWN, internal = config.net.internalUrl) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (`${u.origin}/` !== own) return null;
  if (u.username || u.password) return null;
  return `${internal}${u.pathname}${u.search}`;
}

async function runOne(row, log) {
  const target = internalTarget(row.url);
  let status = null, error = null;
  if (!target) error = 'URL hors périmètre : appel refusé';
  else {
    try {
      const headers = {};
      for (const [k, v] of Object.entries(row.headers ?? {})) if (typeof v === 'string') headers[k] = v;
      const res = await fetch(target, {
        method: row.method === 'GET' ? 'GET' : 'POST',
        headers,
        body: row.method === 'GET' ? undefined : JSON.stringify(row.body ?? {}),
        signal: AbortSignal.timeout(Math.min(Math.max(row.timeout_ms ?? 5000, 1000), 400_000)),
      });
      status = res.status;
      await res.arrayBuffer().catch(() => {});
    } catch (err) {
      error = String(err.message ?? err).slice(0, 500);
    }
  }
  await authPool.query('update net.http_request_queue set status = $2, error = $3 where id = $1', [row.id, status, error]);
  if (error || status >= 400) log.warn({ msg: 'net : appel en échec', id: row.id, url: row.url.replace(/\?.*/, ''), status, error });
}

let draining = false;
async function drain(log) {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      // Réservation atomique : une ligne n'est exécutée qu'une fois.
      const { rows } = await authPool.query(
        `update net.http_request_queue set sent_at = now()
          where id in (select id from net.http_request_queue where sent_at is null order by id limit 10 for update skip locked)
          returning id, method, url, headers, body, timeout_ms`);
      if (!rows.length) break;
      await Promise.all(rows.map((r) => runOne(r, log)));
    }
  } catch (err) {
    log.error({ msg: 'net : file illisible', err: err.message });
  } finally {
    draining = false;
  }
}

export async function startNetWorker(log) {
  if (!config.net.enabled) { log.info('net : exécuteur désactivé (NET_WORKER_ENABLED=false)'); return; }
  const listen = async () => {
    const client = new pg.Client(config.auth.db);
    client.on('error', () => {});
    client.on('end', () => setTimeout(() => listen().catch(() => {}), 5000));
    client.on('notification', () => drain(log));
    await client.connect();
    await client.query('listen net_http');
  };
  await listen().catch((err) => log.error({ msg: 'net : écoute impossible', err: err.message }));
  setInterval(() => drain(log), 30_000).unref();
  setInterval(() => authPool.query(`delete from net.http_request_queue where created_at < now() - interval '14 days'`).catch(() => {}), 24 * 3_600_000).unref();
  drain(log);
  log.info('net : exécuteur démarré');
}

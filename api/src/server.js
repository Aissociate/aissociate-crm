import Fastify from 'fastify';
import { config } from './config.js';
import { pool } from './db.js';
import { ApiError, fromPgError } from './errors.js';
import { verifyJwt } from './jwt.js';
import { restRoutes } from './rest/routes.js';
import { loadSchema } from './schema.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: config.bodyLimit, trustProxy: true });

// CORS : même ouverture que Supabase (la sécurité repose sur le JWT et les RLS).
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, range, x-client-info, x-supabase-api-version',
  'access-control-expose-headers': 'content-range, content-profile',
  'access-control-max-age': '3600',
};
app.addHook('onRequest', async (req, reply) => {
  reply.headers(CORS);
  if (req.method === 'OPTIONS') return reply.code(204).send();
});

// DELETE et POST sans corps arrivent parfois avec content-type JSON et un corps vide.
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (body === '') return done(null, undefined);
  try { done(null, JSON.parse(body)); } catch { done(new ApiError(400, 'PGRST102', 'Corps JSON invalide')); }
});

app.setErrorHandler((err, req, reply) => {
  let e = err;
  if (!(e instanceof ApiError)) {
    if (typeof err.code === 'string' && err.code.length === 5 && err.severity) {
      let role = 'authenticated';
      try { role = verifyJwt((req.headers.authorization ?? '').slice(7) || req.headers.apikey, config.jwtSecret).role; } catch { /* rôle inconnu */ }
      e = fromPgError(err, role);
    } else if (err.statusCode && err.statusCode < 500) {
      e = new ApiError(err.statusCode, 'PGRST100', err.message);
    } else {
      req.log.error(err);
      e = new ApiError(500, 'XX000', 'Erreur interne');
    }
  }
  if (e.status >= 500) req.log.error({ code: e.code, msg: e.message });
  reply.code(e.status).type('application/json; charset=utf-8').send(JSON.stringify(e));
});

app.get('/health', async () => {
  await pool.query('select 1');
  return { ok: true };
});

app.options('/*', (req, reply) => reply.code(204).send());

restRoutes(app);

await loadSchema();
await app.listen({ port: config.port, host: '0.0.0.0' });

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => { await app.close(); await pool.end(); process.exit(0); });
}

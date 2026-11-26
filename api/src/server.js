import { promisify } from 'node:util';
import zlib from 'node:zlib';
import Fastify from 'fastify';
import { config } from './config.js';
import { pool } from './db.js';
import { ApiError, fromPgError } from './errors.js';
import { verifyJwt } from './jwt.js';
import { authRoutes } from './auth/routes.js';
import { functionsRoutes } from './functions/routes.js';
import { startNetWorker } from './net/worker.js';
import { startRealtime } from './realtime/server.js';
import { restRoutes } from './rest/routes.js';
import { storageRoutes } from './storage/routes.js';
import { loadSchema } from './schema.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: config.bodyLimit, trustProxy: true });

// CORS : même ouverture que Supabase (la sécurité repose sur le JWT et les RLS).
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, range, x-client-info, x-supabase-api-version, x-upsert, cache-control',
  'access-control-expose-headers': 'content-range, content-profile, content-length, accept-ranges, etag',
  'access-control-max-age': '3600',
};
app.addHook('onRequest', async (req, reply) => {
  reply.headers(CORS);
  if (req.method === 'OPTIONS' && !req.url.startsWith('/functions/v1/')) return reply.code(204).send();
});

// Compression des réponses JSON/texte, faite ici et non dans Traefik : son
// middleware « compress » laisse passer tel quel toute réponse portant un
// en-tête Content-Range, or /rest/v1 en renvoie un sur chaque lecture (comme
// PostgREST). Sans compression, la page Contacts transfère ~4 Mo de JSON.
// Les flux (fichiers du stockage, réponses relayées des fonctions) ne sont pas
// des chaînes/Buffer et passent donc sans être touchés.
const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);
const COMPRESSIBLE =/^(application\/([\w.+-]*\+)?json|text\/)/i;
app.addHook('onSend', async (req, reply, payload) => {
  if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;
  if (reply.getHeader('content-encoding') || req.method === 'HEAD') return payload;
  if (!COMPRESSIBLE.test(String(reply.getHeader('content-type') ?? ''))) return payload;
  reply.header('vary', 'Accept-Encoding');
  if (Buffer.byteLength(payload) < 1024) return payload;
  const accept = String(req.headers['accept-encoding'] ?? '').toLowerCase();
  let encoding, out;
  if (/\bbr\b/.test(accept)) {
    encoding = 'br';
    out = await brotli(payload, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
  } else if (/\bgzip\b/.test(accept)) {
    encoding = 'gzip';
    out = await gzip(payload, { level: 6 });
  } else return payload;
  reply.header('content-encoding', encoding);
  reply.removeHeader('content-length');
  return out;
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
authRoutes(app);
await app.register(storageRoutes);
await app.register(functionsRoutes);

await loadSchema();
await startRealtime(app);
await app.listen({ port: config.port, host: '0.0.0.0' });
await startNetWorker(app.log);

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => { await app.close(); await pool.end(); process.exit(0); });
}

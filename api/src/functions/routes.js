// Relais /functions/v1/<nom> vers le conteneur des fonctions (réseau interne).
// Comme la passerelle Supabase : un JWT valide est exigé, sauf pour les
// fonctions déclarées publiques (webhooks, sitemap, pages sans connexion…).
// Corps et réponses passent en flux (envois de fichiers, réponses en streaming).
import { Readable } from 'node:stream';
import { config } from '../config.js';
import { verifyJwt } from '../jwt.js';

const F = config.functions;
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
// En-têtes propres à une connexion : jamais relayés.
const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length',
  // Pas de compression entre l'API et les fonctions : fetch décompresse la réponse,
  // l'en-tête d'encodage ne doit donc ni partir ni revenir.
  'accept-encoding', 'content-encoding']);

const fail = (reply, status, message) => reply.code(status).type('application/json; charset=utf-8').send(JSON.stringify({ code: status, message }));

async function relay(req, reply) {
  const name = req.params.name;
  if (!NAME_RE.test(name)) return fail(reply, 404, 'Requested function was not found');

  if (req.method !== 'OPTIONS' && !F.noVerifyJwt.has(name)) {
    const auth = req.headers.authorization ?? '';
    if (!/^Bearer\s+\S/i.test(auth)) return fail(reply, 401, 'Missing authorization header');
    try {
      const claims = verifyJwt(auth.replace(/^Bearer\s+/i, ''), config.jwtSecret);
      if (!['anon', 'authenticated', 'service_role'].includes(claims.role)) throw new Error();
    } catch {
      return fail(reply, 401, 'Invalid JWT');
    }
  }

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : v;
  headers['x-forwarded-for'] = req.ip;
  headers['x-forwarded-host'] = req.headers.host ?? '';
  headers['x-forwarded-proto'] = req.protocol;

  const rest = req.params['*'] ? `/${req.params['*']}` : '';
  const search = req.raw.url.includes('?') ? req.raw.url.slice(req.raw.url.indexOf('?')) : '';
  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.body && typeof req.body.pipe === 'function';
  const abort = new AbortController();
  // Client parti avant la fin de la réponse : on libère la fonction.
  reply.raw.on('close', () => { if (!reply.raw.writableFinished) abort.abort(); });
  const timer = setTimeout(() => abort.abort(), F.timeoutMs);

  let res;
  try {
    res = await fetch(`${F.url}/${name}${rest}${search}`, {
      method: req.method,
      headers,
      body: hasBody ? Readable.toWeb(req.body) : undefined,
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
      signal: abort.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (abort.signal.aborted) return fail(reply, 504, 'La fonction n\'a pas répondu à temps');
    req.log.error({ msg: 'fonctions injoignables', err: err.message });
    return fail(reply, 502, 'Service des fonctions indisponible');
  }

  reply.code(res.status);
  for (const [k, v] of res.headers) if (!HOP.has(k) && k !== 'set-cookie') reply.header(k, v);
  const cookies = res.headers.getSetCookie?.() ?? [];
  if (cookies.length) reply.header('set-cookie', cookies);
  if (!res.body) { clearTimeout(timer); return reply.send(); }
  const body = Readable.fromWeb(res.body);
  body.on('close', () => clearTimeout(timer));
  return reply.send(body);
}

export async function functionsRoutes(app) {
  // Corps relayés en flux, sans les charger en mémoire.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', (_req, payload, done) => done(null, payload));
  const opts = { bodyLimit: F.bodyLimit };
  const methods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  app.route({ method: methods, url: '/functions/v1/:name', ...opts, handler: relay });
  app.route({ method: methods, url: '/functions/v1/:name/*', ...opts, handler: relay });
}

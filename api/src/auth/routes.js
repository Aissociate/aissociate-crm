// Routes /auth/v1 : mêmes URL et formats que l'authentification de Supabase
// (GoTrue), limités à ce que l'application utilise : connexion par e-mail et
// mot de passe, inscription, session, réinitialisation, et les quelques
// opérations d'administration appelées par les fonctions serveur.
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { AuthError } from '../errors.js';
import { signJwt, verifyJwt } from '../jwt.js';
import { sendRecoveryEmail } from './mailer.js';
import { rateLimit, resetRateLimit } from './ratelimit.js';
import * as store from './store.js';

const A = config.auth;
const BCRYPT_COST = 10;
// Hachage factice : même temps de réponse que l'e-mail existe ou non.
const DUMMY_HASH = bcrypt.hashSync('mot-de-passe-factice', BCRYPT_COST);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN = 60_000;

const invalidCredentials = () => new AuthError(400, 'invalid_credentials', 'Invalid login credentials');

function publicUser(u) {
  return {
    id: u.id,
    aud: u.aud ?? 'authenticated',
    role: u.role ?? 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    confirmed_at: u.email_confirmed_at,
    phone: '',
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: u.raw_app_meta_data ?? {},
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at,
    is_anonymous: false,
  };
}

async function sessionResponse(user, method, existing) {
  const { sessionId, refreshToken } = existing ?? (await store.createSession(user.id));
  const now = Math.floor(Date.now() / 1000);
  const access_token = signJwt({
    iss: `${A.externalUrl}/auth/v1`,
    aud: 'authenticated',
    sub: user.id,
    email: user.email,
    phone: '',
    role: 'authenticated',
    app_metadata: user.raw_app_meta_data ?? {},
    user_metadata: user.raw_user_meta_data ?? {},
    aal: 'aal1',
    amr: [{ method, timestamp: now }],
    session_id: sessionId,
    is_anonymous: false,
  }, config.jwtSecret, A.accessTokenTtl);
  const fresh = existing ? user : (await store.findUserById(user.id)) ?? user;
  return { access_token, token_type: 'bearer', expires_in: A.accessTokenTtl, expires_at: now + A.accessTokenTtl, refresh_token: refreshToken, user: publicUser(fresh) };
}

/** Toute route d'auth exige la clé du projet (anon ou service), comme chez Supabase. */
function requireApiKey(req) {
  const key = req.headers.apikey ?? (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  try {
    const c = verifyJwt(key, config.jwtSecret);
    if (!['anon', 'authenticated', 'service_role'].includes(c.role)) throw new Error();
  } catch {
    throw new AuthError(401, 'no_authorization', 'Clé API manquante ou invalide');
  }
}

/** Jeton d'accès d'un utilisateur connecté (en-tête Authorization). */
function bearerClaims(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  let claims;
  try { claims = verifyJwt(token, config.jwtSecret); } catch { throw new AuthError(403, 'bad_jwt', 'invalid JWT: unable to parse or verify signature'); }
  return claims;
}

async function currentUser(req) {
  const claims = bearerClaims(req);
  if (claims.role !== 'authenticated' || !UUID_RE.test(claims.sub ?? '')) throw new AuthError(403, 'bad_jwt', 'invalid claim: missing sub claim');
  if (!(await store.sessionIsActive(claims.session_id))) throw new AuthError(403, 'session_not_found', 'Session from session_id claim in JWT does not exist');
  const user = await store.findUserById(claims.sub);
  if (!user) throw new AuthError(403, 'user_not_found', 'User from sub claim in JWT does not exist');
  return { user, claims };
}

function requireServiceRole(req) {
  if (bearerClaims(req).role !== 'service_role') throw new AuthError(403, 'not_admin', 'User not allowed');
}

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < A.passwordMinLength) throw new AuthError(422, 'weak_password', `Password should be at least ${A.passwordMinLength} characters.`);
  if (pw.length > 72) throw new AuthError(422, 'weak_password', 'Password cannot be longer than 72 characters');
}

function checkEmail(email) {
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) throw new AuthError(400, 'validation_failed', 'Unable to validate email address: invalid format');
  return email.trim().toLowerCase();
}

/** Redirection limitée aux origines connues : un lien ne peut pas livrer un jeton à un site tiers. */
export function safeRedirect(target, origins = A.redirectOrigins, fallback = A.siteUrl) {
  try {
    const u = new URL(target);
    if ((u.protocol === 'https:' || u.protocol === 'http:') && origins.includes(u.origin)) return u.toString();
  } catch { /* URL invalide */ }
  return fallback;
}

function usable(user) {
  return user && !(user.banned_until && new Date(user.banned_until) > new Date());
}

async function verifyOneTime(token, type) {
  if (!['recovery', 'magiclink'].includes(type)) throw new AuthError(400, 'validation_failed', 'Type de vérification non pris en charge');
  const userId = typeof token === 'string' && token ? await store.consumeOneTimeToken(token, type) : null;
  const user = userId ? await store.findUserById(userId) : null;
  if (!usable(user)) throw new AuthError(403, 'otp_expired', 'Email link is invalid or has expired');
  return sessionResponse(user, type === 'recovery' ? 'recovery' : 'otp');
}

export function authRoutes(app) {
  app.post('/auth/v1/token', async (req) => {
    requireApiKey(req);
    const grant = req.query.grant_type;
    const body = req.body ?? {};
    if (grant === 'password') {
      const email = String(body.email ?? '').trim().toLowerCase();
      rateLimit(`login:ip:${req.ip}`, 30, 5 * MIN);
      rateLimit(`login:${req.ip}:${email}`, 10, 5 * MIN);
      rateLimit(`login:email:${email}`, 20, 15 * MIN);
      const user = await store.findUserByEmail(email);
      const ok = await bcrypt.compare(String(body.password ?? ''), user?.encrypted_password || DUMMY_HASH);
      if (!ok || !user?.encrypted_password || !usable(user)) throw invalidCredentials();
      resetRateLimit(`login:${req.ip}:${email}`);
      return sessionResponse(user, 'password');
    }
    if (grant === 'refresh_token') {
      rateLimit(`refresh:ip:${req.ip}`, 150, 5 * MIN);
      const r = typeof body.refresh_token === 'string' ? await store.rotateRefreshToken(body.refresh_token) : { error: 'not_found' };
      if (r.error === 'reused') throw new AuthError(400, 'refresh_token_already_used', 'Invalid Refresh Token: Already Used');
      const user = r.error ? null : await store.findUserById(r.userId);
      if (!usable(user)) throw new AuthError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      return sessionResponse(user, 'token_refresh', r);
    }
    throw new AuthError(400, 'invalid_request', 'unsupported_grant_type');
  });

  app.post('/auth/v1/signup', async (req) => {
    requireApiKey(req);
    if (!A.allowSignup) throw new AuthError(422, 'signup_disabled', 'Signups not allowed for this instance');
    rateLimit(`signup:ip:${req.ip}`, 5, 60 * MIN);
    const body = req.body ?? {};
    const email = checkEmail(body.email);
    checkPassword(body.password);
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
    if (JSON.stringify(data).length > 4000) throw new AuthError(400, 'validation_failed', 'Métadonnées trop volumineuses');
    if (await store.findUserByEmail(email)) throw new AuthError(422, 'user_already_exists', 'User already registered');
    let user;
    try {
      user = await store.createUser(email, await bcrypt.hash(body.password, BCRYPT_COST), data);
    } catch (err) {
      if (err.code === '23505') throw new AuthError(422, 'user_already_exists', 'User already registered');
      throw err;
    }
    return sessionResponse(user, 'password');
  });

  app.get('/auth/v1/user', async (req) => {
    requireApiKey(req);
    return publicUser((await currentUser(req)).user);
  });

  app.put('/auth/v1/user', async (req) => {
    requireApiKey(req);
    const { user, claims } = await currentUser(req);
    const body = req.body ?? {};
    if (body.email !== undefined && String(body.email).toLowerCase() !== user.email) throw new AuthError(422, 'email_change_not_supported', 'Le changement d\'adresse e-mail se fait par un administrateur');
    const patch = {};
    if (body.password !== undefined) {
      checkPassword(body.password);
      patch.passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);
    }
    if (body.data !== undefined) {
      if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data) || JSON.stringify(body.data).length > 4000) throw new AuthError(400, 'validation_failed', 'Métadonnées invalides');
      patch.metadata = body.data;
    }
    const updated = await store.updateUser(user.id, patch);
    // Nouveau mot de passe : les autres appareils sont déconnectés.
    if (patch.passwordHash) await store.revokeSessions(user.id, claims.session_id, 'others');
    return publicUser(updated);
  });

  app.post('/auth/v1/logout', async (req, reply) => {
    requireApiKey(req);
    const claims = bearerClaims(req);
    const scope = ['global', 'local', 'others'].includes(req.query.scope) ? req.query.scope : 'global';
    if (UUID_RE.test(claims.sub ?? '')) await store.revokeSessions(claims.sub, claims.session_id ?? null, claims.session_id ? scope : 'global');
    return reply.code(204).send();
  });

  // Réponse identique que l'adresse existe ou non : pas d'énumération des comptes.
  app.post('/auth/v1/recover', async (req) => {
    requireApiKey(req);
    const email = checkEmail((req.body ?? {}).email);
    rateLimit(`recover:ip:${req.ip}`, 10, 60 * MIN);
    try { rateLimit(`recover:email:${email}`, 3, 60 * MIN); } catch { return {}; }
    const user = await store.findUserByEmail(email);
    if (usable(user)) {
      const token = await store.createOneTimeToken(user.id, 'recovery');
      const redirect = safeRedirect(req.query.redirect_to ?? (req.body ?? {}).redirect_to ?? A.siteUrl);
      const link = `${A.externalUrl}/auth/v1/verify?token=${token}&type=recovery&redirect_to=${encodeURIComponent(redirect)}`;
      // Envoi hors du chemin de la réponse : même délai que l'adresse existe ou non.
      sendRecoveryEmail(user.email, link, req.log).catch(() => {});
    }
    return {};
  });

  // Lien cliqué depuis l'e-mail : ouvre la session et renvoie vers le site.
  app.get('/auth/v1/verify', async (req, reply) => {
    rateLimit(`verify:ip:${req.ip}`, 30, 5 * MIN);
    const target = new URL(safeRedirect(req.query.redirect_to ?? A.siteUrl));
    try {
      const s = await verifyOneTime(req.query.token, req.query.type);
      target.hash = new URLSearchParams({
        access_token: s.access_token, expires_at: String(s.expires_at), expires_in: String(s.expires_in),
        refresh_token: s.refresh_token, token_type: 'bearer', type: String(req.query.type),
      }).toString();
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      target.hash = new URLSearchParams({ error: 'access_denied', error_code: err.code, error_description: err.message }).toString();
    }
    return reply.header('cache-control', 'no-store').header('referrer-policy', 'no-referrer').redirect(target.toString(), 303);
  });

  app.post('/auth/v1/verify', async (req) => {
    requireApiKey(req);
    rateLimit(`verify:ip:${req.ip}`, 30, 5 * MIN);
    const body = req.body ?? {};
    return verifyOneTime(body.token_hash ?? body.token, body.type);
  });

  // ── Administration : clé service_role uniquement (fonctions serveur) ──
  app.post('/auth/v1/admin/users', async (req) => {
    requireServiceRole(req);
    const body = req.body ?? {};
    const email = checkEmail(body.email);
    checkPassword(body.password);
    const data = body.user_metadata && typeof body.user_metadata === 'object' && !Array.isArray(body.user_metadata) ? body.user_metadata : {};
    if (JSON.stringify(data).length > 4000) throw new AuthError(400, 'validation_failed', 'Métadonnées trop volumineuses');
    if (await store.findUserByEmail(email)) throw new AuthError(422, 'email_exists', 'A user with this email address has already been registered');
    try {
      return publicUser(await store.createUser(email, await bcrypt.hash(body.password, BCRYPT_COST), data));
    } catch (err) {
      if (err.code === '23505') throw new AuthError(422, 'email_exists', 'A user with this email address has already been registered');
      throw err;
    }
  });

  app.get('/auth/v1/admin/users/:id', async (req) => {
    requireServiceRole(req);
    const user = UUID_RE.test(req.params.id) ? await store.findUserById(req.params.id) : null;
    if (!user) throw new AuthError(404, 'user_not_found', 'User not found');
    return publicUser(user);
  });

  app.delete('/auth/v1/admin/users/:id', async (req) => {
    requireServiceRole(req);
    if (!UUID_RE.test(req.params.id) || !(await store.deleteUser(req.params.id))) throw new AuthError(404, 'user_not_found', 'User not found');
    return {};
  });

  app.post('/auth/v1/admin/generate_link', async (req) => {
    requireServiceRole(req);
    const body = req.body ?? {};
    if (!['magiclink', 'recovery'].includes(body.type)) throw new AuthError(400, 'validation_failed', 'Type de lien non pris en charge');
    const user = await store.findUserByEmail(checkEmail(body.email));
    if (!usable(user)) throw new AuthError(404, 'user_not_found', 'User with this email not found');
    const token = await store.createOneTimeToken(user.id, body.type);
    const redirect = safeRedirect(body.redirect_to ?? A.siteUrl);
    return {
      ...publicUser(user),
      action_link: `${A.externalUrl}/auth/v1/verify?token=${token}&type=${body.type}&redirect_to=${encodeURIComponent(redirect)}`,
      email_otp: '',
      hashed_token: token,
      redirect_to: redirect,
      verification_type: body.type,
    };
  });
}

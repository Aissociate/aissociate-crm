// JWT HS256, sans dépendance. Seul algorithme accepté : HS256 (pas de "none",
// pas de confusion d'algorithme).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.js';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

function signature(data, secret) {
  return createHmac('sha256', secret).update(data).digest();
}

export function signJwt(claims, secret, expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, ...claims };
  if (expiresInSeconds) payload.exp = now + expiresInSeconds;
  const data = `${HEADER}.${b64url(JSON.stringify(payload))}`;
  return `${data}.${signature(data, secret).toString('base64url')}`;
}

export function verifyJwt(token, secret) {
  const invalid = (msg) => new ApiError(401, 'PGRST301', msg);
  if (typeof token !== 'string') throw invalid('JWT manquant');
  const parts = token.split('.');
  if (parts.length !== 3) throw invalid('JWT mal formé');
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    throw invalid('JWT mal formé');
  }
  if (header?.alg !== 'HS256') throw invalid('Algorithme JWT refusé');
  const expected = signature(`${parts[0]}.${parts[1]}`, secret);
  const given = Buffer.from(parts[2], 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid('Signature JWT invalide');
  if (claims === null || typeof claims !== 'object' || Array.isArray(claims)) throw invalid('JWT mal formé');
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && claims.exp < now) throw invalid('JWT expired');
  if (typeof claims.nbf === 'number' && claims.nbf > now + 30) throw invalid('JWT pas encore valide');
  return claims;
}

const ROLES = new Set(['anon', 'authenticated', 'service_role']);

/** Identité de la requête : jeton Bearer, sinon clé `apikey` (comme Supabase). */
export function authenticate(headers, secret) {
  const auth = headers.authorization;
  const token = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : headers.apikey;
  if (!token) throw new ApiError(401, 'PGRST301', 'Clé API ou jeton manquant');
  const claims = verifyJwt(token, secret);
  if (!ROLES.has(claims.role)) throw new ApiError(401, 'PGRST301', 'Rôle JWT inconnu');
  return { role: claims.role, claims };
}

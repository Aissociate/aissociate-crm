// Limitation de débit en mémoire (une seule instance de l'API) : freine la
// force brute sur les mots de passe et l'envoi d'e-mails en rafale.
import { AuthError } from '../errors.js';

const buckets = new Map();

/** Autorise `max` événements par `windowMs` pour `key`, sinon 429. */
export function rateLimit(key, max, windowMs, now = Date.now()) {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    throw new AuthError(429, 'over_request_rate_limit', 'Trop de tentatives. Réessayez dans quelques minutes.');
  }
  hits.push(now);
  buckets.set(key, hits);
}

export function resetRateLimit(key) {
  buckets.delete(key);
}

// Purge périodique des clés inactives.
setInterval(() => {
  const now = Date.now();
  for (const [k, hits] of buckets) if (!hits.some((t) => now - t < 3_600_000)) buckets.delete(k);
}, 600_000).unref();

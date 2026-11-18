import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.JWT_SECRET ??= 'secret-de-test-suffisamment-long-0123456789';
process.env.AUTHENTICATOR_PASSWORD ??= 'x';
process.env.AUTH_ADMIN_PASSWORD ??= 'x';
const { safeRedirect } = await import('../../src/auth/routes.js');
const { rateLimit, resetRateLimit } = await import('../../src/auth/ratelimit.js');
const { authPool } = await import('../../src/auth/store.js');

test('redirection : seules les origines connues sont acceptées', () => {
  const origins = ['https://aissociate.re', 'https://preprod.aissociate.re'];
  const ok = (u) => safeRedirect(u, origins, 'https://aissociate.re');
  assert.equal(ok('https://aissociate.re/reset-password'), 'https://aissociate.re/reset-password');
  assert.equal(ok('https://preprod.aissociate.re/reset-password?x=1'), 'https://preprod.aissociate.re/reset-password?x=1');
  for (const evil of [
    'https://evil.example/reset', 'https://aissociate.re.evil.example/', 'https://aissociate.re@evil.example/',
    'https://evil.example/?https://aissociate.re', '//evil.example', 'javascript:alert(1)', 'http://aissociate.re/',
    'https://AISSOCIATE.RE.evil.example', 'data:text/html,x', '', undefined, 'https://aissociate.re:8443/',
  ]) assert.equal(ok(evil), 'https://aissociate.re', String(evil));
});

test('limitation de débit', () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) rateLimit('k', 3, 60_000, t0 + i);
  assert.throws(() => rateLimit('k', 3, 60_000, t0 + 10), (e) => e.status === 429);
  rateLimit('k', 3, 60_000, t0 + 61_000); // fenêtre écoulée
  resetRateLimit('k');
  rateLimit('k', 1, 60_000, t0);
});

test.after(() => authPool.end());

import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.JWT_SECRET ??= 'secret-de-test-suffisamment-long-0123456789';
process.env.AUTHENTICATOR_PASSWORD ??= 'x';
process.env.AUTH_ADMIN_PASSWORD ??= 'x';
const { internalTarget } = await import('../../src/net/worker.js');
const { matches } = await import('../../src/realtime/server.js');
const { authPool } = await import('../../src/auth/store.js');

test('net : seules les URL de notre API sont appelées', () => {
  const own = 'https://api.aissociate.re/', internal = 'http://127.0.0.1:3000';
  const t = (u) => internalTarget(u, own, internal);
  assert.equal(t('https://api.aissociate.re/functions/v1/fetch-emails'), 'http://127.0.0.1:3000/functions/v1/fetch-emails');
  assert.equal(t('https://api.aissociate.re/functions/v1/studio?x=1'), 'http://127.0.0.1:3000/functions/v1/studio?x=1');
  for (const bad of ['http://169.254.169.254/latest/meta-data', 'http://aissociate-db:5432/', 'https://evil.example/functions/v1/x', 'https://api.aissociate.re.evil.example/x',
    'https://api.aissociate.re@evil.example/x', 'https://user:pw@api.aissociate.re/x', 'http://api.aissociate.re/x', 'file:///etc/passwd', 'http://127.0.0.1:3000/x', '', 'pas une url']) {
    assert.equal(t(bad), null, bad);
  }
});

test('temps réel : correspondance abonnement / changement', () => {
  const ch = { t: 'notifications', op: 'INSERT', id: 'n1', user_id: 'u1' };
  assert.ok(matches({ schema: 'public', table: 'notifications', event: '*' }, ch));
  assert.ok(matches({ schema: 'public', table: 'notifications', event: 'INSERT', filter: 'user_id=eq.u1' }, ch));
  assert.ok(!matches({ schema: 'public', table: 'notifications', event: '*', filter: 'user_id=eq.u2' }, ch));
  assert.ok(!matches({ schema: 'public', table: 'notifications', event: 'DELETE' }, ch));
  assert.ok(!matches({ schema: 'public', table: 'emails', event: '*' }, ch));
  assert.ok(!matches({ schema: 'auth', table: 'notifications', event: '*' }, ch));
});

test.after(() => authPool.end());

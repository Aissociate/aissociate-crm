// Test de bout en bout des fonctions serveur et du temps réel, avec supabase-js,
// à travers l'URL publique de l'API (comme le fera le navigateur).
//   API_URL (https://api.aissociate.re), JWT_SECRET
// N'appelle que des fonctions sans effet extérieur (pas d'e-mail, pas d'IA payante).
import { createClient } from '@supabase/supabase-js';
import { signJwt } from '../../src/jwt.js';

const { API_URL, JWT_SECRET } = process.env;
const anonKey = signJwt({ role: 'anon' }, JWT_SECRET, 3600);
const serviceKey = signJwt({ role: 'service_role' }, JWT_SECRET, 3600);
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const mk = (key = anonKey) => createClient(API_URL, key, opts);
const admin = mk(serviceKey);

let pass = 0;
const fails = [];
const check = (name, cond, detail = '') => { if (cond) pass++; else fails.push(`${name} ${detail ?? ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fn = (path, init = {}) => fetch(`${API_URL}/functions/v1/${path}`, init);

const stamp = Date.now();
const a = mk(), b = mk();
for (const who of ['a', 'b']) await admin.auth.admin.createUser({ email: `e2e-rt-${who}-${stamp}@example.invalid`, password: 'mot-de-passe-e2e', email_confirm: true });
const ua = await a.auth.signInWithPassword({ email: `e2e-rt-a-${stamp}@example.invalid`, password: 'mot-de-passe-e2e' });
const ub = await b.auth.signInWithPassword({ email: `e2e-rt-b-${stamp}@example.invalid`, password: 'mot-de-passe-e2e' });
check('comptes de test', Boolean(ua.data.session && ub.data.session), ua.error?.message ?? ub.error?.message);
const idA = ua.data.user.id, idB = ub.data.user.id;

// ── Fonctions ──
const sm = await fn('sitemap-blog');
const xml = await sm.text();
check('fonction publique (sitemap du blog)', sm.status === 200 && xml.includes('<urlset') && (xml.match(/<loc>/g) ?? []).length >= 50, `${sm.status} ${xml.slice(0, 80)}`);
check('fonction protégée : jeton exigé', (await fn('admin-users', { method: 'POST' })).status === 401);
check('fonction protégée : jeton falsifié refusé', (await fn('admin-users', { method: 'POST', headers: { authorization: `Bearer ${signJwt({ role: 'service_role' }, 'un-autre-secret-0123456789abcdef', 60)}` } })).status === 401);
check('fonction inconnue', (await fn('nexiste-pas', { headers: { authorization: `Bearer ${anonKey}` } })).status === 404);
const pre = await fn('chatbot', { method: 'OPTIONS', headers: { origin: 'https://aissociate.re', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, content-type' } });
check('pré-requête CORS relayée à la fonction', pre.status < 300 && pre.headers.get('access-control-allow-origin') === '*', String(pre.status));

// La fonction relit l'identité de l'appelant par l'API (auth.getUser) puis son rôle en base.
const viaJs = await a.functions.invoke('admin-users', { body: { action: 'delete', user_id: idB } });
const refus = viaJs.error ? await viaJs.error.context?.json?.().catch(() => null) : null;
check('fonction appelée par supabase-js : conseiller refusé (403)', viaJs.error?.context?.status === 403, JSON.stringify(refus ?? viaJs.data));
check('le compte visé existe toujours', !(await admin.auth.admin.getUserById(idB)).error);
const un = await fn('newsletter-unsubscribe?token=jeton-invalide');
check('fonction publique avec paramètre d\'URL', un.status < 500, String(un.status));
const big = await fn('admin-users', { method: 'POST', headers: { authorization: `Bearer ${ua.data.session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'x', remplissage: 'a'.repeat(200_000) }) });
check('corps volumineux relayé', big.status === 403 || big.status === 400, String(big.status));

// ── Temps réel ──
const got = { a: 0, b: 0, anon: 0, tickets: 0 };
const sub = (client, name, cfg, key) => new Promise((resolve) => {
  client.channel(name).on('postgres_changes', cfg, () => { got[key]++; }).subscribe((status) => { if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(status); });
});
const anonClient = mk();
const st = await Promise.all([
  sub(a, 'notifs-a', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${idA}` }, 'a'),
  sub(b, 'notifs-b', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${idB}` }, 'b'),
  sub(anonClient, 'notifs-anon', { event: '*', schema: 'public', table: 'notifications' }, 'anon'),
  sub(a, 'rt-tickets', { event: '*', schema: 'public', table: 'tickets' }, 'tickets'),
]);
check('abonnements temps réel acceptés', st.every((s) => s === 'SUBSCRIBED'), st.join(','));

const ins = await admin.from('notifications').insert({ user_id: idA, type: 'e2e', titre: 'Test temps réel', corps: 'x' }).select('id').single();
check('notification de test créée', !ins.error, ins.error?.message);
await wait(1500);
check('le destinataire est prévenu', got.a === 1, `reçu ${got.a}`);
check('un autre utilisateur n\'est pas prévenu', got.b === 0, `reçu ${got.b}`);
check('un visiteur anonyme n\'est pas prévenu', got.anon === 0, `reçu ${got.anon}`);
check('aucun signal sur une autre table', got.tickets === 0);
await admin.from('notifications').update({ lu: true }).eq('id', ins.data.id);
await admin.from('notifications').delete().eq('id', ins.data.id);
await wait(1500);
check('modification et suppression signalées', got.a === 3, `reçu ${got.a}`);
await a.removeAllChannels(); await b.removeAllChannels(); await anonClient.removeAllChannels();
const noKey = await new Promise((resolve) => {
  const ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=faux&vsn=1.0.0`);
  ws.onopen = () => { ws.close(); resolve('ouvert'); };
  ws.onerror = () => resolve('refusé');
});
check('temps réel refusé sans clé valide', noKey === 'refusé', noKey);

await admin.auth.admin.deleteUser(idA);
await admin.auth.admin.deleteUser(idB);
console.log(`\n${pass} vérifications réussies, ${fails.length} échecs`);
for (const f of fails) console.log(`✗ ${f}`);
process.exit(fails.length ? 1 : 0);

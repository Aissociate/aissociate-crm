// Test de bout en bout de l'authentification avec la vraie bibliothèque
// supabase-js (même version que l'application), contre l'API maison.
//   API_URL, JWT_SECRET, SEEDED_EMAIL, SEEDED_PASSWORD (compte créé en base avec un hachage $2a$)
import { createClient } from '@supabase/supabase-js';
import { signJwt } from '../../src/jwt.js';

const { API_URL, JWT_SECRET, SEEDED_EMAIL, SEEDED_PASSWORD } = process.env;
const anonKey = signJwt({ role: 'anon' }, JWT_SECRET, 3600);
const serviceKey = signJwt({ role: 'service_role' }, JWT_SECRET, 3600);
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const client = (key = anonKey) => createClient(API_URL, key, opts);
const admin = client(serviceKey);

let pass = 0;
const fails = [];
const check = (name, cond, detail = '') => { if (cond) pass++; else fails.push(`${name} ${detail}`); };
const raw = (path, init = {}) => fetch(`${API_URL}${path}`, { redirect: 'manual', ...init, headers: { apikey: anonKey, 'content-type': 'application/json', ...init.headers } });

const stamp = Date.now();
const email = `e2e-${stamp}@example.invalid`;
const a = client();

// Inscription publique fermée : seul un appel avec la clé de service crée un compte.
const refuse = await client().auth.signUp({ email, password: 'premier-mdp' });
check('inscription publique refusée', Boolean(refuse.error) && !refuse.data.session, refuse.error?.message);
check('compte non créé par une inscription publique', Boolean((await a.auth.signInWithPassword({ email, password: 'premier-mdp' })).error));
check('création de compte refusée sans clé de service', Boolean((await client().auth.admin.createUser({ email, password: 'premier-mdp' })).error));
// Le rôle demandé dans les métadonnées ne doit donner aucun droit.
const created = await admin.auth.admin.createUser({ email, password: 'premier-mdp', email_confirm: true, user_metadata: { nom: 'E2E', prenom: 'Test', role: 'admin' } });
check('création de compte par la clé de service', !created.error && created.data.user?.email === email, created.error?.message);
const up = await a.auth.signInWithPassword({ email, password: 'premier-mdp' });
check('première connexion', !up.error && up.data.session?.access_token, up.error?.message);
const uid = up.data.user?.id;
const prof = await a.from('profiles').select('role, approved').eq('id', uid).single();
check('profil créé en conseiller', prof.data?.role === 'conseiller', JSON.stringify(prof.data ?? prof.error));
const promo = await a.from('profiles').update({ role: 'admin' }).eq('id', uid).select();
check('auto-promotion refusée', Boolean(promo.error), JSON.stringify(promo.data));
const me = await a.auth.getUser();
check('getUser', me.data.user?.id === uid, me.error?.message);
const contacts = await a.from('contacts').select('id', { count: 'exact', head: true });
check('RLS appliquée au nouveau compte', !contacts.error, contacts.error?.message);

check('compte en double refusé', Boolean((await admin.auth.admin.createUser({ email, password: 'autre-mdp-123' })).error));
check('mot de passe trop court refusé', Boolean((await admin.auth.admin.createUser({ email: `x-${stamp}@example.invalid`, password: '123' })).error));

// Changement de mot de passe, puis connexion.
check('changement de mot de passe', !(await a.auth.updateUser({ password: 'second-mdp-456' })).error);
const b = client();
check('ancien mot de passe refusé', (await b.auth.signInWithPassword({ email, password: 'premier-mdp' })).error?.message === 'Invalid login credentials');
const inB = await b.auth.signInWithPassword({ email, password: 'second-mdp-456' });
check('connexion', !inB.error && inB.data.session?.user?.id === uid, inB.error?.message);
check('e-mail inconnu : même erreur', (await client().auth.signInWithPassword({ email: `nul-${stamp}@example.invalid`, password: 'x' })).error?.message === 'Invalid login credentials');

// Rotation du jeton de rafraîchissement et détection de rejeu.
const oldRefresh = inB.data.session.refresh_token;
const ref = await b.auth.refreshSession();
check('rafraîchissement', !ref.error && ref.data.session?.refresh_token && ref.data.session.refresh_token !== oldRefresh, ref.error?.message);
check('jeton invalide refusé', (await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: 'nimporte-quoi' }) })).status === 400);
await new Promise((r) => setTimeout(r, 11_500));
const replay = await raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: oldRefresh }) });
check('rejeu d\'un ancien jeton refusé', replay.status === 400, String(replay.status));
check('rejeu : la session volée est fermée', Boolean((await b.auth.getUser()).error));

// Déconnexion : le jeton d'accès ne permet plus de lire le compte.
const tokenA = (await a.auth.getSession()).data.session?.access_token ?? up.data.session.access_token;
check('déconnexion', !(await a.auth.signOut()).error);
check('session fermée après déconnexion', (await raw('/auth/v1/user', { headers: { authorization: `Bearer ${tokenA}` } })).status === 403);

// Opérations d'administration (fonctions serveur).
check('admin refusé sans clé service', (await client().auth.admin.getUserById(uid)).error != null);
const got = await admin.auth.admin.getUserById(uid);
check('admin.getUserById', got.data.user?.email === email, got.error?.message);
const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
const hash = link.data?.properties?.hashed_token;
check('admin.generateLink', Boolean(hash), link.error?.message);
const otp = await client().auth.verifyOtp({ type: 'magiclink', token_hash: hash });
check('verifyOtp ouvre la session du bon compte', otp.data.session?.user?.id === uid, otp.error?.message);
check('lien à usage unique', Boolean((await client().auth.verifyOtp({ type: 'magiclink', token_hash: hash })).error));
check('admin.signOut', !(await admin.auth.admin.signOut(otp.data.session.access_token, 'local')).error);
const viaRest = await raw('/rest/v1/profiles?select=id&id=eq.' + uid, { headers: { authorization: `Bearer ${otp.data.session.access_token}` } });
check('jeton d\'accès encore valable pour les données', viaRest.status === 200 && (await viaRest.json()).length === 1);

// Lien de réinitialisation : redirection uniquement vers le site, usage unique.
const rec = await admin.auth.admin.generateLink({ type: 'recovery', email });
const recToken = rec.data?.properties?.hashed_token;
const evil = await raw(`/auth/v1/verify?token=${recToken}&type=recovery&redirect_to=${encodeURIComponent('https://evil.example/vol')}`);
const loc = evil.headers.get('location') ?? '';
check('lien de réinitialisation : redirection', evil.status === 303 && loc.includes('access_token=') && loc.includes('type=recovery'), `${evil.status}`);
check('redirection vers un site tiers refusée', loc.startsWith('https://aissociate.re/') && !loc.includes('evil.example'), loc.slice(0, 60));
const again = await raw(`/auth/v1/verify?token=${recToken}&type=recovery&redirect_to=${encodeURIComponent('https://aissociate.re/reset-password')}`);
check('lien de réinitialisation à usage unique', (again.headers.get('location') ?? '').includes('error_code=otp_expired'));
check('réinitialisation : adresse inconnue, même réponse', !(await client().auth.resetPasswordForEmail(`nul-${stamp}@example.invalid`, { redirectTo: 'https://aissociate.re/reset-password' })).error);

// Compte existant migré de Supabase (hachage bcrypt $2a$).
const seeded = await client().auth.signInWithPassword({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD });
check('mot de passe Supabase ($2a$) accepté', !seeded.error && seeded.data.user?.email === SEEDED_EMAIL, seeded.error?.message);

// Jetons falsifiés.
const forged = signJwt({ role: 'service_role' }, 'un-autre-secret-que-celui-du-serveur', 600);
check('jeton falsifié refusé (données)', (await raw('/rest/v1/contacts?select=id&limit=1', { headers: { apikey: forged, authorization: `Bearer ${forged}` } })).status === 401);
check('jeton falsifié refusé (admin)', (await raw(`/auth/v1/admin/users/${uid}`, { headers: { authorization: `Bearer ${forged}` } })).status === 403);
check('auth sans clé API refusée', (await fetch(`${API_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'x' }) })).status === 401);

// Force brute : blocage après une série d'échecs.
let blocked = false;
for (let i = 0; i < 12 && !blocked; i++) {
  const r = await raw('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password: `faux-${i}` }) });
  blocked = r.status === 429;
}
check('force brute bloquée (429)', blocked);

// Nettoyage.
check('admin.deleteUser', !(await admin.auth.admin.deleteUser(uid)).error);
check('compte supprimé', Boolean((await admin.auth.admin.getUserById(uid)).error));
check('profil supprimé avec le compte', ((await admin.from('profiles').select('id').eq('id', uid)).data ?? [1]).length === 0);

console.log(`\n${pass} vérifications réussies, ${fails.length} échecs`);
for (const f of fails) console.log(`✗ ${f}`);
process.exit(fails.length ? 1 : 0);

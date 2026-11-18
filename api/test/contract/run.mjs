// Tests différentiels : la même requête est envoyée à notre API et à PostgREST
// (le moteur de Supabase, lancé ici uniquement comme référence), sur la même
// base, pour chaque identité. Statut, corps et Content-Range doivent coïncider.
//   API_URL, REF_URL, JWT_SECRET, ADMIN_ID
import { signJwt } from '../../src/jwt.js';

const { API_URL, REF_URL, JWT_SECRET, ADMIN_ID } = process.env;
const ZERO = '00000000-0000-0000-0000-000000000000';
const tokens = {
  anon: signJwt({ role: 'anon' }, JWT_SECRET, 600),
  admin: signJwt({ role: 'authenticated', sub: ADMIN_ID }, JWT_SECRET, 600),
  inconnu: signJwt({ role: 'authenticated', sub: ZERO }, JWT_SECRET, 600),
  service: signJwt({ role: 'service_role' }, JWT_SECRET, 600),
};
const ALL = ['anon', 'admin', 'inconnu', 'service'];
const OBJ = { accept: 'application/vnd.pgrst.object+json' };
const REP = { prefer: 'return=representation' };
const COUNT = { prefer: 'count=exact' };
const like = encodeURIComponent('%an%');

const reads = [
  ['liste triée', 'contacts?select=id,nom,prenom&order=nom.asc,id.asc&limit=20'],
  ['étoile', 'contacts?select=*&order=id.asc&limit=5'],
  ['or ilike', `contacts?select=id&or=(nom.ilike.${like},prenom.ilike.${like},email.ilike.${like})&order=id&limit=50`],
  ['or is.null / not.in', `contacts?select=id,owner_id&or=(owner_id.is.null,owner_id.not.in.(${ADMIN_ID}))&order=id&limit=10`],
  ['or and imbriqué', 'contact_actions?select=id,type,faite&or=(faite.eq.false,and(type.eq.rdv,faite.eq.true))&order=id&limit=20'],
  ['relation à-un', 'contact_actions?select=id,contact_id,date_action,heure_action,type,description,faite,contacts(nom,prenom)&order=date_action.desc,id&limit=30'],
  ['relation à-un + filtre', 'contact_actions?select=id,contacts(owner_id)&faite=eq.false&order=id&limit=20'],
  ['intervalle + count', 'contact_actions?select=id&date_action=gte.2026-01-01&date_action=lte.2026-12-31&order=id&limit=10', COUNT],
  ['étoile + relation étoile', 'blog_articles?select=*,blog_categories(*)&published=eq.true&order=published_at.desc,id&limit=5'],
  ['alias de relation', 'blog_articles?select=slug,cat:blog_categories(name)&order=slug&limit=5'],
  ['relation à-plusieurs', 'blog_categories?select=*,blog_articles(id,slug)&order=name'],
  ['!inner + filtre relation', 'blog_categories?select=name,blog_articles!inner(id)&blog_articles.published=eq.true&order=name'],
  ['!inner à-un', 'studio_users?select=id,email,studio_workspaces!inner(id)&order=id'],
  ['objet unique : 0 ligne', 'blog_articles?select=id,slug,title&slug=eq.__absent__', OBJ],
  ['objet unique : 1 ligne', 'blog_articles?select=slug&order=slug&limit=1', OBJ],
  ['objet unique : plusieurs', 'blog_categories?select=name', OBJ],
  ['in', 'parametres?select=cle,valeur&cle=in.(smtp,"a,b",societe)&order=cle'],
  ['in vide', 'parametres?select=cle&cle=in.()'],
  ['jsonb', 'parametres?select=*&order=cle'],
  ['chemin json', 'ai_actions?select=id,outil,args->>type,statut&order=id'],
  ['filtre chemin json', 'ai_actions?select=id&args->>type=eq.note&order=id'],
  ['alias + cast', 'contacts?select=ident:id,n:nom,d:created_at::date&order=id&limit=3'],
  ['profils', 'profiles?select=id,email,role&order=email'],
  ['booléen is', 'profiles?select=id&role=eq.admin&actif=is.true&order=id'],
  ['not.is.null + like', 'contacts?select=id&nom=not.is.null&email=like.*@*&order=id&limit=5'],
  ['neq gt lt', 'blog_articles?select=slug,read_time&read_time=gt.3&read_time=lt.30&author=neq.x&order=slug&limit=5'],
  ['tri nulls', 'blog_articles?select=slug,linkedin_shared_at&order=linkedin_shared_at.desc.nullslast,slug&limit=5'],
  ['count + page', 'notifications?select=*&lu=eq.false&order=created_at.desc,id&limit=10', COUNT],
  ['HEAD count', 'notifications?select=id', COUNT, 'HEAD'],
  ['HEAD count filtré', 'contacts?select=id&nom=ilike.*a*', COUNT, 'HEAD'],
  ['offset hors limite + count', 'contacts?select=id&order=id&limit=5&offset=100000', COUNT],
  ['plafond 1000 lignes', 'contacts?select=id&order=id', COUNT],
  ['vue', 'studio_usage_mois?select=*&limit=5'],
  ['recherche plein texte', 'contacts?select=id&nom=plfts.martin&order=id&limit=5'],
  ['recherche websearch', 'blog_articles?select=slug&title=wfts(french).intelligence&order=slug&limit=5'],
  ['erreur : table inconnue', 'table_inexistante?select=*'],
  ['erreur : colonne inconnue (select)', 'contacts?select=colonne_x'],
  ['erreur : colonne inconnue (filtre)', 'contacts?select=id&colonne_x=eq.1'],
  ['erreur : uuid invalide', 'contacts?select=id&id=eq.pas-un-uuid'],
  ['erreur : relation inconnue', 'contact_actions?select=id,parametres(cle)'],
  ['erreur : opérateur inconnu', 'contacts?select=id&nom=bizarre.1'],
];

const rpcs = [
  ['rpc booléen', 'is_manager', {}],
  ['rpc is_admin', 'is_admin', {}],
  ['rpc table', 'contacts_doublons', {}],
  ['rpc table + args', 'studio_recherche_docs', { p_workspace: ZERO, p_question: 'test' }],
  ['rpc inconnue', 'fonction_inexistante', {}],
  ['rpc argument inconnu', 'is_manager', { x: 1 }],
];

// Écritures : chaque moteur travaille sur ses propres lignes ({E} = api | ref).
const writes = [
  ['insert representation', 'POST', 'parametres?select=cle,valeur,description', [{ cle: '__t_{E}_1', valeur: { a: 1, b: ['x'] }, description: 'test' }], REP, ['service', 'admin', 'anon', 'inconnu']],
  ['insert doublon', 'POST', 'parametres', { cle: '__t_{E}_1', valeur: 2 }, REP, ['service']],
  ['upsert merge', 'POST', 'parametres?on_conflict=cle&select=cle,valeur', [{ cle: '__t_{E}_1', valeur: { a: 2 } }, { cle: '__t_{E}_2', valeur: null }], { prefer: 'return=representation,resolution=merge-duplicates' }, ['service']],
  ['upsert ignore', 'POST', 'parametres?on_conflict=cle&select=cle', { cle: '__t_{E}_1', valeur: 9 }, { prefer: 'return=representation,resolution=ignore-duplicates' }, ['service']],
  ['insert minimal', 'POST', 'parametres', { cle: '__t_{E}_3', valeur: 3 }, {}, ['service']],
  ['insert colonne inconnue', 'POST', 'parametres', { cle: '__t_{E}_4', pas_une_colonne: 1 }, REP, ['service']],
  ['update representation + count', 'PATCH', 'parametres?cle=eq.__t_{E}_1&select=cle,description', { description: 'modifié' }, { prefer: 'return=representation,count=exact' }, ['service', 'anon', 'inconnu']],
  ['update objet unique : 0 ligne', 'PATCH', 'parametres?cle=eq.__absent__&select=cle', { description: 'x' }, { ...REP, ...OBJ }, ['service']],
  ['update objet unique : 1 ligne', 'PATCH', 'parametres?cle=eq.__t_{E}_2&select=cle,description', { description: 'un' }, { ...REP, ...OBJ }, ['service']],
  ['update minimal', 'PATCH', 'parametres?cle=in.(__t_{E}_2,__t_{E}_3)', { description: 'deux' }, {}, ['service']],
  ['update type invalide', 'PATCH', 'parametres?cle=eq.__t_{E}_1', { updated_at: 'pas une date' }, REP, ['service']],
  ['delete representation', 'DELETE', 'parametres?cle=eq.__t_{E}_3&select=cle', undefined, REP, ['anon', 'service']],
  ['delete minimal', 'DELETE', 'parametres?cle=like.__t_{E}_*', undefined, {}, ['service']],
  ['anon : formulaire de contact (minimal)', 'POST', 'contact_requests', { first_name: 'Test', last_name: '{E}', email: 'test-{E}@example.invalid', message: '__test_contrat_{E}__' }, {}, ['anon']],
  ['anon : formulaire de contact (representation)', 'POST', 'contact_requests', { first_name: 'Test', last_name: '{E}', email: 'test-{E}@example.invalid', message: '__test_contrat_{E}__' }, REP, ['anon']],
  ['nettoyage formulaire', 'DELETE', 'contact_requests?message=eq.__test_contrat_{E}__&select=message', undefined, REP, ['service']],
];

const canon = (v) => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;

async function call(engine, role, method, path, headers, body) {
  const base = engine === 'api' ? `${API_URL}/rest/v1/` : `${REF_URL}/`;
  const res = await fetch(base + path.replaceAll('{E}', TAG[engine]), {
    method,
    headers: { apikey: tokens.anon, authorization: `Bearer ${tokens[role]}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body).replaceAll('{E}', TAG[engine]) : undefined,
  });
  const text = method === 'HEAD' ? '' : await res.text();
  let json = null;
  try { json = text ? JSON.parse(text.replaceAll(TAG[engine], 'E')) : null; } catch { json = text; }
  const ok = res.status < 300;
  return {
    status: res.status === 206 ? 200 : res.status,
    // Erreurs : on compare le code, pas le libellé (les nôtres sont parfois en français).
    // Erreurs : on compare le code, pas le libellé. L'ordre des clés d'un objet JSON
    // n'a pas de sens : il est normalisé. 416 : la référence renvoie un corps vide
    // (la prod Supabase renvoie PGRST103, comme notre API) → statut seul.
    body: ok ? canon(json) : { code: res.status === 416 ? 'PGRST103' : json?.code ?? null },
    range: ok ? res.headers.get('content-range') : null,
  };
}

const TAG = { api: 'zqapi', ref: 'zqref' };
const strip = (v) => JSON.stringify(v, (k, x) => (['id', 'created_at', 'updated_at'].includes(k) && typeof x === 'string' ? '~' : x));
let pass = 0;
const fails = [];
async function compare(name, role, method, path, headers = {}, body, { volatile = false } = {}) {
  const [a, r] = [await call('api', role, method, path, headers, body), await call('ref', role, method, path, headers, body)];
  const norm = (x) => (volatile ? strip(x) : JSON.stringify(x));
  if (norm(a) === norm(r)) { pass++; return; }
  const [x, y] = [norm(a), norm(r)];
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  const from = Math.max(0, i - 120);
  fails.push({ name, role, path, api: x.slice(from, i + 200), ref: y.slice(from, i + 200) });
}

for (const [name, path, headers, method = 'GET'] of reads) for (const role of ALL) await compare(name, role, method, path, headers);
for (const [name, fn, args] of rpcs) for (const role of ALL) await compare(name, role, 'POST', `rpc/${fn}`, {}, args);
for (const [name, method, path, body, headers, roles] of writes) for (const role of roles) await compare(name, role, method, path, headers, body, { volatile: true });

// Garde-fou propre à notre API (PostgREST seul n'a pas pg-safeupdate) : jamais sur la référence.
for (const [method, body] of [['PATCH', { description: 'x' }], ['DELETE', undefined]]) {
  const a = await call('api', 'service', method, 'parametres', REP, body);
  if (a.status === 400 && a.body.code === '21000') pass++;
  else fails.push({ name: `${method} sans filtre refusé`, role: 'service', path: 'parametres', api: JSON.stringify(a), ref: 'attendu 400 / 21000' });
}

console.log(`\n${pass} identiques, ${fails.length} écarts`);
for (const f of fails) console.log(`\n✗ ${f.name} [${f.role}] ${f.path}\n   api: ${f.api}\n   ref: ${f.ref}`);
process.exit(fails.length ? 1 : 0);

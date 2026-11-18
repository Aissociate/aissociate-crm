// Test de bout en bout du stockage avec supabase-js (même version que l'application).
//   API_URL, JWT_SECRET ; le bucket « e2e-limit » (10 octets max) est créé par le lanceur.
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { signJwt } from '../../src/jwt.js';

const { API_URL, JWT_SECRET } = process.env;
const anonKey = signJwt({ role: 'anon' }, JWT_SECRET, 3600);
const serviceKey = signJwt({ role: 'service_role' }, JWT_SECRET, 3600);
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const anon = createClient(API_URL, anonKey, opts);
const admin = createClient(API_URL, serviceKey, opts);
const user = createClient(API_URL, anonKey, opts);

let pass = 0;
const fails = [];
const check = (name, cond, detail = '') => { if (cond) pass++; else fails.push(`${name} ${detail ?? ''}`); };
const sha = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');
const raw = (path, init = {}) => fetch(`${API_URL}/storage/v1${path}`, init);

const stamp = Date.now();
const dir = `e2e/${stamp}`;
const up = await user.auth.signUp({ email: `e2e-st-${stamp}@example.invalid`, password: 'mot-de-passe-e2e' });
check('compte de test (conseiller)', Boolean(up.data.session), up.error?.message);

// Envoi : formulaire (navigateur) et corps brut (fonctions serveur).
const texte = new Blob(['bonjour le stockage'], { type: 'text/plain' });
const a = await user.storage.from('documents').upload(`${dir}/a.txt`, texte, { cacheControl: '3600' });
check('envoi par formulaire', !a.error && a.data?.path === `${dir}/a.txt`, a.error?.message);
const octets = randomBytes(300_000);
const b = await user.storage.from('documents').upload(`${dir}/b.bin`, new Uint8Array(octets), { contentType: 'application/pdf' });
check('envoi en corps brut', !b.error, b.error?.message);
check('doublon refusé sans upsert', Boolean((await user.storage.from('documents').upload(`${dir}/a.txt`, texte)).error));
const a2 = await user.storage.from('documents').upload(`${dir}/a.txt`, new Blob(['version 2'], { type: 'text/plain' }), { upsert: true });
check('remplacement avec upsert', !a2.error, a2.error?.message);

// Lecture.
const dlA = await user.storage.from('documents').download(`${dir}/a.txt`);
check('téléchargement : contenu remplacé', !dlA.error && (await dlA.data.text()) === 'version 2', dlA.error?.message);
const dlB = await user.storage.from('documents').download(`${dir}/b.bin`);
check('téléchargement : octets identiques', !dlB.error && sha(await dlB.data.arrayBuffer()) === sha(octets));
check('anonyme : envoi refusé', Boolean((await anon.storage.from('documents').upload(`${dir}/anon.txt`, texte)).error));
check('anonyme : téléchargement privé refusé', Boolean((await anon.storage.from('documents').download(`${dir}/a.txt`)).error));
check('fichier absent', Boolean((await user.storage.from('documents').download(`${dir}/absent.txt`)).error));
check('bucket inconnu', Boolean((await user.storage.from('nexistepas').upload('x.txt', texte)).error));

// Policies : « recrutement » est réservé aux managers.
check('policy : bucket réservé refusé au conseiller', Boolean((await user.storage.from('recrutement').upload(`${dir}/cv.txt`, texte)).error));
const cvAdmin = await admin.storage.from('recrutement').upload(`${dir}/cv.txt`, texte);
check('service : envoi dans le bucket réservé', !cvAdmin.error, cvAdmin.error?.message);
check('policy : lecture du bucket réservé refusée', Boolean((await user.storage.from('recrutement').download(`${dir}/cv.txt`)).error));
check('policy : lien signé du bucket réservé refusé', Boolean((await user.storage.from('recrutement').createSignedUrl(`${dir}/cv.txt`, 60)).error));
const rmDenied = await user.storage.from('recrutement').remove([`${dir}/cv.txt`]);
check('policy : suppression du bucket réservé sans effet', (rmDenied.data ?? []).length === 0 && !(await admin.storage.from('recrutement').download(`${dir}/cv.txt`)).error);

// Lien public : bucket public seulement.
const pub = await fetch(user.storage.from('documents').getPublicUrl(`${dir}/a.txt`).data.publicUrl);
check('lien public (bucket public)', pub.status === 200 && (await pub.text()) === 'version 2' && pub.headers.get('content-type')?.startsWith('text/plain'));
check('fichier servi sans exécution possible', pub.headers.get('x-content-type-options') === 'nosniff' && (pub.headers.get('content-security-policy') ?? '').includes('sandbox'));
const prive = await user.storage.from('devis').upload(`${dir}/prive.pdf`, new Uint8Array(octets.subarray(0, 5000)), { contentType: 'application/pdf' });
check('envoi dans un bucket privé', !prive.error, prive.error?.message);
check('lien public refusé (bucket privé)', (await fetch(user.storage.from('devis').getPublicUrl(`${dir}/prive.pdf`).data.publicUrl)).status === 404);

// Liens signés.
const signed = await user.storage.from('devis').createSignedUrl(`${dir}/prive.pdf`, 60);
const sUrl = signed.data?.signedUrl ?? '';
const viaSigned = sUrl ? await fetch(sUrl) : { status: 0 };
check('lien signé', viaSigned.status === 200 && sha(await viaSigned.arrayBuffer()) === sha(octets.subarray(0, 5000)), signed.error?.message);
check('lien signé : autre fichier refusé', (await fetch(sUrl.replace('prive.pdf', 'autre.pdf'))).status === 400);
check('lien signé : autre bucket refusé', (await fetch(sUrl.replace('/devis/', '/recrutement/').replace('prive.pdf', 'cv.txt'))).status === 400);
check('lien signé : jeton falsifié refusé', (await fetch(sUrl.slice(0, -4) + 'AAAA')).status === 400);
const dlName = await user.storage.from('devis').createSignedUrl(`${dir}/prive.pdf`, 60, { download: 'Devis client.pdf' });
check('lien signé : téléchargement nommé', ((await fetch(dlName.data?.signedUrl ?? '')).headers.get('content-disposition') ?? '').includes('attachment'));
const court = await user.storage.from('devis').createSignedUrl(`${dir}/prive.pdf`, 1);
await new Promise((r) => setTimeout(r, 2500));
check('lien signé : expiré refusé', (await fetch(court.data?.signedUrl ?? '')).status === 400);
const tokenOnly = new URL(sUrl).searchParams.get('token');
check('jeton de lien signé inutilisable comme identité', (await fetch(`${API_URL}/rest/v1/contacts?select=id&limit=1`, { headers: { apikey: tokenOnly, authorization: `Bearer ${tokenOnly}` } })).status === 401);

// Lecture partielle (vidéo).
const part = await raw(`/object/public/documents/${dir}/b.bin`, { headers: { range: 'bytes=10-19' } });
check('plage d\'octets', part.status === 206 && sha(await part.arrayBuffer()) === sha(octets.subarray(10, 20)) && part.headers.get('content-range') === 'bytes 10-19/300000');

// Copie entre buckets.
const cp = await user.storage.from('documents').copy(`${dir}/a.txt`, `${dir}/copie.txt`, { destinationBucket: 'devis' });
check('copie vers un autre bucket', !cp.error, cp.error?.message);
const dlCp = await user.storage.from('devis').download(`${dir}/copie.txt`);
check('copie : contenu identique', !dlCp.error && (await dlCp.data.text()) === 'version 2');
check('copie vers un bucket réservé refusée', Boolean((await user.storage.from('documents').copy(`${dir}/a.txt`, `${dir}/vol.txt`, { destinationBucket: 'recrutement' })).error));
check('copie depuis un bucket réservé refusée', Boolean((await user.storage.from('recrutement').copy(`${dir}/cv.txt`, `${dir}/vol.txt`, { destinationBucket: 'documents' })).error));

// Noms hostiles.
const auth = { apikey: anonKey, authorization: `Bearer ${up.data.session.access_token}`, 'content-type': 'text/plain' };
for (const bad of ['..%2F..%2Fetc%2Fpasswd', 'a%2F..%2F..%2Fb.txt', '%2Fabs.txt', 'a%00b.txt', 'a%5Cb.txt', '.tmp%2F..%2Fx']) {
  const r = await raw(`/object/documents/${bad}`, { method: 'POST', headers: auth, body: 'x' });
  check(`nom hostile refusé (${bad})`, r.status === 400 || r.status === 404, String(r.status));
}

// Taille maximale du bucket.
check('taille : 10 octets acceptés', !(await admin.storage.from('e2e-limit').upload(`${dir}/ok.txt`, new Uint8Array(10))).error);
check('taille : 11 octets refusés (corps brut)', Boolean((await admin.storage.from('e2e-limit').upload(`${dir}/trop.txt`, new Uint8Array(11))).error));
check('taille : 11 octets refusés (formulaire)', Boolean((await admin.storage.from('e2e-limit').upload(`${dir}/trop2.txt`, new Blob([new Uint8Array(11)]))).error));
check('taille : aucun objet créé après refus', Boolean((await admin.storage.from('e2e-limit').download(`${dir}/trop.txt`)).error));

// Suppression.
const rm = await user.storage.from('documents').remove([`${dir}/a.txt`, `${dir}/b.bin`, `${dir}/absent.txt`]);
check('suppression', !rm.error && rm.data?.length === 2, rm.error?.message);
check('supprimé : téléchargement refusé', Boolean((await user.storage.from('documents').download(`${dir}/a.txt`)).error));
check('supprimé : lien public 404', (await fetch(user.storage.from('documents').getPublicUrl(`${dir}/a.txt`).data.publicUrl)).status === 404);

// Nettoyage.
await admin.storage.from('devis').remove([`${dir}/prive.pdf`, `${dir}/copie.txt`]);
await admin.storage.from('recrutement').remove([`${dir}/cv.txt`]);
await admin.storage.from('e2e-limit').remove([`${dir}/ok.txt`]);
await admin.auth.admin.deleteUser(up.data.user.id);

console.log(`\n${pass} vérifications réussies, ${fails.length} échecs`);
for (const f of fails) console.log(`✗ ${f}`);
process.exit(fails.length ? 1 : 0);

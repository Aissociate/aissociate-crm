// Copie les fichiers du stockage Supabase vers le volume local, d'après les
// lignes de storage.objects déjà copiées en base. Rejouable : un fichier déjà
// présent avec la bonne taille est ignoré.
//   SUPABASE_URL                 https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    facultatif : sans elle, seuls les buckets publics sont copiés
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { withIdentity, pool } from '../src/db.js';
import { commitTemp, discard, objectPath, writeTemp } from '../src/storage/files.js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!SUPABASE_URL) { console.error('SUPABASE_URL manquant'); process.exit(2); }
const SERVICE = { role: 'service_role', claims: { role: 'service_role' } };

const rows = await withIdentity(SERVICE, { readOnly: true }, async (db) => (await db.query(
  `select o.id, o.bucket_id, o.name, (o.metadata->>'size')::bigint as size, b.public
     from storage.objects o join storage.buckets b on b.id = o.bucket_id order by o.bucket_id, o.name`)).rows);

const stats = { copies: 0, deja: 0, ignores: 0, echecs: 0, octets: 0 };
const echecs = [];
const encode = (name) => name.split('/').map(encodeURIComponent).join('/');

async function copyOne(o) {
  const size = Number(o.size);
  const present = await stat(objectPath(o.bucket_id, o.id)).then((s) => s.size === size, () => false);
  if (present) { stats.deja++; return; }
  if (!KEY && !o.public) { stats.ignores++; return; }
  const url = KEY
    ? `${SUPABASE_URL}/storage/v1/object/authenticated/${o.bucket_id}/${encode(o.name)}`
    : `${SUPABASE_URL}/storage/v1/object/public/${o.bucket_id}/${encode(o.name)}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: KEY ? { apikey: KEY, authorization: `Bearer ${KEY}` } : {} });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const { tmp, size: got } = await writeTemp(Readable.fromWeb(res.body), size + 1);
      if (got !== size) { await discard(tmp); throw new Error(`taille ${got} au lieu de ${size}`); }
      await commitTemp(tmp, o.bucket_id, o.id);
      stats.copies++; stats.octets += got;
      return;
    } catch (err) {
      if (attempt >= 3) { stats.echecs++; echecs.push(`${o.bucket_id}/${o.name} : ${err.message}`); return; }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// 4 téléchargements en parallèle.
const queue = [...rows];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) await copyOne(queue.shift()); }));

console.log(`${rows.length} objets en base : ${stats.copies} copiés (${(stats.octets / 1e6).toFixed(1)} Mo), ${stats.deja} déjà présents, ${stats.ignores} ignorés (bucket privé sans clé), ${stats.echecs} échecs`);
for (const e of echecs.slice(0, 20)) console.log(`✗ ${e}`);
await pool.end();
process.exit(stats.echecs ? 1 : 0);

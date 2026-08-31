import { supabase } from './supabase';

export type Bucket = 'documents' | 'pieces' | 'cv' | 'formateurs' | 'plans' | 'devis' | 'factures' | 'coffre' | 'conseiller_coffre' | 'recrutement' | 'blog' | 'qualiopi';

const PUBLIC_BUCKETS: Bucket[] = ['documents', 'blog'];

function safeName(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`);
  return ext ? `${id}.${ext}` : id;
}

/**
 * Téléverse un fichier dans un bucket Supabase Storage.
 * Renvoie la valeur à stocker dans `fichier_url` :
 *  - bucket public  → URL publique directe
 *  - bucket privé   → chemin du fichier (URL signée générée à l'ouverture)
 */
export async function uploadFile(
  bucket: Bucket, file: File,
): Promise<{ value: string | null; error: string | null }> {
  const path = safeName(file.name);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600', upsert: false,
  });
  if (error) return { value: null, error: error.message };

  if (PUBLIC_BUCKETS.includes(bucket)) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { value: data.publicUrl, error: null };
  }
  return { value: path, error: null };
}

/**
 * `true` si la valeur pointe vers le Storage du projet, c'est-à-dire un fichier
 * téléversé depuis l'application — par opposition à un lien collé vers un site
 * tiers. Les buckets publics stockent une URL complète : sans ce test, un
 * fichier pourtant hébergé chez nous ressemble à une ressource externe
 * (ticket Benjamin « Base documentaire téléverser un fichier »).
 */
export function isHebergeParApp(value: string | null | undefined): boolean {
  if (!value) return false;
  if (!/^https?:\/\//i.test(value)) return true; // chemin nu = bucket privé du projet
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  return Boolean(base) && value.toLowerCase().startsWith(base.toLowerCase());
}

/** Nom de fichier lisible extrait d'une URL ou d'un chemin de stockage. */
export function fileNameOf(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const path = /^https?:\/\//i.test(value) ? new URL(value).pathname : value;
    return decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '');
  } catch {
    return value.split('/').filter(Boolean).pop() ?? '';
  }
}

/** Chemin d'une copie : identifiant neuf, extension d'origine conservée. */
function copyPath(value: string): string {
  const ext = fileNameOf(value).match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? '';
  const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`);
  return `${id}${ext}`;
}

/**
 * Copie un fichier vers un autre bucket et renvoie le chemin de la copie.
 *
 * Un chemin de bucket privé n'a de sens que dans SON bucket : `dossier_pieces`
 * est toujours relu depuis « pieces », si bien que recopier le chemin d'un devis
 * (bucket « devis ») ou d'un plan (bucket « plans ») produisait une pièce dont
 * le fichier restait introuvable — tickets Benjamin « devis ajouté au dossier
 * introuvable » et « plan de formation non transféré ». Il faut donc déplacer
 * une vraie copie, pas seulement la référence.
 */
export async function copyToBucket(
  source: Bucket, value: string, cible: Bucket,
): Promise<{ path: string | null; error: string | null }> {
  if (source === cible) return { path: value, error: null };
  const path = copyPath(value);

  // Bucket privé (chemin nu) : copie côté serveur, sans transiter par le navigateur.
  if (!/^https?:\/\//i.test(value)) {
    const { error } = await supabase.storage.from(source).copy(value, path, { destinationBucket: cible });
    return error ? { path: null, error: error.message } : { path, error: null };
  }

  // Bucket public (URL complète) : pas de copie serveur possible sur une URL,
  // on relit le fichier puis on le téléverse dans le bucket cible.
  try {
    const res = await fetch(value);
    if (!res.ok) return { path: null, error: `Lecture du fichier impossible (HTTP ${res.status})` };
    const { error } = await supabase.storage.from(cible)
      .upload(path, await res.blob(), { cacheControl: '3600', upsert: false });
    return error ? { path: null, error: error.message } : { path, error: null };
  } catch (e) {
    return { path: null, error: e instanceof Error ? e.message : 'Copie impossible' };
  }
}

/**
 * URL absolue et téléchargeable d'un fichier stocké. Les buckets privés ne
 * stockent qu'un chemin : le serveur SMTP ne saurait pas le récupérer, on lui
 * fournit donc une URL signée (ticket « choix des pièces jointes »).
 */
export async function signedUrlFor(bucket: Bucket, value: string, secondes = 86400): Promise<string | null> {
  if (/^https?:\/\//i.test(value)) return value;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(value, secondes);
  return data?.signedUrl ?? null;
}

/** Ouvre un fichier : URL directe si http, sinon URL signée temporaire. */
export async function openFile(bucket: Bucket, value: string): Promise<void> {
  if (/^https?:\/\//i.test(value)) {
    window.open(value, '_blank', 'noopener');
    return;
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(value, 3600);
  if (error || !data) { alert(error?.message ?? 'Fichier introuvable'); return; }
  window.open(data.signedUrl, '_blank', 'noopener');
}

import { supabase } from './supabase';

export type Bucket = 'documents' | 'pieces' | 'cv' | 'formateurs' | 'plans' | 'devis' | 'coffre' | 'conseiller_coffre' | 'recrutement' | 'blog';

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

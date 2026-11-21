// Fichiers joints au chat que le navigateur ne sait pas lire (audio, vidéo, archive RAR, maquette,
// format métier…) : envoyés tels quels, en morceaux, puis rangés dans « Mes ressources »
// (functions/studio/fichiers.ts). Les agents ne les lisent pas ; ils peuvent les joindre à un
// e-mail ou les déposer dans le Drive, après validation.
import { appel } from './api';
import { FORMATS_DOCUMENTS, extension } from './extraction';

/** Mêmes valeurs que functions/studio/fichiers.ts (vérifié par le test). */
export const MORCEAU = 600 * 1024;
export const TAILLE_MAX_BRUT = 10 * 1024 * 1024;

const LISIBLES = new Set(FORMATS_DOCUMENTS.split(',').map((x) => x.slice(1)));
/** Le navigateur en extrait le texte (sinon : transmis tel quel). */
export const lisible = (nom: string) => LISIBLES.has(extension(nom));

/** Base64 d'un morceau d'octets (par tranches, pour ne pas dépasser la pile). */
export function base64(octets: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const nbMorceaux = (taille: number) => Math.max(1, Math.ceil(taille / MORCEAU));

/** Envoie le fichier ; renvoie le titre dans « Mes ressources » et le texte de la pièce jointe pour l'agent. */
export async function deposerFichier(f: File, onProgres?: (fait: number, total: number) => void): Promise<{ titre: string; piece: string }> {
  if (f.size > TAILLE_MAX_BRUT) throw new Error(`« ${f.name} » est trop volumineux pour être transmis tel quel (10 Mo max).`);
  if (!f.size) throw new Error(`« ${f.name} » est vide.`);
  const total = nbMorceaux(f.size);
  const jeton = crypto.randomUUID();
  let fin: { titre: string; piece: string } | null = null;
  for (let index = 0; index < total; index++) {
    const octets = new Uint8Array(await f.slice(index * MORCEAU, (index + 1) * MORCEAU).arrayBuffer());
    const r = await appel<{ titre?: string; piece?: string }>('fichier_deposer', {
      jeton, index, total, morceau: base64(octets), nom: f.name, type: f.type,
    });
    onProgres?.(index + 1, total);
    if (index === total - 1) fin = { titre: String(r.titre ?? f.name), piece: String(r.piece ?? '') };
  }
  return fin!;
}

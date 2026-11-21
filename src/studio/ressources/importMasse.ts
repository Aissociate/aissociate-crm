// Import en masse dans « Mes ressources » : fichiers ou dossiers entiers (glissés ou choisis),
// formats filtrés, doublons écartés, puis un bilan clair. Les fonctions pures sont testées.
import { FORMATS_DOCUMENTS, extension } from '../extraction';

/** Au plus 200 fichiers par import, lus deux par deux. */
export const IMPORT_MAX = 200;
export const PARALLELE = 2;

const ACCEPTES = new Set(FORMATS_DOCUMENTS.split(',').map((f) => f.slice(1)));
export const formatAccepte = (nom: string) => ACCEPTES.has(extension(nom));
/** Fichiers système à ignorer sans les compter (.DS_Store, Thumbs.db, ~$brouillon.docx…). */
const systeme = (nom: string) => /^(\.|~\$)|^thumbs\.db$|^desktop\.ini$/i.test(nom);

export type Tri = { aLire: File[]; refuses: string[]; doublons: string[]; enTrop: number };

/** Ce qui sera lu, ce qui est écarté et pourquoi. Doublon : même nom et même taille qu'une ressource existante ou déjà retenue. */
export function trierFichiers(fichiers: File[], existants: { titre: string; taille: number | null }[]): Tri {
  const vus = new Set(existants.map((e) => `${e.titre}|${e.taille ?? ''}`));
  const tri: Tri = { aLire: [], refuses: [], doublons: [], enTrop: 0 };
  for (const f of fichiers) {
    if (systeme(f.name)) continue;
    if (!formatAccepte(f.name)) { tri.refuses.push(f.name); continue; }
    const cle = `${f.name}|${f.size}`;
    if (vus.has(cle)) { tri.doublons.push(f.name); continue; }
    if (tri.aLire.length >= IMPORT_MAX) { tri.enTrop++; continue; }
    vus.add(cle);
    tri.aLire.push(f);
  }
  return tri;
}

export type Bilan = { importes: number; sensibles: string[]; echecs: string[]; refuses: string[]; doublons: string[]; enTrop: number };

/** Une phrase de bilan : ce qui est fait d'abord, puis ce qui demande attention. */
export function phraseBilan(b: Bilan): string {
  const s = (n: number) => (n > 1 ? 's' : '');
  const parts = [`${b.importes} fichier${s(b.importes)} importé${s(b.importes)}`];
  if (b.sensibles.length) parts.push(`${b.sensibles.length} sensible${s(b.sensibles.length)}, rangé${s(b.sensibles.length)} désactivé${s(b.sensibles.length)}`);
  if (b.doublons.length) parts.push(`${b.doublons.length} déjà présent${s(b.doublons.length)}, ignoré${s(b.doublons.length)}`);
  if (b.refuses.length) parts.push(`${b.refuses.length} format${s(b.refuses.length)} non pris en charge`);
  if (b.enTrop) parts.push(`${b.enTrop} au-delà de ${IMPORT_MAX}, à importer ensuite`);
  if (b.echecs.length) parts.push(`${b.echecs.length} en échec`);
  return `${parts.join(' · ')}.`;
}

/** Fichiers d'un dépôt par glisser : dossiers parcourus récursivement (API des entrées du navigateur). */
export async function fichiersDuDepot(dt: DataTransfer): Promise<File[]> {
  const entrees = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => Boolean(e));
  if (!entrees.length) return [...dt.files];
  const out: File[] = [];
  const parcourir = async (e: FileSystemEntry): Promise<void> => {
    if (out.length > IMPORT_MAX * 2) return;
    if (e.isFile) {
      out.push(await new Promise<File>((ok, ko) => (e as FileSystemFileEntry).file(ok, ko)));
    } else if (e.isDirectory) {
      const lecteur = (e as FileSystemDirectoryEntry).createReader();
      // readEntries rend les entrées par paquets : on lit jusqu'à un paquet vide.
      for (;;) {
        const paquet = await new Promise<FileSystemEntry[]>((ok, ko) => lecteur.readEntries(ok, ko));
        if (!paquet.length) break;
        for (const x of paquet) await parcourir(x);
      }
    }
  };
  for (const e of entrees) await parcourir(e);
  return out;
}

/** Exécute `tache` sur chaque élément, `n` à la fois, dans l'ordre de départ. */
export async function parPaquets<T>(elements: T[], n: number, tache: (x: T, i: number) => Promise<void>): Promise<void> {
  let suivant = 0;
  const ouvrier = async () => { while (suivant < elements.length) { const i = suivant++; await tache(elements[i], i); } };
  await Promise.all(Array.from({ length: Math.min(n, elements.length) }, ouvrier));
}

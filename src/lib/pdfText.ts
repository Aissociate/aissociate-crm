// Extraction du texte des PDF (pour alimenter le contexte de l'assistant IA).
// `unpdf` est chargé à la volée depuis un CDN ESM plutôt qu'empaqueté : cela
// évite toute dépendance d'installation (l'environnement Bolt ne refait pas
// forcément `npm install`) et ne charge la lib que lorsqu'on extrait vraiment.
const UNPDF_CDN = 'https://esm.sh/unpdf@1.6.2';

type UnpdfModule = {
  getDocumentProxy: (data: Uint8Array) => Promise<unknown>;
  extractText: (pdf: unknown, opts?: { mergePages?: boolean }) => Promise<{ totalPages: number; text: string | string[] }>;
};

let _unpdf: Promise<UnpdfModule> | null = null;
function loadUnpdf(): Promise<UnpdfModule> {
  if (!_unpdf) _unpdf = import(/* @vite-ignore */ UNPDF_CDN) as Promise<UnpdfModule>;
  return _unpdf;
}

/** Vrai si le fichier (ou l'URL) désigne un PDF. */
export function isPdf(nameOrUrl: string | null | undefined, mime?: string): boolean {
  if (mime === 'application/pdf') return true;
  return /\.pdf(?:[?#]|$)/i.test(nameOrUrl ?? '');
}

const MAX_CHARS = 200000; // borne le texte stocké (le contexte chat est lui-même tronqué)

/** Extrait le texte d'un PDF (pages fusionnées), nettoyé et borné. */
async function fromBytes(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy, extractText } = await loadUnpdf();
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join('\n') : String(text ?? '');
  return merged.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);
}

/** Extrait le texte d'un fichier PDF local (objet File). */
export async function extractPdfTextFromFile(file: File): Promise<string> {
  return fromBytes(new Uint8Array(await file.arrayBuffer()));
}

/** Extrait le texte d'un PDF accessible par URL (document déjà téléversé). */
export async function extractPdfTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement du PDF impossible (HTTP ${res.status})`);
  return fromBytes(new Uint8Array(await res.arrayBuffer()));
}

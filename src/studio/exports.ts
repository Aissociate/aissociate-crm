// Exports Word et PDF des réponses d'agents, avec le papier à en-tête du client.
// Liaison navigateur de exportDoc.ts (pur) : lecture de l'en-tête, logo, téléchargement.
import { appel, extraireRelais, type EnteteComplete } from './api';
import { construireDocx, documentHtml, nomFichier, type DocExport, type Logo } from './exportDoc';

// Même approche que l'extraction PDF du CRM : bibliothèque chargée au premier clic
// depuis un CDN ESM, sans alourdir le bundle ni toucher au lockfile.
const DOCX_CDN = 'https://esm.sh/docx@9.5.1';

let enteteCache: Promise<EnteteComplete> | null = null;
/** En-tête lu une fois par session (et relu après une modification dans « Mon entreprise »). */
export function chargerEntete(forcer = false): Promise<EnteteComplete> {
  if (!enteteCache || forcer) {
    enteteCache = appel<EnteteComplete>('entete').catch(() => ({ entete: {}, logo_url: null, disponible: false }));
  }
  return enteteCache;
}

export type Source = { titre: string; contenu: string; agent: string; date?: string; nomEspace: string };

async function preparer(s: Source): Promise<{ doc: DocExport; logoUrl: string | null }> {
  const e = await chargerEntete();
  const date = new Date(s.date ?? Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    logoUrl: e.logo_url,
    doc: {
      titre: s.titre, meta: `Préparé avec ${s.agent} · ${date}`,
      contenu: extraireRelais(s.contenu).texte, entete: e.entete, nomEspace: s.nomEspace,
    },
  };
}

/** Logo converti en PNG (Word ne lit pas le WebP) et mesuré pour garder ses proportions. */
async function logoPng(url: string): Promise<Logo | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
    if (!blob) return null;
    return { data: await blob.arrayBuffer(), largeur: img.naturalWidth, hauteur: img.naturalHeight };
  } catch { return null; } // logo illisible : document sans logo plutôt qu'un échec
}

export async function exporterWord(s: Source): Promise<void> {
  const [{ doc, logoUrl }, D] = await Promise.all([preparer(s), import(/* @vite-ignore */ DOCX_CDN)]);
  const logo = logoUrl ? await logoPng(logoUrl) : null;
  const blob: Blob = await D.Packer.toBlob(construireDocx(D, doc, logo));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier(doc.titre, 'docx');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** PDF : le document est rendu dans un cadre invisible puis imprimé (« Enregistrer au format PDF »). */
export async function exporterPdf(s: Source): Promise<void> {
  const { doc, logoUrl } = await preparer(s);
  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  Object.assign(cadre.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(cadre);
  const w = cadre.contentWindow!;
  w.document.open(); w.document.write(documentHtml(doc, logoUrl)); w.document.close();
  // Le titre du document devient le nom de fichier proposé par la boîte d'impression.
  w.document.title = nomFichier(doc.titre, 'pdf').replace(/\.pdf$/, '');
  await Promise.all([...w.document.images].map((i) => (i.complete ? null : i.decode().catch(() => null))));
  w.focus(); w.print();
  setTimeout(() => cadre.remove(), 60_000);
}

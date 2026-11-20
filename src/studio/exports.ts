// Exports Word et PDF des réponses d'agents, avec le papier à en-tête du client.
// Liaison navigateur de exportDoc.ts (pur) : lecture de l'en-tête, logo, téléchargement.
import { appel, extraireRelais, type EnteteComplete } from './api';
import { construireDocx, documentHtml, documentWordHtml, nomFichier, type DocExport, type Logo, type Nommage } from './exportDoc';
import { htmlSur } from './htmlSur';

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

/** `id` et `version` : livrable exporté, pour le nom de fichier Agent-Titre-Réf-vN. */
export type Source = { titre: string; contenu: string; agent: string; date?: string; nomEspace: string; id?: string | null; version?: number | null };
const nommage = (s: { titre: string; agent: string; id?: string | null; version?: number | null }): Nommage =>
  ({ titre: s.titre, agent: s.agent, id: s.id, version: s.version });

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
  a.download = nomFichier(nommage(s), 'docx');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/**
 * Imprime un document HTML depuis un cadre invisible (« Enregistrer au format PDF »).
 * Utilisé par le Studio et par le CRM (rapport d'un client).
 */
export async function imprimerDocument(doc: DocExport, logoUrl: string | null, nom: Nommage | string = doc.titre): Promise<void> {
  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  Object.assign(cadre.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(cadre);
  const w = cadre.contentWindow!;
  w.document.open(); w.document.write(documentHtml(doc, logoUrl)); w.document.close();
  // Le titre du document devient le nom de fichier proposé par la boîte d'impression.
  w.document.title = nomFichier(nom, 'pdf').replace(/\.pdf$/, '');
  await Promise.all([...w.document.images].map((i) => (i.complete ? null : i.decode().catch(() => null))));
  w.focus(); w.print();
  setTimeout(() => cadre.remove(), 60_000);
}

/** PDF d'une réponse ou d'un rapport, avec le papier à en-tête du client. */
export async function exporterPdf(s: Source): Promise<void> {
  const { doc, logoUrl } = await preparer(s);
  await imprimerDocument(doc, logoUrl, nommage(s));
}

/** Document HTML d'un agent : PDF (impression) ou Word (.doc), avec le papier à en-tête. */
export async function exporterDocumentHtml(format: 'pdf' | 'word', s: { titre: string; html: string; agent: string; nomEspace: string; id?: string | null; version?: number | null }): Promise<void> {
  const { doc, logoUrl } = await preparer({ titre: s.titre, contenu: '', agent: s.agent, nomEspace: s.nomEspace });
  const html = htmlSur(s.html);
  if (format === 'pdf') { await imprimerDocument({ ...doc, html }, logoUrl, nommage(s)); return; }
  const blob = new Blob(['\ufeff', documentWordHtml({ ...doc, html }, logoUrl)], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomFichier(nommage(s), 'doc');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

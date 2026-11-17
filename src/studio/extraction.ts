// Extraction du texte des documents, dans le navigateur (rien n'est envoyé tant que
// le texte n'est pas extrait). Bibliothèques chargées à la demande depuis esm.sh,
// comme l'extraction PDF du CRM, pour ne pas alourdir le Studio.
//   PDF (unpdf) · Word .docx (mammoth) · Excel .xlsx/.xls/.ods (SheetJS, en CSV par feuille)
//   PowerPoint .pptx et OpenDocument .odt/.odp (jszip, texte des diapositives / paragraphes)
//   Texte : .txt .md .csv .tsv .json .xml .html .rtf (balises retirées)

const CDN = {
  unpdf: 'https://esm.sh/unpdf@1.6.2',
  mammoth: 'https://esm.sh/mammoth@1.8.0',
  xlsx: 'https://esm.sh/xlsx@0.18.5',
  jszip: 'https://esm.sh/jszip@3.10.1',
};
const charger = <T,>(url: string) => import(/* @vite-ignore */ url) as Promise<T>;

export const FORMATS_DOCUMENTS = [
  '.pdf', '.docx', '.xlsx', '.xls', '.ods', '.pptx', '.odt', '.odp',
  '.txt', '.md', '.csv', '.tsv', '.json', '.xml', '.html', '.htm', '.rtf',
].join(',');
export const TAILLE_MAX = 15e6;

export const extension = (nom: string) => nom.split('.').pop()?.toLowerCase() ?? '';

/** Texte brut d'un fragment XML/HTML : balises retirées, entités courantes décodées. */
export function texteDeBalises(xml: string, saut = /<\/(p|div|li|h\d|tr|a:p|text:p|text:h)>|<br\s*\/?>/gi): string {
  return xml.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(saut, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** RTF minimal : retire groupes de contrôle et commandes, garde le texte. */
export function texteRtf(rtf: string): string {
  return rtf.replace(/\\par[d]?/g, '\n').replace(/\{\\\*[^}]*\}/g, '').replace(/\\'([0-9a-f]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Ordre naturel des diapositives : slide2 avant slide10. */
export const ordreNaturel = (a: string, b: string) => (Number(/(\d+)\.xml$/.exec(a)?.[1] ?? 0) - Number(/(\d+)\.xml$/.exec(b)?.[1] ?? 0));

type Zip = { files: Record<string, { async: (t: 'string') => Promise<string> }> };

async function textePdf(buf: ArrayBuffer): Promise<string> {
  const m = await charger<{
    getDocumentProxy: (d: Uint8Array) => Promise<unknown>;
    extractText: (p: unknown, o: { mergePages: boolean }) => Promise<{ text: string | string[] }>;
  }>(CDN.unpdf);
  const { text } = await m.extractText(await m.getDocumentProxy(new Uint8Array(buf)), { mergePages: true });
  return (Array.isArray(text) ? text.join('\n') : text).replace(/[ \t]+\n/g, '\n').trim();
}

async function zip(buf: ArrayBuffer): Promise<Zip> {
  const m = await charger<{ default: { loadAsync: (b: ArrayBuffer) => Promise<Zip> } }>(CDN.jszip);
  return m.default.loadAsync(buf);
}

/** Extrait le texte d'un fichier ; lève une erreur lisible si le format n'est pas pris en charge. */
export async function extraireTexte(f: File): Promise<string> {
  if (f.size > TAILLE_MAX) throw new Error(`« ${f.name} » est trop volumineux (15 Mo max).`);
  const ext = extension(f.name);
  let texte = '';
  if (ext === 'pdf') texte = await textePdf(await f.arrayBuffer());
  else if (ext === 'docx') {
    const m = await charger<{ default?: { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }; extractRawText?: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }>(CDN.mammoth);
    const fn = m.extractRawText ?? m.default!.extractRawText;
    texte = (await fn({ arrayBuffer: await f.arrayBuffer() })).value;
  } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
    type Classeur = { SheetNames: string[]; Sheets: Record<string, unknown> };
    const X = await charger<{ read: (d: ArrayBuffer, o: { type: 'array' }) => Classeur; utils: { sheet_to_csv: (s: unknown) => string } }>(CDN.xlsx);
    const c = X.read(await f.arrayBuffer(), { type: 'array' });
    texte = c.SheetNames.map((n) => `## Feuille « ${n} »\n${X.utils.sheet_to_csv(c.Sheets[n]).replace(/^,*\n/gm, '')}`).join('\n\n');
  } else if (ext === 'pptx') {
    const z = await zip(await f.arrayBuffer());
    const diapos = Object.keys(z.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort(ordreNaturel);
    const textes = await Promise.all(diapos.map((n) => z.files[n].async('string')));
    texte = textes.map((x, i) => `## Diapositive ${i + 1}\n${texteDeBalises(x)}`).join('\n\n');
  } else if (ext === 'odt' || ext === 'odp') {
    const z = await zip(await f.arrayBuffer());
    texte = z.files['content.xml'] ? texteDeBalises(await z.files['content.xml'].async('string')) : '';
  } else if (['html', 'htm', 'xml'].includes(ext)) texte = texteDeBalises(await f.text());
  else if (ext === 'rtf') texte = texteRtf(await f.text());
  else if (['txt', 'md', 'csv', 'tsv', 'json'].includes(ext) || f.type.startsWith('text/')) texte = await f.text();
  else throw new Error(`Format « .${ext} » non pris en charge. Formats acceptés : PDF, Word, Excel, PowerPoint, OpenDocument, CSV, texte.`);
  texte = texte.trim();
  if (!texte) throw new Error(`Aucun texte lisible dans « ${f.name} » (document scanné ou image ?).`);
  return texte;
}

// ── Images : réduites dans le navigateur, puis lues par le modèle de vision côté serveur ──
export const FORMATS_IMAGES = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].join(',');
export const estImage = (f: File) => /^image\/(png|jpeg|webp|gif)$/.test(f.type) || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension(f.name));

/** Image en JPEG de 1 600 px au plus (URL data) : assez nette pour lire un texte, légère à envoyer. */
export async function imageReduite(f: File, cote = 1600): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const r = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * r)); c.height = Math.max(1, Math.round(img.naturalHeight * r));
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // transparence → fond blanc
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } catch { throw new Error(`Image illisible : « ${f.name} »`); }
  finally { URL.revokeObjectURL(url); }
}

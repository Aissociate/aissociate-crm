// Construction des documents exportés (Word et PDF) à partir d'une réponse d'agent
// en Markdown — module PUR : ni DOM ni réseau. La bibliothèque `docx` est passée
// en paramètre (chargée à la demande dans le navigateur, installée dans les tests).
import type { Entete } from './api';

// ── Markdown → blocs ────────────────────────────────────────────────────────

export type Segment = { texte: string; gras?: boolean; italique?: boolean; code?: boolean };
export type Bloc =
  | { type: 'titre'; niveau: 1 | 2 | 3; segments: Segment[] }
  | { type: 'paragraphe'; lignes: Segment[][] }
  | { type: 'liste'; ordonnee: boolean; items: Segment[][] }
  | { type: 'tableau'; tete: Segment[][]; rangs: Segment[][][] }
  | { type: 'code'; texte: string }
  | { type: 'separateur' };

export function analyserEnLigne(texte: string): Segment[] {
  const out: Segment[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte))) {
    if (m.index > dernier) out.push({ texte: texte.slice(dernier, m.index) });
    const t = m[0];
    if (t.startsWith('**')) out.push({ texte: t.slice(2, -2), gras: true });
    else if (t.startsWith('`')) out.push({ texte: t.slice(1, -1), code: true });
    else out.push({ texte: t.slice(1, -1), italique: true });
    dernier = m.index + t.length;
  }
  if (dernier < texte.length) out.push({ texte: texte.slice(dernier) });
  return out;
}

const cellules = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => analyserEnLigne(c.trim()));
const RE_LISTE = /^\s*([-*•]|\d+[.)])\s+/;

export function analyserMarkdown(source: string): Bloc[] {
  const lignes = source.replace(/\r/g, '').split('\n');
  const blocs: Bloc[] = [];
  let i = 0;
  while (i < lignes.length) {
    const l = lignes[i];
    if (l.trim().startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lignes.length && !lignes[i].trim().startsWith('```')) code.push(lignes[i++]);
      i++;
      blocs.push({ type: 'code', texte: code.join('\n') });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lignes.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lignes[i + 1])) {
      const tete = cellules(l);
      i += 2;
      const rangs: Segment[][][] = [];
      while (i < lignes.length && /^\s*\|.*\|\s*$/.test(lignes[i])) rangs.push(cellules(lignes[i++]));
      blocs.push({ type: 'tableau', tete, rangs });
      continue;
    }
    const titre = /^(#{1,4})\s+(.*)$/.exec(l);
    if (titre) {
      blocs.push({ type: 'titre', niveau: Math.min(3, titre[1].length) as 1 | 2 | 3, segments: analyserEnLigne(titre[2]) });
      i++; continue;
    }
    if (RE_LISTE.test(l)) {
      const ordonnee = /^\s*\d/.test(l);
      const items: Segment[][] = [];
      while (i < lignes.length && RE_LISTE.test(lignes[i])) items.push(analyserEnLigne(lignes[i++].replace(RE_LISTE, '')));
      blocs.push({ type: 'liste', ordonnee, items });
      continue;
    }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(l)) { blocs.push({ type: 'separateur' }); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const para: Segment[][] = [];
    while (i < lignes.length && lignes[i].trim() && !/^(#{1,4}\s|```|\s*\||\s*(---+)\s*$)/.test(lignes[i]) && !RE_LISTE.test(lignes[i])) {
      // Citation Markdown (« > ») : on garde le texte.
      para.push(analyserEnLigne(lignes[i++].replace(/^\s*>\s?/, '')));
    }
    if (!para.length) { para.push(analyserEnLigne(l)); i++; }
    blocs.push({ type: 'paragraphe', lignes: para });
  }
  return blocs;
}

// ── En-tête : lignes communes aux deux formats ─────────────────────────────

export type DocExport = {
  titre: string;            // titre de la mission
  meta: string;             // « Préparé avec Hugo · 12 novembre 2026 »
  contenu: string;          // Markdown de la réponse (balise de relais déjà retirée)
  entete: Entete;
  nomEspace: string;        // repli si la raison sociale n'est pas renseignée
};

export function lignesEntete(e: Entete, nomEspace: string) {
  const nom = e.raison_sociale || nomEspace.replace(/^Démo — /, '');
  const adresse = [e.adresse, [e.code_postal, e.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const contacts = [e.telephone, e.email, e.site].filter(Boolean).join(' · ');
  const pied = [nom, e.siret && `SIRET ${e.siret}`, e.mentions].filter(Boolean).join(' · ');
  return { nom, adresse, contacts, pied };
}

export function nomFichier(titre: string, ext: 'docx' | 'pdf'): string {
  const base = titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
  return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

// ── PDF : document HTML imprimable (le navigateur produit le PDF) ──────────

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const segHtml = (segs: Segment[]) => segs.map((s) => {
  const t = echapper(s.texte);
  return s.gras ? `<strong>${t}</strong>` : s.italique ? `<em>${t}</em>` : s.code ? `<code>${t}</code>` : t;
}).join('');

export function documentHtml(d: DocExport, logoUrl: string | null): string {
  const e = lignesEntete(d.entete, d.nomEspace);
  const corps = analyserMarkdown(d.contenu).map((b) => {
    switch (b.type) {
      case 'titre': return `<h${b.niveau + 1}>${segHtml(b.segments)}</h${b.niveau + 1}>`;
      case 'paragraphe': return `<p>${b.lignes.map(segHtml).join('<br>')}</p>`;
      case 'liste': return `<${b.ordonnee ? 'ol' : 'ul'}>${b.items.map((it) => `<li>${segHtml(it)}</li>`).join('')}</${b.ordonnee ? 'ol' : 'ul'}>`;
      case 'tableau': return `<table><thead><tr>${b.tete.map((c) => `<th>${segHtml(c)}</th>`).join('')}</tr></thead><tbody>${
        b.rangs.map((r) => `<tr>${r.map((c) => `<td>${segHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      case 'code': return `<pre>${echapper(b.texte)}</pre>`;
      case 'separateur': return '<hr>';
    }
  }).join('\n');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(d.titre)}</title><style>
@page { size: A4; margin: 18mm 16mm 22mm; }
* { box-sizing: border-box; }
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.5; margin: 0; }
.entete { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 18px; }
.entete img { max-height: 60px; max-width: 200px; object-fit: contain; }
.coord { text-align: right; font-size: 8.5pt; color: #4b5563; }
.coord .nom { font-size: 11pt; font-weight: 700; color: #111827; }
h1 { font-size: 16pt; margin: 0 0 2px; color: #111827; }
.meta { font-size: 8.5pt; color: #6b7280; margin-bottom: 16px; }
h2 { font-size: 13pt; margin: 16px 0 6px; } h3 { font-size: 11.5pt; margin: 12px 0 4px; } h4 { font-size: 10.5pt; margin: 10px 0 4px; }
p { margin: 0 0 8px; } ul, ol { margin: 0 0 8px; padding-left: 20px; } li { margin-bottom: 2px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.5pt; page-break-inside: auto; }
th { background: #f3f4f6; text-align: left; } th, td { border: 1px solid #d1d5db; padding: 4px 6px; vertical-align: top; }
tr { page-break-inside: avoid; }
code { font-family: Consolas, monospace; background: #f3f4f6; padding: 0 3px; border-radius: 3px; }
pre { font-family: Consolas, monospace; background: #f3f4f6; padding: 8px; white-space: pre-wrap; font-size: 9pt; }
hr { border: 0; border-top: 1px solid #d1d5db; margin: 12px 0; }
.pied { position: fixed; bottom: -14mm; left: 0; right: 0; text-align: center; font-size: 7.5pt; color: #9ca3af; }
</style></head><body>
<div class="entete">
  <div>${logoUrl ? `<img src="${echapper(logoUrl)}" alt="">` : ''}</div>
  <div class="coord"><div class="nom">${echapper(e.nom)}</div>${e.adresse ? `<div>${echapper(e.adresse)}</div>` : ''}${e.contacts ? `<div>${echapper(e.contacts)}</div>` : ''}</div>
</div>
<h1>${echapper(d.titre)}</h1>
<div class="meta">${echapper(d.meta)}</div>
${corps}
<div class="pied">${echapper(e.pied)}</div>
</body></html>`;
}

// ── Word : document .docx (bibliothèque `docx` passée en paramètre) ────────

// Sous-ensemble utilisé de la bibliothèque docx (v9), typé au plus juste.
/* eslint-disable @typescript-eslint/no-explicit-any */
type DocxLib = any;
export type Logo = { data: ArrayBuffer; largeur: number; hauteur: number };

export function construireDocx(D: DocxLib, d: DocExport, logo: Logo | null) {
  const e = lignesEntete(d.entete, d.nomEspace);
  const POLICE = 'Calibri';
  const sansBord = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const bordsAucun = { top: sansBord, bottom: sansBord, left: sansBord, right: sansBord, insideHorizontal: sansBord, insideVertical: sansBord };
  const bordFin = { style: D.BorderStyle.SINGLE, size: 4, color: 'D1D5DB' };
  const runs = (segs: Segment[], extra: Record<string, unknown> = {}) => segs.map((s) => new D.TextRun({
    text: s.texte, bold: s.gras || undefined, italics: s.italique || undefined,
    font: s.code ? 'Consolas' : POLICE, ...extra,
  }));

  let instance = 0;
  const corps: unknown[] = [];
  for (const b of analyserMarkdown(d.contenu)) {
    if (b.type === 'titre') {
      const niveaux = [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3];
      corps.push(new D.Paragraph({ heading: niveaux[b.niveau - 1], spacing: { before: 200, after: 80 }, children: runs(b.segments) }));
    } else if (b.type === 'paragraphe') {
      const enfants: unknown[] = [];
      b.lignes.forEach((l, k) => { if (k) enfants.push(new D.TextRun({ break: 1 })); enfants.push(...runs(l)); });
      corps.push(new D.Paragraph({ spacing: { after: 120 }, children: enfants }));
    } else if (b.type === 'liste') {
      instance++;
      for (const it of b.items) {
        corps.push(new D.Paragraph({
          ...(b.ordonnee ? { numbering: { reference: 'num', level: 0, instance } } : { bullet: { level: 0 } }),
          spacing: { after: 40 }, children: runs(it),
        }));
      }
    } else if (b.type === 'tableau') {
      const cell = (segs: Segment[], entete: boolean) => new D.TableCell({
        children: [new D.Paragraph({ children: runs(segs, entete ? { bold: true } : {}) })],
        shading: entete ? { fill: 'F3F4F6', type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
      });
      corps.push(new D.Table({
        width: { size: 100, type: D.WidthType.PERCENTAGE },
        borders: { top: bordFin, bottom: bordFin, left: bordFin, right: bordFin, insideHorizontal: bordFin, insideVertical: bordFin },
        rows: [
          new D.TableRow({ tableHeader: true, children: b.tete.map((c) => cell(c, true)) }),
          ...b.rangs.map((r) => new D.TableRow({ children: r.map((c) => cell(c, false)) })),
        ],
      }));
      corps.push(new D.Paragraph({ children: [] }));
    } else if (b.type === 'code') {
      corps.push(new D.Paragraph({
        shading: { fill: 'F3F4F6', type: D.ShadingType.CLEAR, color: 'auto' },
        children: b.texte.split('\n').flatMap((l, k) => [...(k ? [new D.TextRun({ break: 1 })] : []), new D.TextRun({ text: l, font: 'Consolas', size: 18 })]),
      }));
    } else {
      corps.push(new D.Paragraph({ border: { bottom: bordFin }, children: [] }));
    }
  }

  // En-tête répété sur chaque page : logo à gauche, coordonnées à droite.
  const hauteurLogo = 48;
  const celluleLogo = new D.TableCell({
    borders: bordsAucun, width: { size: 40, type: D.WidthType.PERCENTAGE },
    children: [new D.Paragraph({
      children: logo ? [new D.ImageRun({
        type: 'png', data: logo.data,
        transformation: { width: Math.round((logo.largeur / logo.hauteur) * hauteurLogo), height: hauteurLogo },
      })] : [],
    })],
  });
  const coord = [
    new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: e.nom, bold: true, size: 22, font: POLICE })] }),
    ...[e.adresse, e.contacts].filter(Boolean).map((t) => new D.Paragraph({
      alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: t, size: 16, color: '4B5563', font: POLICE })],
    })),
  ];
  const entete = new D.Header({
    children: [
      new D.Table({
        width: { size: 100, type: D.WidthType.PERCENTAGE }, borders: bordsAucun,
        rows: [new D.TableRow({ children: [celluleLogo, new D.TableCell({ borders: bordsAucun, children: coord })] })],
      }),
      new D.Paragraph({ border: { bottom: { style: D.BorderStyle.SINGLE, size: 12, color: '111827' } }, children: [] }),
    ],
  });
  const pied = new D.Footer({
    children: [new D.Paragraph({
      alignment: D.AlignmentType.CENTER,
      children: [
        new D.TextRun({ text: e.pied, size: 14, color: '9CA3AF', font: POLICE }),
        new D.TextRun({ children: ['  ·  page ', D.PageNumber.CURRENT, ' / ', D.PageNumber.TOTAL_PAGES], size: 14, color: '9CA3AF', font: POLICE }),
      ],
    })],
  });

  return new D.Document({
    creator: e.nom, title: d.titre,
    styles: { default: { document: { run: { font: POLICE, size: 21 } } } },
    numbering: { config: [{ reference: 'num', levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: '%1.', alignment: D.AlignmentType.START }] }] },
    sections: [{
      properties: { page: { margin: { top: 1600, bottom: 1200, left: 1100, right: 1100, header: 500, footer: 500 } } },
      headers: { default: entete },
      footers: { default: pied },
      children: [
        new D.Paragraph({ heading: D.HeadingLevel.TITLE, spacing: { after: 60 }, children: [new D.TextRun({ text: d.titre, font: POLICE })] }),
        new D.Paragraph({ spacing: { after: 240 }, children: [new D.TextRun({ text: d.meta, size: 17, color: '6B7280', font: POLICE })] }),
        ...corps,
      ],
    }],
  });
}

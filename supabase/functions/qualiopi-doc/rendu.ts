// Rendu PDF des modèles de modeles.ts (pdf-lib) : en-tête centré comme les
// convocations produites, tableau à deux colonnes, sections, signature.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "npm:pdf-lib@1.17.1";
import type { Modele } from "./modeles.ts";

// WinAnsi garde aussi tirets, guillemets typographiques et points de suspension.
export function cleanAnsi(s: unknown): string {
  let out = "";
  for (const ch of String(s ?? "")) {
    const c = ch.codePointAt(0)!;
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 255) || [8211, 8212, 8216, 8217, 8220, 8221, 8226, 8230, 8364, 338, 339].includes(c)) out += ch;
    else if (c === 8239 || c === 8201) out += " ";
  }
  return out;
}

/** Rendu d'un modèle (modeles.ts) : en-tête centré, tableau, sections, contact, signature. */
export async function rendreModele(pdf: PDFDocument, m: Modele, org: Record<string, string>, signature: PDFImage | null, logo: PDFImage | null) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 56, L = W - 2 * M;
  const noir = rgb(0.13, 0.13, 0.15), gris = rgb(0.45, 0.45, 0.5), bord = rgb(0.8, 0.8, 0.82), fond = rgb(0.95, 0.95, 0.96);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const place = (h: number) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };
  const wrap = (t: string, f: PDFFont, size: number, width: number, premiere = width): string[] => {
    const lignes: string[] = [];
    for (const para of cleanAnsi(t).split("\n")) {
      let ligne = "";
      for (const mot of para.split(/\s+/).filter(Boolean)) {
        const test = ligne ? `${ligne} ${mot}` : mot;
        if (f.widthOfTextAtSize(test, size) > (lignes.length ? width : premiere) && ligne) { lignes.push(ligne); ligne = mot; }
        else ligne = test;
      }
      lignes.push(ligne);
    }
    return lignes;
  };
  const centre = (t: string, f: PDFFont, size: number, color = noir) => {
    const s = cleanAnsi(t);
    page.drawText(s, { x: (W - f.widthOfTextAtSize(s, size)) / 2, y, size, font: f, color });
  };

  if (logo) { const w = 70, h = (logo.height / logo.width) * w; page.drawImage(logo, { x: M, y: H - M - h + 14, width: w, height: h }); }
  centre((org.nom || "Aissociate").toUpperCase(), fontB, 20); y -= 16;
  centre("Organisme de formation professionnelle", font, 9.5, gris); y -= 34;
  centre(m.titre.toUpperCase(), fontB, 16); y -= 28;

  for (const b of m.blocs) {
    if (b.type === "tableau") {
      const col = 140, pad = 7, size = 10, lh = 13;
      for (const [label, valeur] of b.lignes) {
        const lignes = wrap(valeur, font, size, L - col - 2 * pad);
        const h = Math.max(1, lignes.length) * lh + 2 * pad - 3;
        place(h);
        page.drawRectangle({ x: M, y: y - h, width: col, height: h, color: fond, borderColor: bord, borderWidth: 0.6 });
        page.drawRectangle({ x: M + col, y: y - h, width: L - col, height: h, borderColor: bord, borderWidth: 0.6 });
        page.drawText(cleanAnsi(label), { x: M + pad, y: y - pad - size + 1, size, font: fontB, color: noir });
        lignes.forEach((ln, i) => page.drawText(ln, { x: M + col + pad, y: y - pad - size + 1 - i * lh, size, font, color: noir }));
        y -= h;
      }
      y -= 16;
    } else if (b.type === "section") {
      if (b.titre) { place(30); page.drawText(cleanAnsi(b.titre), { x: M, y, size: 11, font: fontB, color: noir }); y -= 16; }
      for (const p of b.paragraphes) {
        const size = 10, lh = 13.5;
        const prefixe = p.gras ? `${p.gras} ` : "";
        const wPre = prefixe ? fontB.widthOfTextAtSize(cleanAnsi(prefixe), size) : 0;
        const lignes = wrap(p.texte, font, size, L, L - wPre);
        lignes.forEach((ln, i) => {
          place(lh);
          if (i === 0 && prefixe) page.drawText(cleanAnsi(prefixe), { x: M, y, size, font: fontB, color: noir });
          page.drawText(ln, { x: M + (i === 0 ? wPre : 0), y, size, font, color: noir });
          y -= lh;
        });
      }
      y -= 10;
    } else {
      place(20); y -= 6;
      for (const ln of wrap(b.texte, font, 8.5, L)) { page.drawText(ln, { x: M, y, size: 8.5, font, color: noir }); y -= 11; }
    }
  }
  if (m.signature && signature) {
    const w = 150, h = (signature.height / signature.width) * w;
    place(h + 6);
    page.drawImage(signature, { x: M, y: y - h, width: w, height: h });
  }
}

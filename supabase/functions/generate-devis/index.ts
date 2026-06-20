// Supabase Edge Function — génération PDF d'un devis conforme (norme FR, HT).
// Mise en page calquée sur le modèle de facture fourni : logo, émetteur (gauche)
// / client (droite), titre + date, tableau des prestations, bloc totaux gris,
// conditions + exonération TVA, mentions légales en pied.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function clean(s: unknown): string {
  return String(s ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[•·]/g, "-").replace(/ /g, " ").replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}
const eur = (n: number) => `${(Number(n) || 0).toFixed(2).replace(".", ",")} €`;
const frDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const frLong = (s: string | null) => { if (!s) return ""; const d = new Date(s); return `Le ${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { devisId } = await req.json();
    if (!devisId) return json({ error: "devisId manquant" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: devis } = await sb.from("devis").select("*").eq("id", devisId).maybeSingle();
    if (!devis) return json({ error: "Devis introuvable" }, 404);
    const { data: lignes } = await sb.from("devis_lignes").select("*").eq("devis_id", devisId).order("ordre");
    const { data: contact } = devis.contact_id ? await sb.from("contacts").select("*").eq("id", devis.contact_id).maybeSingle() : { data: null };
    const { data: entreprise } = devis.entreprise_id ? await sb.from("entreprises").select("*").eq("id", devis.entreprise_id).maybeSingle() : { data: null };
    const { data: financeur } = devis.financeur_id ? await sb.from("financeurs").select("*").eq("id", devis.financeur_id).maybeSingle() : { data: null };
    const { data: formation } = devis.formation_id ? await sb.from("formations").select("reference, code_certification").eq("id", devis.formation_id).maybeSingle() : { data: null };
    // Référence affichée dans le tableau : référence de la formation, sinon « SUR-MESURE ».
    const ligneRef = (formation?.reference as string | undefined) || (devis.formation_id ? "" : "SUR-MESURE");
    const { data: orgRow } = await sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle();
    const org = (orgRow?.valeur ?? {}) as Record<string, string>;

    const rows = (lignes ?? []) as { designation: string; description: string | null; quantite: number; unite: string; prix_unitaire_ht: number }[];
    const totalHT = rows.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);
    const taux = devis.tva_exoneree ? 0 : Number(devis.tva_taux) || 0;
    const totalTVA = totalHT * (taux / 100);
    const totalTTC = totalHT + totalTVA;

    // ── PDF ──
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const A4: [number, number] = [595.28, 841.89];
    const W = A4[0], H = A4[1], M = 48;
    const brand = rgb(0.85, 0.30, 0.10);
    const ink = rgb(0.12, 0.12, 0.16);
    const muted = rgb(0.40, 0.40, 0.45);
    const line = rgb(0.82, 0.82, 0.85);
    const grayLight = rgb(0.95, 0.95, 0.96);
    const grayMid = rgb(0.88, 0.88, 0.90);
    let page = pdf.addPage(A4);

    const T = (s: string, x: number, yy: number, o: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; right?: number } = {}) => {
      const size = o.size ?? 9, f = o.f ?? font, c = clean(s);
      const xx = o.right != null ? o.right - f.widthOfTextAtSize(c, size) : x;
      page.drawText(c, { x: xx, y: yy, size, font: f, color: o.color ?? ink });
    };
    // Écrit un bloc multi-lignes à partir de (x, yTop), renvoie le y final.
    const block = (lines: string[], x: number, yTop: number, o: { size?: number; gap?: number; boldFirst?: boolean } = {}) => {
      const size = o.size ?? 9, gap = o.gap ?? 12.5; let yy = yTop;
      lines.filter(Boolean).forEach((l, i) => { T(l, x, yy, { size, f: i === 0 && o.boldFirst ? bold : font, color: i === 0 && o.boldFirst ? ink : muted }); yy -= gap; });
      return yy;
    };
    const wrap = (s: string, x: number, yTop: number, maxW: number, size = 9, f = font, color = ink) => {
      let yy = yTop;
      for (const para of clean(s).split("\n")) {
        let ln = "";
        for (const w of para.split(/\s+/)) {
          const test = ln ? ln + " " + w : w;
          if (f.widthOfTextAtSize(test, size) > maxW && ln) { T(ln, x, yy, { size, f, color }); yy -= size * 1.32; ln = w; }
          else ln = test;
        }
        T(ln, x, yy, { size, f, color }); yy -= size * 1.32;
      }
      return yy;
    };

    let y = H - M;

    // 1) Logo (haut gauche)
    let logoBottom = y;
    if (org.logo_url) {
      try {
        const r = await fetch(org.logo_url);
        if (r.ok) {
          const bytes = new Uint8Array(await r.arrayBuffer());
          const ct = (r.headers.get("content-type") ?? "").toLowerCase();
          const isPng = ct.includes("png") || org.logo_url.toLowerCase().includes(".png");
          const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const sc = Math.min(150 / img.width, 55 / img.height);
          const w = img.width * sc, h = img.height * sc;
          page.drawImage(img, { x: M, y: y - h, width: w, height: h });
          logoBottom = y - h - 14;
        }
      } catch { /* en-tête sans logo */ }
    }
    if (logoBottom === y) logoBottom = y - 6;

    // 2) Émetteur (gauche) / Client (droite)
    const colR = W / 2 + 12;
    const emit = [
      org.nom ?? "AISSOCIATE",
      org.adresse ?? "",
      [org.code_postal, org.ville].filter(Boolean).join(" "),
      org.telephone ? `Tél. ${org.telephone}` : "",
      org.email ?? "",
      // L'exonération de TVA figure déjà près des totaux et en pied : pas de doublon ici.
      org.tva_intra ? `N° TVA Intracommunautaire : ${org.tva_intra}` : "",
      org.siret ? `N° SIRET : ${org.siret}` : "",
      org.naf ? `Code NAF : ${org.naf}` : "",
      org.nda ? `Déclaration d'activité n° ${org.nda}` : "",
    ];
    const cName = contact ? `${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim() : "";
    const client = [
      entreprise?.raison_sociale ?? cName ?? "Client",
      entreprise && cName ? `À l'attention de ${cName}` : "",
      entreprise?.adresse ?? "",
      [entreprise?.code_postal, entreprise?.ville ?? contact?.ville].filter(Boolean).join(" "),
      entreprise?.siret ? `SIRET : ${entreprise.siret}` : "",
      contact?.email ?? "",
    ];
    const yEmit = block(emit, M, logoBottom, { boldFirst: true });
    const yCli = block(client, colR, logoBottom, { boldFirst: true });
    y = Math.min(yEmit, yCli) - 14;

    // 3) Titre + date
    T(`DEVIS N° ${devis.numero}`, M, y, { size: 16, f: bold }); y -= 14;
    T(frLong(devis.date_emission), M, y, { size: 8.5, color: muted }); y -= 6;
    if (financeur) { y -= 10; T(`Financeur pressenti : ${financeur.nom}`, M, y, { size: 9, f: bold, color: brand }); y -= 4; }
    if (devis.objet) { y -= 10; y = wrap(`Objet : ${devis.objet}`, M, y, W - 2 * M, 9, font, ink); }
    y -= 14;

    // 4) Tableau
    const cRefX = M + 4, cDesX = M + 70, cQtyR = W - M - 200, cPuR = W - M - 120, cTvaR = W - M - 64, cMtR = W - M - 4;
    page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 18, color: grayLight });
    T("Référence", cRefX, y, { size: 8.5, f: bold, color: muted });
    T("Désignation", cDesX, y, { size: 8.5, f: bold, color: muted });
    T("Quantité", cQtyR, y, { size: 8.5, f: bold, color: muted, right: cQtyR });
    T("PU HT", cPuR, y, { size: 8.5, f: bold, color: muted, right: cPuR });
    T("TVA", cTvaR, y, { size: 8.5, f: bold, color: muted, right: cTvaR });
    T("Montant HT", cMtR, y, { size: 8.5, f: bold, color: muted, right: cMtR });
    y -= 13; page.drawLine({ start: { x: M, y: y + 5 }, end: { x: W - M, y: y + 5 }, thickness: 0.6, color: line }); y -= 6;

    for (const l of rows) {
      if (y < M + 140) { page = pdf.addPage(A4); y = H - M; }
      const mt = (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0);
      const yTop = y;
      const desW = cQtyR - cDesX - 12;
      if (ligneRef) T(ligneRef, cRefX, yTop, { size: 8, color: muted });
      let yD = wrap(l.designation, cDesX, yTop, desW, 9, bold, ink);
      if (l.description) yD = wrap(l.description, cDesX, yD - 1, desW, 8.5, font, muted);
      // Quantité suivie de son unité (ex. « 14,00 h ») pour lever toute ambiguïté.
      const qteStr = `${Number(l.quantite).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}${l.unite ? " " + l.unite : ""}`;
      T(qteStr, cQtyR, yTop, { size: 9, right: cQtyR });
      T(eur(l.prix_unitaire_ht), cPuR, yTop, { size: 9, right: cPuR });
      T(taux ? `${taux} %` : "0,00", cTvaR, yTop, { size: 9, right: cTvaR });
      T(eur(mt), cMtR, yTop, { size: 9, right: cMtR });
      y = Math.min(yD, yTop - 14) - 4;
      page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.3, color: line });
    }
    y -= 18;

    // 5) Conditions (gauche) + Totaux (droite) — ancré en BAS de page (au-dessus
    //    des mentions légales), conformément au modèle demandé.
    if (y < M + 200) { page = pdf.addPage(A4); }
    const blockTop = M + 185;
    // Totaux
    const bx = W - M - 210, bw = 210;
    page.drawRectangle({ x: bx, y: blockTop - 36, width: bw, height: 36, color: grayLight });
    T("Total HT", bx + 12, blockTop - 13, { size: 9.5, f: bold, color: muted });
    T(eur(totalHT), cMtR, blockTop - 13, { size: 9.5, f: bold, right: cMtR });
    T(`TVA (${taux} %)`, bx + 12, blockTop - 28, { size: 9, color: muted });
    T(eur(totalTVA), cMtR, blockTop - 28, { size: 9, right: cMtR });
    page.drawRectangle({ x: bx, y: blockTop - 60, width: bw, height: 22, color: grayMid });
    T("Total TTC", bx + 12, blockTop - 54, { size: 11, f: bold });
    T(eur(totalTTC), cMtR, blockTop - 54, { size: 11, f: bold, right: cMtR });
    // Conditions
    let cy = blockTop;
    T("Conditions de paiement :", M, cy, { size: 8.5, f: bold, color: muted }); cy -= 13;
    if (devis.conditions) cy = wrap(devis.conditions, M, cy, bx - M - 16, 8, font, muted) - 2;
    T("Sous réserve d'acceptation du financeur.", M, cy, { size: 8, color: muted }); cy -= 12;
    T("Exonéré de TVA - art. 261-4-4° du CGI", M, cy, { size: 8, color: muted }); cy -= 16;
    T(`Devis valable jusqu'au ${frDate(devis.date_validite)}.`, M, cy, { size: 8, color: muted }); cy -= 20;
    T("Bon pour accord, le ..............................", M, cy, { size: 8, f: bold, color: ink }); cy -= 14;
    T("Signature (« lu et approuvé ») :", M, cy, { size: 8, f: bold, color: ink });

    // 6) Pied de page sur toutes les pages : identification organisme + mentions
    //    légales + pagination.
    const ident = [
      `${org.nom ?? "AISSOCIATE"} - ${org.forme_juridique ?? "SARL"} au capital de ${org.capital ?? "100 €"} - ${org.adresse ?? ""} ${[org.code_postal, org.ville].filter(Boolean).join(" ")}`,
      `Tél ${org.telephone ?? ""} - ${org.email ?? ""} - ${org.site_web ?? ""}`,
      `NDA ${org.nda ?? ""} DEETS La Réunion - RCS ${org.rcs ?? ""} - APE ${org.naf ?? ""}`,
    ].map(clean).filter((s) => s.replace(/[-\s]/g, "").length > 2);
    const legal = clean(
      "CLAUSE DE RÉSERVE DE PROPRIÉTÉ : Conformément à la loi 80-335 du 12 mai 1980, nous réservons la propriété des produits jusqu'au paiement intégral du prix. " +
      "Pénalité de retard : 3 fois le taux d'intérêt légal après la date d'échéance. Escompte pour règlement anticipé : néant. " +
      "Indemnité forfaitaire pour frais de recouvrement (art. L441-10 du Code de commerce) : 40 €.",
    );
    const allPages = pdf.getPages();
    allPages.forEach((p, i) => {
      // Mentions légales (réserve de propriété), tout en bas.
      let ly = M + 2;
      const words = legal.split(" ");
      const linesArr: string[] = []; let cur = "";
      for (const w of words) { const t = cur ? cur + " " + w : w; if (font.widthOfTextAtSize(t, 6) > W - 2 * M && cur) { linesArr.push(cur); cur = w; } else cur = t; }
      if (cur) linesArr.push(cur);
      for (let k = linesArr.length - 1; k >= 0; k--) { p.drawText(linesArr[k], { x: M, y: ly, size: 6, font, color: muted }); ly += 8; }
      // Identification de l'organisme, centrée, juste au-dessus.
      ly += 3;
      for (let k = ident.length - 1; k >= 0; k--) {
        const w = font.widthOfTextAtSize(ident[k], 7);
        p.drawText(ident[k], { x: Math.max(M, (W - w) / 2), y: ly, size: 7, font, color: ink });
        ly += 9.5;
      }
      p.drawLine({ start: { x: M, y: ly + 1 }, end: { x: W - M, y: ly + 1 }, thickness: 0.4, color: line });
      const pn = `Page ${i + 1} / ${allPages.length}`;
      p.drawText(pn, { x: W - M - font.widthOfTextAtSize(pn, 7), y: M - 8, size: 7, font, color: muted });
    });

    const bytes = await pdf.save();
    // Nom de fichier lisible : DEVIS_[numéro]_[AAAA-MM-JJ]_[client].
    const safe = (s: string) => clean(s).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
    const clientName = entreprise?.raison_sociale || cName || "client";
    const dateStr = (devis.date_emission ?? "").slice(0, 10) || frDate(null);
    const path = `DEVIS_${safe(devis.numero)}_${dateStr}_${safe(clientName)}.pdf`;
    const up = await sb.storage.from("devis").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error) return json({ error: `Storage: ${up.error.message}` }, 500);
    await sb.from("devis").update({ fichier_url: path, total_ht: totalHT, total_tva: totalTVA, total_ttc: totalTTC, updated_at: new Date().toISOString() }).eq("id", devisId);

    return json({ ok: true, numero: devis.numero, fichier_url: path });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

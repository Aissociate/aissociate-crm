// Supabase Edge Function — génération PDF d'un devis conforme (norme FR, HT).
// Récupère le devis + lignes + client + organisme, rend un PDF (pdf-lib),
// l'upload dans le bucket privé `devis` et enregistre `fichier_url`.
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
  return String(s ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[•·]/g, "-").replace(/ /g, " ").replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}
const eur = (n: number) => `${(Number(n) || 0).toFixed(2).replace(".", ",")} €`;
const frDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

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
    const { data: orgRow } = await sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle();
    const org = (orgRow?.valeur ?? {}) as Record<string, string>;

    const rows = (lignes ?? []) as { designation: string; description: string | null; quantite: number; unite: string; prix_unitaire_ht: number }[];
    const totalHT = rows.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);
    const taux = devis.tva_exoneree ? 0 : Number(devis.tva_taux) || 0;
    const totalTVA = totalHT * (taux / 100);
    const totalTTC = totalHT + totalTVA;

    // ── Rendu PDF ──
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const A4: [number, number] = [595.28, 841.89];
    const W = A4[0], H = A4[1], M = 48;
    const brand = rgb(0.917, 0.416, 0.118);
    const ink = rgb(0.13, 0.13, 0.18);
    const muted = rgb(0.42, 0.42, 0.47);
    const line = rgb(0.85, 0.85, 0.88);
    let page = pdf.addPage(A4);
    let y = H - M;

    const txt = (s: string, x: number, yy: number, o: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; right?: number } = {}) => {
      const size = o.size ?? 9.5, f = o.f ?? font, c = clean(s);
      const xx = o.right != null ? o.right - f.widthOfTextAtSize(c, size) : x;
      page.drawText(c, { x: xx, y: yy, size, font: f, color: o.color ?? ink });
    };
    const wrapTxt = (s: string, x: number, maxW: number, size = 9.5, f = font, color = ink) => {
      for (const para of clean(s).split("\n")) {
        let lineStr = "";
        for (const w of para.split(/\s+/)) {
          const test = lineStr ? lineStr + " " + w : w;
          if (f.widthOfTextAtSize(test, size) > maxW && lineStr) { txt(lineStr, x, y, { size, f, color }); y -= size * 1.35; lineStr = w; }
          else lineStr = test;
        }
        txt(lineStr, x, y, { size, f, color }); y -= size * 1.35;
      }
    };

    // Logo optionnel (haut gauche) — récupéré depuis l'URL du paramètre organisme.
    let logoH = 0;
    if (org.logo_url) {
      try {
        const r = await fetch(org.logo_url);
        if (r.ok) {
          const bytes = new Uint8Array(await r.arrayBuffer());
          const ct = (r.headers.get("content-type") ?? "").toLowerCase();
          const isPng = ct.includes("png") || org.logo_url.toLowerCase().includes(".png");
          const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const sc = Math.min(150 / img.width, 56 / img.height);
          const w = img.width * sc, h = img.height * sc;
          page.drawImage(img, { x: M, y: y - h, width: w, height: h });
          logoH = h + 8;
        }
      } catch { /* logo indisponible -> en-tête texte */ }
    }

    // En-tête : DEVIS (droite) + émetteur (gauche, sous le logo)
    txt("DEVIS", W - M, y, { size: 20, f: bold, color: ink, right: W - M });
    let yName = y - logoH;
    txt(org.nom ?? "Aissociate", M, yName, { size: 14, f: bold, color: brand });
    yName -= 16;
    const emit: string[] = [
      [org.forme_juridique, org.capital ? `au capital de ${org.capital}` : ""].filter(Boolean).join(" "),
      org.adresse ?? "", [org.code_postal, org.ville].filter(Boolean).join(" "),
      org.siret ? `SIRET : ${org.siret}` : "",
      org.nda ? `Déclaration d'activité n° ${org.nda}` : "",
      org.tva_intra ? `TVA intra : ${org.tva_intra}` : "TVA non applicable (art. 261-4-4° du CGI)",
      [org.email, org.telephone].filter(Boolean).join("  -  "),
    ].filter(Boolean);
    let yL = yName;
    for (const l of emit) { txt(l, M, yL, { size: 8.5, color: muted }); yL -= 12; }
    // Bloc droite : numéro + dates (sous le titre DEVIS)
    let yR = y - 22;
    txt(`N° ${devis.numero}`, W - M, yR, { size: 10, f: bold, right: W - M }); yR -= 14;
    txt(`Date : ${frDate(devis.date_emission)}`, W - M, yR, { size: 9, color: muted, right: W - M }); yR -= 12;
    txt(`Validité : ${frDate(devis.date_validite)}`, W - M, yR, { size: 9, color: muted, right: W - M }); yR -= 12;
    y = Math.min(yL, yR) - 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: brand }); y -= 20;

    // Client
    txt("CLIENT", M, y, { size: 9, f: bold, color: muted }); y -= 14;
    const cName = contact ? `${contact.prenom ?? ""} ${contact.nom ?? ""}`.trim() : "";
    const clientLines = [
      entreprise?.raison_sociale ?? cName,
      entreprise && cName ? `À l'attention de ${cName}` : "",
      entreprise?.adresse ?? contact?.adresse ?? "",
      [entreprise?.code_postal, entreprise?.ville ?? contact?.ville].filter(Boolean).join(" "),
      entreprise?.siret ? `SIRET : ${entreprise.siret}` : "",
      contact?.email ?? "",
    ].filter(Boolean);
    for (const l of clientLines) { txt(l, M, y, { size: 9.5 }); y -= 12; }
    if (financeur) { y -= 4; txt(`Financeur pressenti : ${financeur.nom}`, M, y, { size: 9, f: bold, color: brand }); y -= 14; }
    if (devis.objet) { y -= 4; txt("Objet :", M, y, { size: 9, f: bold }); y -= 12; wrapTxt(devis.objet, M, W - 2 * M, 9.5, font, ink); }
    y -= 8;

    // Tableau des prestations
    const cQty = W - M - 230, cPU = W - M - 120, cMt = W - M; // bornes droites des colonnes chiffrées
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 18, color: rgb(0.96, 0.96, 0.97) });
    txt("Désignation", M + 4, y, { size: 9, f: bold }); txt("Qté", cQty, y, { size: 9, f: bold, right: cQty }); txt("PU HT", cPU, y, { size: 9, f: bold, right: cPU }); txt("Montant HT", cMt, y, { size: 9, f: bold, right: cMt });
    y -= 18; page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: line });

    for (const l of rows) {
      if (y < M + 120) { page = pdf.addPage(A4); y = H - M; }
      const mt = (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0);
      const yStart = y;
      // Désignation (avec description optionnelle), colonne gauche large
      const desW = cQty - (M + 4) - 50;
      const ySave = y; wrapTxt(l.designation, M + 4, desW, 9.5, font, ink);
      if (l.description) wrapTxt(l.description, M + 4, desW, 8.5, font, muted);
      const yEnd = y; y = ySave;
      txt(`${Number(l.quantite)} ${l.unite ?? ""}`.trim(), cQty, yStart, { size: 9.5, right: cQty });
      txt(eur(l.prix_unitaire_ht), cPU, yStart, { size: 9.5, right: cPU });
      txt(eur(mt), cMt, yStart, { size: 9.5, right: cMt });
      y = Math.min(yEnd, yStart - 14);
      page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.3, color: line });
    }
    y -= 10;

    // Totaux (bloc à droite)
    const tx = W - M - 200;
    const totLine = (label: string, val: string, b = false) => {
      txt(label, tx, y, { size: b ? 10 : 9, f: b ? bold : font, color: b ? ink : muted });
      txt(val, cMt, y, { size: b ? 10 : 9, f: b ? bold : font, right: cMt });
      y -= b ? 16 : 13;
    };
    totLine("Total HT", eur(totalHT));
    if (devis.tva_exoneree) totLine("TVA", "Exonérée (art. 261-4-4° CGI)");
    else { totLine(`TVA ${taux} %`, eur(totalTVA)); }
    page.drawLine({ start: { x: tx, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.6, color: line });
    totLine(devis.tva_exoneree ? "Net à payer (HT)" : "Total TTC", eur(devis.tva_exoneree ? totalHT : totalTTC), true);
    y -= 8;

    // Conditions + validité
    if (devis.conditions) { txt("Conditions :", M, y, { size: 9, f: bold }); y -= 12; wrapTxt(devis.conditions, M, W - 2 * M, 8.5, font, muted); y -= 4; }
    txt(`Devis valable jusqu'au ${frDate(devis.date_validite)}.`, M, y, { size: 8.5, color: muted }); y -= 16;

    // Bon pour accord
    if (y < M + 80) { page = pdf.addPage(A4); y = H - M; }
    page.drawRectangle({ x: M, y: y - 56, width: 250, height: 58, borderColor: line, borderWidth: 0.8, color: rgb(1, 1, 1) });
    txt("Bon pour accord", M + 8, y - 14, { size: 9, f: bold });
    txt("Date :", M + 8, y - 30, { size: 8.5, color: muted });
    txt("Signature (précédée de la mention « lu et approuvé ») :", M + 8, y - 46, { size: 7.5, color: muted });

    // Pied de page : mentions légales sur toutes les pages
    const mentions = clean(`${org.nom ?? "Aissociate"}${org.siret ? ` - SIRET ${org.siret}` : ""}${org.nda ? ` - Déclaration d'activité n° ${org.nda} (ne vaut pas agrément de l'État)` : ""}${org.qualiopi ? ` - Qualiopi ${org.qualiopi}` : ""}`);
    const allPages = pdf.getPages();
    allPages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: M - 14 }, end: { x: W - M, y: M - 14 }, thickness: 0.5, color: line });
      const w = font.widthOfTextAtSize(mentions, 6.5);
      p.drawText(mentions.slice(0, 200), { x: M, y: M - 24, size: 6.5, font, color: muted });
      const pn = `Page ${i + 1} / ${allPages.length}`;
      p.drawText(pn, { x: W - M - font.widthOfTextAtSize(pn, 7), y: M - 24, size: 7, font, color: muted });
      void w;
    });

    const bytes = await pdf.save();
    const path = `${crypto.randomUUID()}-${clean(devis.numero).replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
    const up = await sb.storage.from("devis").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) return json({ error: `Storage: ${up.error.message}` }, 500);

    await sb.from("devis").update({ fichier_url: path, total_ht: totalHT, total_tva: totalTVA, total_ttc: totalTTC, updated_at: new Date().toISOString() }).eq("id", devisId);

    return json({ ok: true, numero: devis.numero, fichier_url: path });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

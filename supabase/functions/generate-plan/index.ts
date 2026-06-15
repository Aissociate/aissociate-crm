// Supabase Edge Function — génération IA d'un plan de formation + rendu PDF
// Tout est fait CÔTÉ SERVEUR : appel OpenRouter (clé jamais exposée au
// navigateur), rendu PDF (pdf-lib), upload dans le bucket privé `plans`,
// enregistrement dans plan_pdfs. Le navigateur n'a aucune dépendance PDF.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_PROMPT =
  "Tu es un ingénieur pédagogique. À partir des données JSON d'un plan de formation, " +
  "rédige un plan structuré et professionnel à présenter à un partenaire/financeur. " +
  "Réponds UNIQUEMENT par un objet JSON valide " +
  '{"titre": string, "sections": [{"titre": string, "contenu": string}]}. En français.';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Nettoie le texte pour l'encodage WinAnsi de pdf-lib (Helvetica)
function clean(s: string): string {
  return (s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

function parseContent(content: string): { titre: string; sections: { titre: string; contenu: string }[] } {
  const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
  let obj = tryParse(content);
  if (!obj) { const m = content.match(/\{[\s\S]*\}/); if (m) obj = tryParse(m[0]); }
  if (obj && Array.isArray(obj.sections)) return { titre: obj.titre ?? "Plan de formation", sections: obj.sections };
  return { titre: "Plan de formation", sections: [{ titre: "Plan de formation", contenu: content }] };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { plan, meta } = await req.json();
    if (!plan) return json({ error: "Données du plan manquantes" }, 400);
    const m = meta ?? {};

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Config IA
    const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
    const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
    const model = ai.model || "anthropic/claude-opus-4.8";
    const systemPrompt = ai.plan_prompt || DEFAULT_PROMPT;
    if (!apiKey) return json({ error: "Clé OpenRouter absente (secret OPENROUTER_API_KEY ou Paramètres > IA)" }, 400);

    // Organisme (en-tête)
    const { data: orgRow } = await sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle();
    const org = (orgRow?.valeur ?? {}) as Record<string, string>;

    // Contexte CLIENT complet (service role -> pas de RLS) : fiche contact entière,
    // entreprise, financeur, dossiers liés et historique de suivi. Permet à l'IA de
    // personnaliser le plan selon la situation réelle du client.
    let clientContext: Record<string, unknown> | null = null;
    if (m.contactId) {
      const { data: contact } = await sb.from("contacts").select("*").eq("id", m.contactId).maybeSingle();
      const entId = m.entrepriseId ?? contact?.entreprise_id ?? null;
      const finId = m.financeurId ?? contact?.financeur_id ?? null;
      const entreprise = entId ? (await sb.from("entreprises").select("*").eq("id", entId).maybeSingle()).data : null;
      const financeur = finId ? (await sb.from("financeurs").select("*").eq("id", finId).maybeSingle()).data : null;
      const { data: dossiers } = await sb.from("dossiers").select("*").eq("contact_id", m.contactId);
      const { data: actions } = await sb.from("contact_actions").select("*").eq("contact_id", m.contactId).order("date_action", { ascending: false }).limit(30);
      clientContext = { contact, entreprise, financeur, dossiers: dossiers ?? [], historique_suivi: actions ?? [] };
    }

    // Message utilisateur : données du plan + contexte client total.
    const userContent = [
      "Données du plan de formation (JSON) :\n" + JSON.stringify(plan),
      clientContext
        ? "Contexte client complet (JSON) — prends-le pleinement en compte pour personnaliser le plan (situation, besoins, entreprise, financement, dossiers, historique de suivi) :\n" + JSON.stringify(clientContext)
        : "",
    ].filter(Boolean).join("\n\n");

    // 1) Génération du contenu
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aissociate.crm",
        "X-Title": "CRM Formation AIssociate",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt +
              " Mets en forme le champ 'contenu' de chaque section en Markdown : sous-titres avec ## , listes à puces avec - , listes numérotées avec 1. , **gras** pour les points clés, et une ligne vide entre les paragraphes.",
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
      }),
    });
    if (!resp.ok) return json({ error: `OpenRouter ${resp.status}: ${(await resp.text()).slice(0, 300)}` }, 502);
    const data = await resp.json();
    const { titre, sections } = parseContent(data?.choices?.[0]?.message?.content ?? "");

    // 2) Rendu PDF (pdf-lib) — moteur Markdown + mise en page soignée
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const A4: [number, number] = [595.28, 841.89];
    const W = A4[0], H = A4[1], M = 50;
    const brand = rgb(0.917, 0.416, 0.118);
    const ink = rgb(0.13, 0.13, 0.18);
    const muted = rgb(0.42, 0.42, 0.47);
    const ruleCol = rgb(0.88, 0.88, 0.9);

    let page = pdf.addPage(A4);
    let y = H - M;
    const needSpace = (h: number) => { if (y - h < M + 26) { page = pdf.addPage(A4); y = H - M; } };

    type RichOpts = { size: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number; allBold?: boolean };
    // Dessine une ligne avec gras en ligne (**...**), retour à la ligne et indentation.
    const drawRich = (raw: string, o: RichOpts) => {
      const size = o.size, color = o.color ?? ink, indent = o.indent ?? 0;
      const x0 = M + indent, maxW = W - M - x0;
      const runs: { text: string; bold: boolean }[] = [];
      let b = false;
      for (const part of clean(raw).split("**")) { if (part) runs.push({ text: part, bold: o.allBold ? true : b }); b = !b; }
      const words: { t: string; bold: boolean; sp: boolean }[] = [];
      for (const r of runs) for (const seg of r.text.split(/(\s+)/)) if (seg) words.push({ t: seg, bold: r.bold, sp: /^\s+$/.test(seg) });
      let cur: typeof words = [], curW = 0;
      const flush = () => {
        if (y - size < M + 24) { page = pdf.addPage(A4); y = H - M; }
        while (cur.length && cur[0].sp) cur.shift();
        while (cur.length && cur[cur.length - 1].sp) cur.pop();
        let x = x0;
        for (const w of cur) { const f = w.bold ? bold : font; page.drawText(w.t, { x, y, size, font: f, color }); x += f.widthOfTextAtSize(w.t, size); }
        y -= size * 1.45; cur = []; curW = 0;
      };
      for (const w of words) { const f = w.bold ? bold : font; const ww = f.widthOfTextAtSize(w.t, size); if (!w.sp && curW + ww > maxW && cur.length) flush(); cur.push(w); curW += ww; }
      if (cur.length) flush();
      if (o.gap) y -= o.gap;
    };

    // Rendu d'un bloc Markdown : titres (#), listes (-/1.), règles, tableaux, paragraphes.
    const renderMd = (text: string) => {
      for (const line of clean(text).split("\n")) {
        const l = line.replace(/\s+$/, "");
        if (!l.trim()) { y -= 5; continue; }
        if (/^([-*_])\1{2,}$/.test(l.trim())) { needSpace(12); y -= 2; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: ruleCol }); y -= 10; continue; }
        const h = l.match(/^\s*(#{1,4})\s+(.*)$/);
        if (h) { const sz = h[1].length <= 1 ? 13 : h[1].length === 2 ? 12 : 11; needSpace(sz + 12); y -= 4; drawRich(h[2], { size: sz, color: brand, allBold: true, gap: 3 }); continue; }
        const bl = l.match(/^\s*[-*]\s+(.*)$/);
        if (bl) { needSpace(16); page.drawText("-", { x: M + 8, y, size: 10.5, font: bold, color: brand }); drawRich(bl[1], { size: 10.5, indent: 20 }); continue; }
        const nb = l.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (nb) { needSpace(16); page.drawText(nb[1] + ".", { x: M + 6, y, size: 10.5, font: bold, color: brand }); drawRich(nb[2], { size: 10.5, indent: 24 }); continue; }
        if (/^\s*\|.*\|\s*$/.test(l)) { if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) continue; const cells = l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean); needSpace(15); drawRich(cells.join("   |   "), { size: 10, color: muted }); continue; }
        needSpace(14); drawRich(l, { size: 10.5, gap: 2 });
      }
    };

    // ── En-tête : bandeau de marque ──
    const bandH = 62;
    page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: brand });
    page.drawText(clean(org.nom ?? "Organisme de formation"), { x: M, y: H - 34, size: 17, font: bold, color: rgb(1, 1, 1) });
    const orgSub = [org.qualiopi ? `Qualiopi ${org.qualiopi}` : "", org.email ?? "", org.telephone ?? ""].filter(Boolean).join("    ");
    if (orgSub) page.drawText(clean(orgSub), { x: M, y: H - 50, size: 9, font, color: rgb(1, 1, 1) });
    y = H - bandH - 30;

    // ── Titre + métadonnées ──
    drawRich(titre, { size: 20, color: rgb(0.08, 0.08, 0.12), allBold: true });
    y -= 2; page.drawLine({ start: { x: M, y }, end: { x: M + 96, y }, thickness: 2.5, color: brand }); y -= 16;
    for (const ml of [
      m.apprenant ? `Apprenant : ${m.apprenant}` : "",
      m.organismePartenaire ? `Partenaire : ${m.organismePartenaire}` : "",
      `Date : ${new Date().toLocaleDateString("fr-FR")}`,
    ].filter(Boolean)) drawRich(clean(ml as string), { size: 10, color: muted });
    y -= 12;

    // ── Sections ──
    for (const s of sections) {
      needSpace(70); // éviter un titre de section orphelin en bas de page
      y -= 6;
      page.drawRectangle({ x: M, y: y - 2, width: 3.5, height: 14, color: brand });
      drawRich(s.titre ?? "", { size: 13.5, color: rgb(0.08, 0.08, 0.12), allBold: true, indent: 11 });
      y -= 1; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: ruleCol }); y -= 12;
      renderMd(s.contenu ?? "");
      y -= 10;
    }

    // ── Pied de page sur toutes les pages (avec total) ──
    const allPages = pdf.getPages();
    const total = allPages.length;
    allPages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: M - 10 }, end: { x: W - M, y: M - 10 }, thickness: 0.6, color: ruleCol });
      p.drawText(clean(org.nom ?? ""), { x: M, y: M - 22, size: 8, font, color: muted });
      const pn = `Page ${i + 1} / ${total}`;
      p.drawText(pn, { x: W - M - font.widthOfTextAtSize(pn, 8), y: M - 22, size: 8, font, color: muted });
    });

    const bytes = await pdf.save();

    // 3) Upload + enregistrement
    const safe = clean(titre).replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40).toLowerCase() || "plan";
    const path = `${crypto.randomUUID()}-${safe}.pdf`;
    const up = await sb.storage.from("plans").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) return json({ error: `Storage: ${up.error.message}` }, 500);

    const { error: insErr } = await sb.from("plan_pdfs").insert({
      plan_id: m.planId ?? null,
      titre,
      apprenant: m.apprenant ?? null,
      organisme: m.organismePartenaire ?? org.nom ?? null,
      fichier_url: path,
      created_by: m.userId ?? null,
    });
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ ok: true, titre });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

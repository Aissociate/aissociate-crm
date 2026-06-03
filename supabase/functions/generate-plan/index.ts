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
    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key;
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
      }),
    });
    if (!resp.ok) return json({ error: `OpenRouter ${resp.status}: ${(await resp.text()).slice(0, 300)}` }, 502);
    const data = await resp.json();
    const { titre, sections } = parseContent(data?.choices?.[0]?.message?.content ?? "");

    // 2) Rendu PDF (pdf-lib, pur JS)
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const A4: [number, number] = [595.28, 841.89];
    const M = 48;
    const brand = rgb(0.917, 0.416, 0.118);
    let page = pdf.addPage(A4);
    let y = A4[1] - M;

    const wrap = (text: string, f: typeof font, size: number, maxW: number): string[] => {
      const out: string[] = [];
      for (const para of clean(text).split("\n")) {
        const words = para.split(/\s+/); let line = "";
        for (const w of words) {
          const test = line ? line + " " + w : w;
          if (f.widthOfTextAtSize(test, size) > maxW && line) { out.push(line); line = w; }
          else line = test;
        }
        out.push(line);
      }
      return out;
    };
    const draw = (text: string, opts: { f: typeof font; size: number; color?: ReturnType<typeof rgb>; gap?: number }) => {
      const maxW = A4[0] - 2 * M;
      for (const line of wrap(text, opts.f, opts.size, maxW)) {
        if (y < M + opts.size) { page = pdf.addPage(A4); y = A4[1] - M; }
        page.drawText(line, { x: M, y, size: opts.size, font: opts.f, color: opts.color ?? rgb(0.16, 0.16, 0.2) });
        y -= opts.size * 1.4;
      }
    };

    // En-tête
    draw(org.nom ?? "Organisme de formation", { f: bold, size: 16, color: brand });
    const sub = [org.qualiopi ? `Qualiopi ${org.qualiopi}` : "", org.email ?? "", org.telephone ?? ""].filter(Boolean).join("   ");
    if (sub) draw(sub, { f: font, size: 9, color: rgb(0.43, 0.43, 0.43) });
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 1.5, color: brand }); y -= 22;

    // Titre + métadonnées
    draw(titre, { f: bold, size: 18, color: rgb(0.08, 0.08, 0.12) }); y -= 4;
    const metaLines = [
      m.apprenant ? `Apprenant : ${m.apprenant}` : "",
      m.organismePartenaire ? `Organisme / partenaire : ${m.organismePartenaire}` : "",
      `Date : ${new Date().toLocaleDateString("fr-FR")}`,
    ].filter(Boolean);
    for (const ml of metaLines) draw(ml, { f: font, size: 10, color: rgb(0.35, 0.35, 0.35) });
    y -= 12;

    // Sections
    for (const s of sections) {
      if (y < M + 40) { page = pdf.addPage(A4); y = A4[1] - M; }
      draw(s.titre ?? "", { f: bold, size: 13, color: brand });
      draw(s.contenu ?? "", { f: font, size: 10.5 }); y -= 10;
    }

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

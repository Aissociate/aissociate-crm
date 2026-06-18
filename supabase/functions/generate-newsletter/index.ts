// Supabase Edge Function — Newsletter hebdomadaire.
// - action 'generate' (défaut) : compile les articles de blog publiés la
//   semaine écoulée, rédige un éditorial (OpenRouter), génère une image
//   d'en-tête (Kie.ai Seedream), construit un e-mail HTML soigné et enregistre
//   l'édition. Brouillon par défaut ; envoyée directement si auto_send.
// - action 'send' : envoie une édition existante (brouillon) à toute la base
//   en BCC (par lots), via la fonction send-email.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const SITE_URL = "https://aissociate.re";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Article = { title: string; slug: string; excerpt: string; image_url: string | null; published_at: string | null };

// Image d'en-tête via Kie.ai — Seedream 5.0 Lite (création de tâche + polling).
async function generateImageKie(apiKey: string, quality: "basic" | "high", aspectRatio: string, prompt: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
  try {
    const create = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "seedream/5-lite-text-to-image",
        input: {
          prompt: `Bannière de newsletter professionnelle et moderne, sans texte, sur le thème : ${prompt}. Style éditorial, ambiance technologie / IA, couleurs chaleureuses (orange/ambre), haute qualité.`.slice(0, 3000),
          aspect_ratio: aspectRatio, quality, nsfw_checker: false,
        },
      }),
    });
    const cj = await create.json().catch(() => null);
    const taskId = cj?.data?.taskId;
    if (!create.ok || !taskId) return null;
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const q = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: { "Authorization": `Bearer ${apiKey}` } });
      const qj = await q.json().catch(() => null);
      const state = qj?.data?.state;
      if (state === "fail") return null;
      if (state === "success") {
        let url: string | null = null;
        try { url = JSON.parse(qj.data.resultJson || "{}")?.resultUrls?.[0] ?? null; } catch { /* */ }
        if (!url) return null;
        const imgRes = await fetch(url);
        if (!imgRes.ok) return null;
        return { mime: imgRes.headers.get("content-type") || "image/jpeg", bytes: new Uint8Array(await imgRes.arrayBuffer()) };
      }
    }
    return null;
  } catch { return null; }
}

// Gabarit e-mail responsive (tables + styles inline, contraintes clients mail).
function buildHtml(opts: { senderName: string; intro: string; headerImage: string | null; articles: Article[]; periodeLabel: string }): string {
  const { senderName, intro, headerImage, articles, periodeLabel } = opts;
  const brand = "#ea6a1e";
  const cards = articles.map((a) => {
    const link = `${SITE_URL}/blog/${a.slug}`;
    const img = a.image_url
      ? `<tr><td style="padding:0;"><a href="${esc(link)}" target="_blank"><img src="${esc(a.image_url)}" alt="${esc(a.title)}" width="560" style="width:100%;max-width:560px;height:auto;border-radius:10px 10px 0 0;display:block;"></a></td></tr>`
      : "";
    return `
    <tr><td style="padding:0 0 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border:1px solid #e8e8ee;border-radius:12px;overflow:hidden;">
        ${img}
        <tr><td style="padding:20px 24px;">
          <h2 style="margin:0 0 8px;font-size:19px;line-height:1.3;color:#15151f;font-family:Arial,Helvetica,sans-serif;">${esc(a.title)}</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#55555f;font-family:Arial,Helvetica,sans-serif;">${esc(a.excerpt).slice(0, 220)}</p>
          <a href="${esc(link)}" target="_blank" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 20px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">Lire l'article →</a>
        </td></tr>
      </table>
    </td></tr>`;
  }).join("");

  const header = headerImage
    ? `<tr><td style="padding:0;"><img src="${esc(headerImage)}" alt="" width="600" style="width:100%;max-width:600px;height:auto;display:block;border-radius:14px 14px 0 0;"></td></tr>`
    : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Newsletter ${esc(senderName)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f8;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
      <tr><td style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e8ee;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${header}
          <tr><td style="padding:28px 28px 8px;">
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${brand};font-weight:bold;font-family:Arial,Helvetica,sans-serif;">Newsletter · ${esc(periodeLabel)}</p>
            <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#15151f;font-family:Arial,Helvetica,sans-serif;">L'actualité IA de la semaine</h1>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#44444f;font-family:Arial,Helvetica,sans-serif;">${esc(intro)}</p>
          </td></tr>
          <tr><td style="padding:22px 28px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${cards}</table>
          </td></tr>
          <tr><td style="padding:8px 28px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#fff7ef;border:1px solid #f6d8bd;border-radius:12px;">
              <tr><td style="padding:20px 24px;text-align:center;">
                <p style="margin:0 0 12px;font-size:15px;color:#15151f;font-family:Arial,Helvetica,sans-serif;">Une formation IA vous intéresse ? Financements CPF / OPCO disponibles.</p>
                <a href="${SITE_URL}/formations" target="_blank" style="display:inline-block;background:${brand};color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 22px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">Voir nos formations</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 28px;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:#9a9aa5;font-family:Arial,Helvetica,sans-serif;">${esc(senderName)} — Organisme de formation IA certifié Qualiopi · La Réunion</p>
        <p style="margin:0;font-size:12px;color:#9a9aa5;font-family:Arial,Helvetica,sans-serif;"><a href="${SITE_URL}" style="color:#9a9aa5;">${SITE_URL.replace("https://", "")}</a> · Vous recevez cet e-mail en tant que contact d'Aissociate.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Récupère les destinataires (contacts avec e-mail, RGPD optionnel), dédupliqués.
async function recipients(sb: ReturnType<typeof createClient>, rgpdOnly: boolean): Promise<string[]> {
  let q = sb.from("contacts").select("email, rgpd_consent").not("email", "is", null);
  if (rgpdOnly) q = q.eq("rgpd_consent", true);
  const { data } = await q;
  const set = new Set<string>();
  for (const c of (data ?? [])) {
    const e = String((c as { email?: string }).email ?? "").trim().toLowerCase();
    if (e && /.+@.+\..+/.test(e)) set.add(e);
  }
  return [...set];
}

// Envoie une édition à toute la base, en BCC par lots, via send-email.
async function sendEdition(sb: ReturnType<typeof createClient>, SUPABASE_URL: string, SERVICE: string, edition: { id: string; sujet: string; contenu_html: string }, rgpdOnly: boolean): Promise<{ sent: number }> {
  const list = await recipients(sb, rgpdOnly);
  let sent = 0;
  for (let i = 0; i < list.length; i += 90) {
    const batch = list.slice(i, i + 90);
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE}` },
      body: JSON.stringify({ bcc: batch, subject: edition.sujet, html: edition.contenu_html }),
    });
    if (r.ok) sent += batch.length;
  }
  await sb.from("newsletters").update({ statut: "envoye", sent_at: new Date().toISOString(), recipients_count: sent }).eq("id", edition.id);
  return { sent };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({})) as { action?: string; newsletterId?: string };
    const action = body.action ?? "generate";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE);

    const { data: nlRow } = await sb.from("parametres").select("valeur").eq("cle", "newsletter").maybeSingle();
    const cfg = (nlRow?.valeur ?? {}) as { auto_send?: boolean; rgpd_only?: boolean; sender_name?: string; intro?: string };
    const rgpdOnly = cfg.rgpd_only !== false;

    // — Envoi d'une édition existante —
    if (action === "send") {
      if (!body.newsletterId) return json({ error: "newsletterId requis" }, 400);
      const { data: ed } = await sb.from("newsletters").select("id, sujet, contenu_html, statut").eq("id", body.newsletterId).maybeSingle();
      if (!ed) return json({ error: "Édition introuvable" }, 404);
      const { sent } = await sendEdition(sb, SUPABASE_URL, SERVICE, ed as { id: string; sujet: string; contenu_html: string }, rgpdOnly);
      return json({ ok: true, sent });
    }

    // — Génération d'une édition —
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { data: arts } = await sb.from("blog_articles")
      .select("title, slug, excerpt, image_url, published_at")
      .eq("published", true)
      .gte("published_at", since.toISOString())
      .order("published_at", { ascending: false })
      .limit(12);
    const articles = (arts ?? []) as Article[];
    if (!articles.length) {
      return json({ ok: false, skipped: true, reason: "Aucun article publié sur les 7 derniers jours." });
    }

    // Éditorial (OpenRouter, facultatif).
    let intro = "Voici les actualités et ressources IA que nous avons publiées cette semaine.";
    try {
      const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
      const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
      const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
      if (apiKey) {
        const model = ai.model || "anthropic/claude-opus-4.8";
        const liste = articles.map((a) => `- ${a.title}`).join("\n");
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://aissociate.crm", "X-Title": "CRM Formation AIssociate" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: cfg.intro || "Rédige une courte introduction de newsletter en français (2-3 phrases)." },
              { role: "user", content: `Articles publiés cette semaine :\n${liste}\n\nRédige l'introduction (texte seul).` },
            ],
            temperature: 0.6,
          }),
        });
        if (resp.ok) {
          const d = await resp.json();
          const txt = (d?.choices?.[0]?.message?.content as string)?.trim();
          if (txt) intro = txt.replace(/^["']|["']$/g, "");
        }
      }
    } catch { /* éditorial facultatif */ }

    // Image d'en-tête via Kie.ai (config dans le paramètre blog), sinon 1ère image d'article.
    let headerImage: string | null = articles.find((a) => a.image_url)?.image_url ?? null;
    try {
      const { data: blogRow } = await sb.from("parametres").select("valeur").eq("cle", "blog").maybeSingle();
      const blog = (blogRow?.valeur ?? {}) as { kie_api_key?: string; kie_quality?: string; kie_aspect_ratio?: string };
      const kieKey = (Deno.env.get("KIE_API_KEY") || blog.kie_api_key || "").trim();
      if (kieKey) {
        const img = await generateImageKie(kieKey, blog.kie_quality === "high" ? "high" : "basic", blog.kie_aspect_ratio || "16:9", articles[0].title);
        if (img) {
          const ext = img.mime.includes("png") ? "png" : img.mime.includes("webp") ? "webp" : "jpg";
          const path = `newsletter/${crypto.randomUUID()}.${ext}`;
          const up = await sb.storage.from("blog").upload(path, img.bytes, { contentType: img.mime, upsert: false });
          if (!up.error) headerImage = sb.storage.from("blog").getPublicUrl(path).data.publicUrl;
        }
      }
    } catch { /* image facultative */ }

    const fin = new Date();
    const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    const periodeLabel = `${fmt(since)} – ${fmt(fin)}`;
    const senderName = cfg.sender_name || "Aissociate";
    const sujet = `📰 ${senderName} — L'actu IA de la semaine (${periodeLabel})`;
    const html = buildHtml({ senderName, intro, headerImage, articles, periodeLabel });

    const auto = cfg.auto_send === true;
    const { data: ins, error } = await sb.from("newsletters").insert({
      sujet, contenu_html: html, image_url: headerImage,
      periode_debut: since.toISOString().slice(0, 10), periode_fin: fin.toISOString().slice(0, 10),
      statut: "brouillon", recipients_count: 0,
    }).select("id, sujet, contenu_html").maybeSingle();
    if (error || !ins) return json({ error: error?.message ?? "Échec d'enregistrement" }, 500);

    let sent = 0;
    if (auto) ({ sent } = await sendEdition(sb, SUPABASE_URL, SERVICE, ins as { id: string; sujet: string; contenu_html: string }, rgpdOnly));

    return json({ ok: true, id: (ins as { id: string }).id, articles: articles.length, statut: auto ? "envoye" : "brouillon", sent });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

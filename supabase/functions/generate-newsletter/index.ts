// Supabase Edge Function — Newsletter hebdomadaire.
// - action 'generate' (défaut) : compile les articles de blog publiés la
//   semaine écoulée, rédige un éditorial (OpenRouter), génère une image
//   d'en-tête (Kie.ai Seedream), construit un e-mail HTML soigné et enregistre
//   l'édition. Brouillon par défaut ; envoyée directement si auto_send.
// - action 'send' : envoie une édition existante (brouillon) à toute la base
//   en BCC (par lots), via l'API transactionnelle Brevo (clé : secret
//   BREVO_API_KEY ou Paramètres → Brevo).
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
        <p style="margin:0 0 6px;font-size:12px;color:#9a9aa5;font-family:Arial,Helvetica,sans-serif;"><a href="${SITE_URL}" style="color:#9a9aa5;">${SITE_URL.replace("https://", "")}</a> · Vous recevez cet e-mail en tant que contact d'Aissociate.</p>
        <p style="margin:0;font-size:12px;color:#9a9aa5;font-family:Arial,Helvetica,sans-serif;"><a href="{{UNSUBSCRIBE_URL}}" style="color:#9a9aa5;text-decoration:underline;">Se désinscrire de la newsletter</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Destinataires (contacts avec e-mail, RGPD optionnel), HORS désinscrits, dédupliqués.
async function recipients(sb: ReturnType<typeof createClient>, rgpdOnly: boolean): Promise<string[]> {
  let q = sb.from("contacts").select("email, rgpd_consent").not("email", "is", null).eq("newsletter_unsubscribed", false);
  if (rgpdOnly) q = q.eq("rgpd_consent", true);
  const { data } = await q;
  const set = new Set<string>();
  for (const c of (data ?? [])) {
    const e = String((c as { email?: string }).email ?? "").trim().toLowerCase();
    if (e && /.+@.+\..+/.test(e)) set.add(e);
  }
  return [...set];
}

// Lien de désinscription personnalisé (jeton par contact), via la fonction publique.
const unsubUrl = (sbUrl: string, token: string) => `${sbUrl}/functions/v1/newsletter-unsubscribe?t=${token}`;

// Map e-mail (minuscule) -> jeton de désinscription, pour les contacts NON désinscrits.
async function tokenMap(sb: ReturnType<typeof createClient>): Promise<Map<string, string>> {
  const { data } = await sb.from("contacts").select("email, unsubscribe_token").not("email", "is", null).eq("newsletter_unsubscribed", false);
  const m = new Map<string, string>();
  for (const c of (data ?? []) as { email?: string; unsubscribe_token?: string }[]) {
    const e = String(c.email ?? "").trim().toLowerCase();
    if (e && c.unsubscribe_token) m.set(e, c.unsubscribe_token);
  }
  return m;
}

// Verrou anti-concurrence du drain (UPDATE conditionnel atomique).
async function acquireDrainLock(sb: ReturnType<typeof createClient>): Promise<boolean> {
  const now = new Date().toISOString();
  const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data } = await sb.from("newsletter_drain_lock").update({ locked_until: until })
    .eq("id", 1).or(`locked_until.is.null,locked_until.lt.${now}`).select("id");
  return (data?.length ?? 0) > 0;
}
async function releaseDrainLock(sb: ReturnType<typeof createClient>): Promise<void> {
  await sb.from("newsletter_drain_lock").update({ locked_until: null }).eq("id", 1);
}

type BrevoCfg = { apiKey: string; senderEmail: string; senderName: string };

// Envoie un lot via l'API Brevo avec personnalisation par destinataire
// (messageVersions) : chacun reçoit son propre lien de désinscription.
async function brevoSendBatch(brevo: BrevoCfg, subject: string, baseHtml: string, items: { email: string; token: string }[], sbUrl: string): Promise<{ ok: boolean; err?: string }> {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": brevo.apiKey, "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify({
      sender: { name: brevo.senderName, email: brevo.senderEmail },
      subject,
      htmlContent: baseHtml.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, SITE_URL),
      messageVersions: items.map((it) => ({
        to: [{ email: it.email }],
        htmlContent: baseHtml.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl(sbUrl, it.token)),
      })),
    }),
  });
  return r.ok ? { ok: true } : { ok: false, err: `Brevo ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}` };
}

// E-mails déjà envoyés aujourd'hui (toutes éditions) — quota Brevo/jour partagé.
async function sentTodayCount(sb: ReturnType<typeof createClient>): Promise<number> {
  const startOfDay = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").toISOString();
  const { count } = await sb.from("newsletter_queue").select("id", { count: "exact", head: true })
    .eq("status", "sent").gte("sent_at", startOfDay);
  return count ?? 0;
}

// Met à jour le statut d'une édition selon l'état de sa file (en_cours/envoye).
async function updateNlStatut(sb: ReturnType<typeof createClient>, nlId: string): Promise<void> {
  const { count: pending } = await sb.from("newsletter_queue").select("id", { count: "exact", head: true }).eq("newsletter_id", nlId).eq("status", "pending");
  const { count: sentC } = await sb.from("newsletter_queue").select("id", { count: "exact", head: true }).eq("newsletter_id", nlId).eq("status", "sent");
  const done = (pending ?? 0) === 0;
  await sb.from("newsletters").update({
    statut: done ? "envoye" : "en_cours",
    recipients_count: sentC ?? 0,
    ...(done && (sentC ?? 0) > 0 ? { sent_at: new Date().toISOString() } : {}),
  }).eq("id", nlId);
}

// Draine la file dans la limite du quota du jour (plafond Brevo global au compte),
// FIFO par created_at, par lots de 90, en regroupant par édition. Sérialisé par
// verrou, avec jeton de désinscription par destinataire et retry borné (3).
async function drainQueue(sb: ReturnType<typeof createClient>, brevo: BrevoCfg, dailyLimit: number, sbUrl: string): Promise<{ sent: number; remaining: number }> {
  if (!brevo.apiKey || !brevo.senderEmail) return { sent: 0, remaining: 0 };
  if (!(await acquireDrainLock(sb))) return { sent: 0, remaining: 0 };
  try {
    const remaining = Math.max(0, dailyLimit - await sentTodayCount(sb));
    if (remaining <= 0) return { sent: 0, remaining: 0 };
    const { data: pend } = await sb.from("newsletter_queue")
      .select("id, newsletter_id, email, retry_count").eq("status", "pending").order("created_at", { ascending: true }).limit(remaining);
    const rows = (pend ?? []) as { id: string; newsletter_id: string; email: string; retry_count: number }[];
    if (!rows.length) return { sent: 0, remaining };
    const tokens = await tokenMap(sb);

    const byNl = new Map<string, typeof rows>();
    for (const r of rows) { const a = byNl.get(r.newsletter_id) ?? []; a.push(r); byNl.set(r.newsletter_id, a); }

    let sent = 0;
    const nowIso = new Date().toISOString();
    for (const [nlId, items] of byNl) {
      const { data: ed } = await sb.from("newsletters").select("sujet, contenu_html").eq("id", nlId).maybeSingle();
      if (!ed) continue;
      const e = ed as { sujet: string; contenu_html: string };
      for (let i = 0; i < items.length; i += 90) {
        const batch = items.slice(i, i + 90);
        // Désinscrits/supprimés depuis la mise en file : retirés sans envoi.
        const valid = batch.filter((b) => tokens.has(b.email));
        const skipped = batch.filter((b) => !tokens.has(b.email));
        if (skipped.length) await sb.from("newsletter_queue").update({ status: "failed", error: "exclu (désinscrit/supprimé)" }).in("id", skipped.map((s) => s.id));
        if (!valid.length) continue;
        const res = await brevoSendBatch(brevo, e.sujet, e.contenu_html, valid.map((v) => ({ email: v.email, token: tokens.get(v.email)! })), sbUrl);
        if (res.ok) {
          await sb.from("newsletter_queue").update({ status: "sent", sent_at: nowIso }).in("id", valid.map((v) => v.id));
          sent += valid.length;
        } else {
          // Retry : +1 ; après 3 échecs → « failed » (ne bloque plus la file).
          const byRetry = new Map<number, string[]>();
          for (const v of valid) { const rc = v.retry_count ?? 0; const a = byRetry.get(rc) ?? []; a.push(v.id); byRetry.set(rc, a); }
          for (const [rc, ids] of byRetry) {
            const next = rc + 1;
            await sb.from("newsletter_queue").update(next >= 3 ? { status: "failed", error: res.err, retry_count: next } : { error: res.err, retry_count: next }).in("id", ids);
          }
        }
      }
      await updateNlStatut(sb, nlId);
    }
    return { sent, remaining };
  } finally {
    await releaseDrainLock(sb);
  }
}

// Met une édition en file (tous ses destinataires) puis envoie l'allocation du
// jour. Garde-fou : refuse si la base dépasse dailyLimit * 7 (300×7 par défaut).
async function enqueueAndDrain(
  sb: ReturnType<typeof createClient>, nlId: string, rgpdOnly: boolean, brevo: BrevoCfg, dailyLimit: number, sbUrl: string,
): Promise<{ total?: number; sentNow?: number; queued?: number; days?: number; error?: string }> {
  if (!brevo.apiKey || !brevo.senderEmail) return { error: "Configuration Brevo incomplète (Paramètres → Brevo)." };
  const list = await recipients(sb, rgpdOnly);
  if (!list.length) return { error: "Aucun destinataire (contacts avec e-mail, hors désinscrits)." };
  const cap = dailyLimit * 7;
  if (list.length > cap) {
    return { error: `Trop de destinataires (${list.length}) : dépasse le plafond de ${cap} (${dailyLimit} × 7 jours). Réduisez la base ou augmentez le quota Brevo.` };
  }
  const toInsert = list.map((email) => ({ newsletter_id: nlId, email, status: "pending" }));
  for (let i = 0; i < toInsert.length; i += 500) {
    await sb.from("newsletter_queue").upsert(toInsert.slice(i, i + 500), { onConflict: "newsletter_id,email", ignoreDuplicates: true });
  }
  await drainQueue(sb, brevo, dailyLimit, sbUrl);
  await updateNlStatut(sb, nlId);
  const { count: nlSent } = await sb.from("newsletter_queue").select("id", { count: "exact", head: true }).eq("newsletter_id", nlId).eq("status", "sent");
  const { count: nlPending } = await sb.from("newsletter_queue").select("id", { count: "exact", head: true }).eq("newsletter_id", nlId).eq("status", "pending");
  return { total: list.length, sentNow: nlSent ?? 0, queued: nlPending ?? 0, days: Math.ceil(list.length / dailyLimit) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({})) as { action?: string; newsletterId?: string; api_key?: string; sender_email?: string };
    const action = body.action ?? "generate";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE);

    const { data: nlRow } = await sb.from("parametres").select("valeur").eq("cle", "newsletter").maybeSingle();
    const cfg = (nlRow?.valeur ?? {}) as { auto_send?: boolean; rgpd_only?: boolean; sender_name?: string; intro?: string };
    const rgpdOnly = cfg.rgpd_only !== false;

    // Config Brevo (envoi des newsletters via API transactionnelle). Clé : secret
    // BREVO_API_KEY prioritaire, sinon table parametres (cle='brevo').
    const { data: brevoRow } = await sb.from("parametres").select("valeur").eq("cle", "brevo").maybeSingle();
    const brevoCfg = (brevoRow?.valeur ?? {}) as { api_key?: string; sender_email?: string; sender_name?: string; daily_limit?: number | string };
    const brevo: BrevoCfg = {
      apiKey: (Deno.env.get("BREVO_API_KEY") || brevoCfg.api_key || "").trim(),
      senderEmail: (brevoCfg.sender_email || "").trim(),
      senderName: (brevoCfg.sender_name || cfg.sender_name || "Aissociate").trim() || "Aissociate",
    };
    // Plafond d'envoi par jour (Brevo gratuit = 300). La file étale au-delà.
    // Borné [1, 5000] pour éviter toute valeur aberrante côté config.
    const dailyLimit = Math.min(5000, Math.max(1, Number(brevoCfg.daily_limit) > 0 ? Math.floor(Number(brevoCfg.daily_limit)) : 300));

    // — Drain quotidien de la file (cron) —
    if (action === "process_queue") {
      const { sent } = await drainQueue(sb, brevo, dailyLimit, SUPABASE_URL);
      return json({ ok: true, sent });
    }

    // — Test de connexion Brevo (clé valide + expéditeur vérifié) —
    if (action === "test") {
      const key = ((body.api_key as string) || brevo.apiKey || "").trim();
      const senderEmail = ((body.sender_email as string) || brevo.senderEmail || "").trim();
      if (!key) return json({ error: "Clé API Brevo manquante." }, 400);
      const acc = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": key, "accept": "application/json" } });
      if (!acc.ok) {
        const msg = acc.status === 401 ? "Clé API Brevo invalide ou révoquée." : `Brevo a répondu ${acc.status}.`;
        return json({ error: msg }, 400);
      }
      const accData = await acc.json().catch(() => ({})) as { email?: string };
      // Vérifie que l'e-mail expéditeur est un expéditeur vérifié dans Brevo.
      let senderOk: boolean | null = null;
      if (senderEmail) {
        const s = await fetch("https://api.brevo.com/v3/senders", { headers: { "api-key": key, "accept": "application/json" } });
        if (s.ok) {
          const sd = await s.json().catch(() => ({})) as { senders?: { email?: string; active?: boolean }[] };
          senderOk = (sd.senders ?? []).some((x) => (x.email ?? "").toLowerCase() === senderEmail.toLowerCase() && x.active !== false);
        }
      }
      return json({ ok: true, account: accData.email ?? null, senderEmail, senderOk });
    }

    // — Envoi d'une édition existante —
    if (action === "send") {
      if (!body.newsletterId) return json({ error: "newsletterId requis" }, 400);
      const { data: ed } = await sb.from("newsletters").select("id").eq("id", body.newsletterId).maybeSingle();
      if (!ed) return json({ error: "Édition introuvable" }, 404);
      const res = await enqueueAndDrain(sb, body.newsletterId, rgpdOnly, brevo, dailyLimit, SUPABASE_URL);
      if (res.error) return json({ error: res.error }, 400);
      return json({ ok: true, ...res });
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

    const nlId = (ins as { id: string }).id;
    let q: { total?: number; sentNow?: number; queued?: number; days?: number; error?: string } = {};
    if (auto) q = await enqueueAndDrain(sb, nlId, rgpdOnly, brevo, dailyLimit, SUPABASE_URL);
    const statut = auto ? (q.error ? "brouillon" : ((q.queued ?? 0) > 0 ? "en_cours" : "envoye")) : "brouillon";

    return json({ ok: true, id: nlId, articles: articles.length, statut, ...q, warning: q.error });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

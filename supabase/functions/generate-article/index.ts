// Supabase Edge Function — génération d'un article de blog par IA (veille IA).
// Lit le paramètre `blog` (prompt maître, thèmes, publication auto, recherche
// web) + `ai` (clé/modèle OpenRouter), génère un article et l'insère dans
// `blog_articles`. Appelable manuellement (bouton CRM) ou par cron.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function slugify(s: string): string {
  return (s || "article").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "article";
}
function parseJson(content: string): Record<string, unknown> | null {
  try { return JSON.parse(content); } catch { /* */ }
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
  return null;
}
const strip = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
// Parse minimal RSS/Atom : renvoie les items récents { title, desc, link }.
async function fetchRss(url: string): Promise<{ title: string; desc: string; link: string }[]> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 AissociateBot" } });
    if (!r.ok) return [];
    const xml = await r.text();
    const out: { title: string; desc: string; link: string }[] = [];
    for (const b of xml.split(/<item[\s>]/i).slice(1, 12)) {
      const title = strip(b.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const desc = strip(b.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "").slice(0, 320);
      const link = strip(b.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");
      if (title) out.push({ title, desc, link });
    }
    if (!out.length) for (const e of xml.split(/<entry[\s>]/i).slice(1, 12)) {
      const title = strip(e.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const link = e.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
      if (title) out.push({ title, desc: "", link });
    }
    return out;
  } catch { return []; }
}

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=600&fit=crop&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop&q=80",
];

// Génère une image via un modèle OpenRouter (sortie image) -> data URL base64.
async function generateImageDataUrl(apiKey: string, model: string, prompt: string): Promise<string | null> {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://aissociate.crm", "X-Title": "CRM Formation AIssociate" },
      body: JSON.stringify({
        model,
        modalities: ["image", "text"],
        messages: [{ role: "user", content: `Illustration de blog professionnelle et moderne, SANS TEXTE, pour un article sur : ${prompt}. Style éditorial, ambiance technologie / IA, couleurs chaleureuses (orange/ambre), haute qualité, format paysage.` }],
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const msg = d?.choices?.[0]?.message;
    const url = msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url ?? null;
    return (typeof url === "string" && url.startsWith("data:")) ? url : null;
  } catch { return null; }
}
function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1], bytes };
}

// Génère une image via Kie.ai — Seedream 5.0 Lite (API asynchrone : création de
// tâche puis interrogation du résultat). Renvoie les octets de l'image.
async function generateImageKie(
  apiKey: string,
  opts: { quality: "basic" | "high"; aspectRatio: string },
  prompt: string,
): Promise<{ mime: string; bytes: Uint8Array } | null> {
  try {
    const create = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "seedream/5-lite-text-to-image",
        input: {
          prompt: `Illustration de blog professionnelle et moderne, sans texte, sur le thème : ${prompt}. Style éditorial, ambiance technologie / IA, couleurs chaleureuses (orange/ambre), haute qualité.`.slice(0, 3000),
          aspect_ratio: opts.aspectRatio,
          quality: opts.quality,
          nsfw_checker: false,
        },
      }),
    });
    const cj = await create.json().catch(() => null);
    const taskId = cj?.data?.taskId;
    if (!create.ok || !taskId) return null;

    // Interrogation du résultat (states: waiting | queuing | generating | success | fail).
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const q = await fetch(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        { headers: { "Authorization": `Bearer ${apiKey}` } },
      );
      const qj = await q.json().catch(() => null);
      const state = qj?.data?.state;
      if (state === "fail") return null;
      if (state === "success") {
        let url: string | null = null;
        try { url = JSON.parse(qj.data.resultJson || "{}")?.resultUrls?.[0] ?? null; } catch { /* */ }
        if (!url) return null;
        const imgRes = await fetch(url);
        if (!imgRes.ok) return null;
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        return { mime, bytes: new Uint8Array(await imgRes.arrayBuffer()) };
      }
    }
    return null; // délai dépassé
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: blogRow } = await sb.from("parametres").select("valeur").eq("cle", "blog").maybeSingle();
    const blog = (blogRow?.valeur ?? {}) as {
      prompt?: string; themes?: string[]; auto_publish?: boolean; use_web?: boolean;
      rss_feeds?: string[]; seo_keywords?: string[]; image_model?: string;
      image_provider?: string; kie_api_key?: string; kie_quality?: string; kie_aspect_ratio?: string;
    };
    const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
    const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
    if (!apiKey) return json({ error: "Clé OpenRouter absente (Paramètres > IA)" }, 400);

    const themes = Array.isArray(blog.themes) && blog.themes.length ? blog.themes : ["Veille IA : tendances du moment"];
    const feeds = Array.isArray(blog.rss_feeds) ? blog.rss_feeds.filter(Boolean) : [];
    const seo = Array.isArray(blog.seo_keywords) ? blog.seo_keywords.filter(Boolean) : [];

    // Sujet : explicite, sinon veille via flux RSS (actualité IA), sinon thème.
    let subject = (body.subject as string) || "";
    let sourceNote = "";
    if (!subject && feeds.length) {
      const items = await fetchRss(feeds[Math.floor(Math.random() * feeds.length)]);
      if (items.length) {
        const it = items[Math.floor(Math.random() * Math.min(items.length, 5))];
        subject = it.title;
        sourceNote = `\n\nActualité IA récente à exploiter (veille RSS) :\nTitre : ${it.title}${it.desc ? `\nRésumé : ${it.desc}` : ""}${it.link ? `\nSource : ${it.link}` : ""}\nRédige un article ORIGINAL et à valeur ajoutée inspiré de cette actualité (ne recopie pas, contextualise pour les PME).`;
      }
    }
    if (!subject) subject = themes[Math.floor(Math.random() * themes.length)];

    const useWeb = (body.use_web ?? blog.use_web) === true;
    const model = (ai.model || "anthropic/claude-opus-4.8") + (useWeb ? ":online" : "");
    const systemPrompt = (blog.prompt ||
      'Rédige un article de blog en français sur le thème fourni. Réponds en JSON {"title","excerpt","content","category","seo_keywords"}.') +
      (seo.length ? `\n\nIntègre naturellement ces mots-clés SEO dans l'article : ${seo.join(", ")}.` : "");

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://aissociate.crm", "X-Title": "CRM Formation AIssociate" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `THÈME : ${subject}${sourceNote}\n\nRédige l'article maintenant (réponds uniquement par l'objet JSON).` },
        ],
        temperature: 0.6,
      }),
    });
    if (!resp.ok) return json({ error: `OpenRouter ${resp.status}: ${(await resp.text()).slice(0, 300)}` }, 502);
    const data = await resp.json();
    const parsed = parseJson(data?.choices?.[0]?.message?.content ?? "");
    if (!parsed?.title) return json({ error: "Réponse IA invalide (titre manquant)" }, 502);

    const title = String(parsed.title);
    const categoryName = String(parsed.category || "Intelligence artificielle");
    const catSlug = slugify(categoryName);

    // Catégorie : créer si absente.
    let categoryId: string | null = null;
    const { data: existingCat } = await sb.from("blog_categories").select("id").eq("slug", catSlug).maybeSingle();
    if (existingCat) categoryId = existingCat.id;
    else {
      const { data: newCat } = await sb.from("blog_categories").insert({ name: categoryName, slug: catSlug }).select("id").maybeSingle();
      categoryId = newCat?.id ?? null;
    }

    // Slug unique.
    let slug = slugify(title);
    const { data: clash } = await sb.from("blog_articles").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;

    // Illustration : génération IA + upload bucket public, sinon Unsplash.
    // Provider : Kie.ai (Seedream) si une clé Kie est configurée, sinon OpenRouter.
    let imageUrl: string | null = null;
    const kieKey = (Deno.env.get("KIE_API_KEY") || blog.kie_api_key || "").trim();
    const provider = blog.image_provider || (kieKey ? "kie" : "openrouter");
    let img: { mime: string; bytes: Uint8Array } | null = null;
    if (provider === "kie" && kieKey) {
      img = await generateImageKie(kieKey, {
        quality: blog.kie_quality === "high" ? "high" : "basic",
        aspectRatio: blog.kie_aspect_ratio || "16:9",
      }, title);
    } else {
      const imageModel = blog.image_model || "google/gemini-2.5-flash-image-preview:free";
      const dataUrl = await generateImageDataUrl(apiKey, imageModel, title);
      img = dataUrl ? dataUrlToBytes(dataUrl) : null;
    }
    if (img) {
      const ext = img.mime.includes("png") ? "png" : img.mime.includes("webp") ? "webp" : "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from("blog").upload(path, img.bytes, { contentType: img.mime, upsert: false });
      if (!up.error) imageUrl = sb.storage.from("blog").getPublicUrl(path).data.publicUrl;
    }
    if (!imageUrl) imageUrl = FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];

    const publish = (body.publish ?? blog.auto_publish) === true;
    const { data: article, error } = await sb.from("blog_articles").insert({
      title,
      slug,
      excerpt: String(parsed.excerpt || "").slice(0, 500),
      content: String(parsed.content || ""),
      category_id: categoryId,
      image_url: imageUrl,
      author: "IA — Veille Aissociate",
      read_time: Math.max(2, Math.round(String(parsed.content || "").length / 1200)),
      seo_keywords: parsed.seo_keywords ? String(parsed.seo_keywords) : null,
      published: publish,
      published_at: publish ? new Date().toISOString() : null,
      generation_prompt: subject,
      ai_model_used: model,
    }).select("id, title, slug, published").maybeSingle();
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, article, subject });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

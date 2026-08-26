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

type RssItem = { title: string; desc: string; link: string; date: number };

const parseDate = (s: string): number => { const t = Date.parse(s.trim()); return Number.isNaN(t) ? 0 : t; };
// Titre normalisé (minuscules, sans accents ni ponctuation) pour la déduplication.
const normTitle = (s: string): string =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Parse minimal RSS/Atom : renvoie les items récents { title, desc, link, date }.
async function fetchRss(url: string): Promise<RssItem[]> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      headers: {
        // UA navigateur complet : Google News repond 200 vide ou 403 aux UA
        // « bot » depuis les IP cloud — c'est ce qui a coupe la veille.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!r.ok) { console.log(`[rss] ${url} -> HTTP ${r.status}`); return []; }
    const xml = await r.text();
    const out: RssItem[] = [];
    for (const b of xml.split(/<item[\s>]/i).slice(1, 16)) {
      const title = strip(b.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const desc = strip(b.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "").slice(0, 320);
      const link = strip(b.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");
      const date = parseDate(b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? b.match(/<dc:date>([\s\S]*?)<\/dc:date>/i)?.[1] ?? "");
      if (title) out.push({ title, desc, link, date });
    }
    if (!out.length) for (const e of xml.split(/<entry[\s>]/i).slice(1, 16)) {
      const title = strip(e.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const link = e.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
      const date = parseDate(e.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ?? e.match(/<published>([\s\S]*?)<\/published>/i)?.[1] ?? "");
      if (title) out.push({ title, desc: "", link, date });
    }
    console.log(`[rss] ${url} -> ${out.length} item(s)`);
    return out;
  } catch (err) {
    console.log(`[rss] ${url} -> erreur: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// Sélection IA : choisit l'actualité la PLUS IMPORTANTE non déjà traitée.
// Renvoie l'index choisi dans `candidates`, ou -1 si tout est doublon / échec.
async function selectMostImportant(
  apiKey: string, model: string, candidates: RssItem[], covered: string[],
): Promise<number> {
  if (!candidates.length) return -1;
  const list = candidates.map((c, i) => `${i}. ${c.title}`).join("\n");
  const cov = covered.slice(0, 60).map((s) => `- ${s}`).join("\n") || "(aucun)";
  const prompt =
    `Actualités IA disponibles (numérotées) :\n${list}\n\n` +
    `Articles DÉJÀ publiés — NE PAS retraiter, éviter les doublons même reformulés :\n${cov}\n\n` +
    `Choisis l'actualité la PLUS IMPORTANTE et impactante du jour pour des PME francophones, qui n'est PAS déjà traitée ci-dessus. ` +
    `Réponds uniquement en JSON {"index": N} où N est le numéro choisi, ou {"index": -1} si toutes sont des doublons.`;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://aissociate.crm", "X-Title": "CRM Formation AIssociate" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0 }),
    });
    if (!r.ok) return -1;
    const d = await r.json();
    const parsed = parseJson(d?.choices?.[0]?.message?.content ?? "");
    const idx = Number((parsed as { index?: unknown })?.index);
    return Number.isInteger(idx) && idx >= 0 && idx < candidates.length ? idx : -1;
  } catch { return -1; }
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

    // Sujet : explicite, sinon veille RSS — on retient l'actualité la plus
    // importante du jour NON déjà traitée (anti-doublon), sinon un thème.
    let subject = (body.subject as string) || "";
    let sourceNote = "";
    // Sujets deja traites (titres + prompts) — anti-doublon commun a la
    // veille RSS ET aux themes de repli.
    const { data: past } = await sb.from("blog_articles")
      .select("title, generation_prompt").order("created_at", { ascending: false }).limit(120);
    const covered = (past ?? [])
      .flatMap((a) => [a.generation_prompt, a.title]).filter(Boolean).map((s) => String(s));
    const coveredN = new Set(covered.map(normTitle));
    const buildSourceNote = (it: RssItem) =>
      `\n\nActualité IA à exploiter (veille RSS) :\nTitre : ${it.title}${it.desc ? `\nRésumé : ${it.desc}` : ""}${it.link ? `\nSource : ${it.link}` : ""}\nRédige un article ORIGINAL et à valeur ajoutée inspiré de cette actualité (ne recopie pas, contextualise pour les PME).`;
    if (!subject && feeds.length) {
      // 1. Agréger les items de TOUS les flux (en parallèle), dédupliquer par titre.
      const lists = await Promise.all(feeds.map((f) => fetchRss(f)));
      const seen = new Set<string>();
      let candidates = lists.flat().filter((it) => {
        const k = normTitle(it.title);
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      });
      // 2. Privilégier l'actualité du jour (< 48 h) quand des dates sont disponibles.
      const now = Date.now();
      const recent = candidates.filter((c) => c.date && now - c.date < 48 * 3600 * 1000);
      if (recent.length) candidates = recent;
      candidates.sort((a, b) => (b.date || 0) - (a.date || 0));
      candidates = candidates.slice(0, 25);

      if (candidates.length) {
        // Choix par l'IA de l'actu la plus importante non encore couverte.
        // Modele agent (tool calling fiable = JSON fiable), pas le modele de
        // redaction (minimax renvoie du raisonnement difficile a parser).
        const selModel = (ai.model_agent || ai.model || "anthropic/claude-sonnet-4.5").replace(/:online$/, "");
        const idx = await selectMostImportant(apiKey, selModel, candidates, covered);
        let chosen = idx >= 0 ? candidates[idx] : null;
        // Repli : si l'IA renonce (tout doublon), prendre la plus récente non traitée.
        if (!chosen) chosen = candidates.find((c) => !coveredN.has(normTitle(c.title))) ?? null;
        if (chosen) { subject = chosen.title; sourceNote = buildSourceNote(chosen); }
      }
    }
    if (!subject) {
      const libres = themes.filter((t) => !coveredN.has(normTitle(t)));
      if (!libres.length) {
        console.log("[blog] veille muette et tous les themes deja couverts : aucune generation.");
        return json({ ok: true, skipped: "Aucun sujet nouveau (veille RSS vide, themes deja tous traites)." });
      }
      subject = libres[Math.floor(Math.random() * libres.length)];
    }

    const useWeb = (body.use_web ?? blog.use_web) === true;
    const model = (ai.model || "anthropic/claude-opus-4.8") + (useWeb ? ":online" : "");
    // Quand la recherche web est active, on impose de s'appuyer sur l'actualité
    // récente pour étayer l'article (faits, chiffres, exemples vérifiables).
    const webNote = useWeb
      ? "\n\nAppuie-toi sur l'ACTUALITÉ RÉCENTE (informations web à jour) pour étayer l'article avec des faits, chiffres, exemples et tendances récents et vérifiables. Reste original et contextualise pour les PME ; ne recopie pas tes sources."
      : "";
    const systemPrompt = (blog.prompt ||
      'Rédige un article de blog en français sur le thème fourni. Réponds en JSON {"title","excerpt","content","category","seo_keywords"}.') +
      (seo.length ? `\n\nIntègre naturellement ces mots-clés SEO dans l'article : ${seo.join(", ")}.` : "");

    // Génération du TEXTE (OpenRouter) et de l'IMAGE (provider configuré) en
    // PARALLÈLE : l'image s'appuie sur le THÈME (connu d'avance), ce qui évite
    // d'enchaîner les deux appels lents et de dépasser le budget temps (150s).
    const kieKey = (Deno.env.get("KIE_API_KEY") || blog.kie_api_key || "").trim();
    const imageProvider = blog.image_provider || (kieKey ? "kie" : "openrouter");

    const textPromise = (async () => {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://aissociate.crm", "X-Title": "CRM Formation AIssociate" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `THÈME : ${subject}${sourceNote}${webNote}\n\nRédige l'article maintenant (réponds uniquement par l'objet JSON).` },
          ],
          temperature: 0.6,
        }),
      });
      if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
      const data = await resp.json();
      return parseJson(data?.choices?.[0]?.message?.content ?? "");
    })();

    const imagePromise = (async () => {
      if (imageProvider === "kie" && kieKey) {
        return await generateImageKie(kieKey, {
          quality: blog.kie_quality === "high" ? "high" : "basic",
          aspectRatio: blog.kie_aspect_ratio || "16:9",
        }, subject);
      }
      const imageModel = blog.image_model || "google/gemini-2.5-flash-image-preview:free";
      const dataUrl = await generateImageDataUrl(apiKey, imageModel, subject);
      return dataUrl ? dataUrlToBytes(dataUrl) : null;
    })();

    let parsed: Record<string, unknown> | null;
    let img: { mime: string; bytes: Uint8Array } | null;
    try {
      [parsed, img] = await Promise.all([textPromise, imagePromise]);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
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

    // Illustration : déjà générée en parallèle du texte (img). Upload bucket
    // public, sinon repli Unsplash.
    let imageUrl: string | null = null;
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

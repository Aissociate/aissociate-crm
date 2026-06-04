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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: blogRow } = await sb.from("parametres").select("valeur").eq("cle", "blog").maybeSingle();
    const blog = (blogRow?.valeur ?? {}) as { prompt?: string; themes?: string[]; auto_publish?: boolean; use_web?: boolean };
    const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key;
    if (!apiKey) return json({ error: "Clé OpenRouter absente (Paramètres > IA)" }, 400);

    const themes = Array.isArray(blog.themes) && blog.themes.length ? blog.themes : ["Veille IA : tendances du moment"];
    const subject = (body.subject as string) || themes[Math.floor(Math.random() * themes.length)];
    const useWeb = (body.use_web ?? blog.use_web) === true;
    const model = (ai.model || "anthropic/claude-opus-4.8") + (useWeb ? ":online" : "");
    const systemPrompt = blog.prompt ||
      'Rédige un article de blog en français sur le thème fourni. Réponds en JSON {"title","excerpt","content","category","seo_keywords"}.';

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://aissociate.crm", "X-Title": "CRM Formation AIssociate" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `THÈME : ${subject}\n\nRédige l'article maintenant (réponds uniquement par l'objet JSON).` },
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

    const publish = (body.publish ?? blog.auto_publish) === true;
    const { data: article, error } = await sb.from("blog_articles").insert({
      title,
      slug,
      excerpt: String(parsed.excerpt || "").slice(0, 500),
      content: String(parsed.content || ""),
      category_id: categoryId,
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

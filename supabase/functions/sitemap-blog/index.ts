// Génère un sitemap XML dynamique pour les articles de blog publiés.
// Appelé via /sitemap-blog.xml (redirect dans _redirects).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const SITE_URL = "https://aissociate.re";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: articles } = await sb
      .from("blog_articles")
      .select("slug, title, image_url, excerpt, published_at, updated_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(500);

    const { data: formations } = await sb
      .from("formations")
      .select("id, intitule, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);

    const today = new Date().toISOString().slice(0, 10);

    const articleUrls = (articles || []).map((a) => {
      const lastmod = (a.updated_at || a.published_at || today).slice(0, 10);
      const imageTag = a.image_url
        ? `    <image:image>\n      <image:loc>${esc(a.image_url)}</image:loc>\n      <image:title>${esc(a.title)}</image:title>\n    </image:image>`
        : "";
      return `  <url>
    <loc>${SITE_URL}/blog/${esc(a.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
${imageTag}
  </url>`;
    });

    const formationUrls = (formations || []).map((f) => {
      const lastmod = (f.updated_at || today).slice(0, 10);
      return `  <url>
    <loc>${SITE_URL}/formations/${esc(String(f.id))}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Articles de blog publiés : ${articleUrls.length} -->
  <!-- Formations CRM : ${formationUrls.length} -->
${formationUrls.join("\n")}
${articleUrls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    return new Response(`<!-- sitemap error: ${err instanceof Error ? err.message : String(err)} -->`, {
      status: 500,
      headers: { "Content-Type": "application/xml" },
    });
  }
});

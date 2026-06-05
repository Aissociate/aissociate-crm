// Supabase Edge Function — publication d'un article du blog sur LinkedIn (page entreprise).
// Déclenchée par le trigger DB `trg_blog_linkedin_share` à la publication d'un article,
// ou manuellement via supabase.functions.invoke('linkedin-share', { body: { article_id } }).
//
// Publie : texte (titre + extrait + lien + hashtags) + image du blog.
// Config : secrets Supabase (LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORG_URN) en priorité,
//          sinon table `parametres` (cle='linkedin' : { access_token, org_urn, enabled }).
//
// ⚠️ client_id + client_secret ne suffisent pas : il faut un access_token OAuth avec le
//    scope w_organization_social (produit « Community Management API » côté LinkedIn).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LI_VERSION = "202405"; // Version de l'API LinkedIn (à bumper si dépréciée).
const SITE_URL = "https://aissociate.re";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// "intelligence artificielle, CPF" -> "#IntelligenceArtificielle #Cpf"
function toHashtags(keywords?: string): string {
  return (keywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((k) =>
      "#" +
      k.normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, " ").trim().split(" ").filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join("")
    )
    .filter((t) => t.length > 2)
    .join(" ");
}

function buildCommentary(a: { title: string; excerpt?: string; slug: string; seo_keywords?: string }): string {
  const url = `${SITE_URL}/blog/${a.slug}`;
  const tags = toHashtags(a.seo_keywords);
  return [a.title, a.excerpt ?? "", `👉 Lire l'article : ${url}`, tags].filter(Boolean).join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { article_id, dry_run } = await req.json().catch(() => ({}));
    if (!article_id) return json({ ok: false, error: "article_id requis" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Article ──
    const { data: a, error: aErr } = await supabase
      .from("blog_articles")
      .select("id, title, excerpt, slug, image_url, seo_keywords, published, linkedin_shared_at")
      .eq("id", article_id)
      .maybeSingle();
    if (aErr || !a) return json({ ok: false, error: "article introuvable" }, 404);
    if (!a.published) return json({ ok: false, skipped: "article non publié" });
    if (a.linkedin_shared_at) return json({ ok: true, skipped: "déjà partagé" });

    // ── Config LinkedIn (secrets d'abord, puis parametres) ──
    let accessToken = Deno.env.get("LINKEDIN_ACCESS_TOKEN") ?? "";
    let orgUrn = Deno.env.get("LINKEDIN_ORG_URN") ?? "";
    if (!accessToken || !orgUrn) {
      const { data: cfg } = await supabase.from("parametres").select("valeur").eq("cle", "linkedin").maybeSingle();
      const v = (cfg?.valeur ?? {}) as Record<string, string | boolean>;
      if (v.enabled === false) return json({ ok: false, skipped: "LinkedIn désactivé" });
      accessToken = accessToken || (v.access_token as string) || "";
      orgUrn = orgUrn || (v.org_urn as string) || "";
    }
    if (!accessToken || !orgUrn) {
      return json({ ok: false, skipped: "config LinkedIn incomplète (access_token / org_urn requis)" });
    }
    if (!orgUrn.startsWith("urn:li:")) orgUrn = `urn:li:organization:${orgUrn.replace(/\D/g, "")}`;

    const commentary = buildCommentary(a);
    if (dry_run) return json({ ok: true, dry_run: true, commentary });

    const liHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "LinkedIn-Version": LI_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    };

    // ── Image (optionnelle) : initializeUpload → PUT binaire → URN image ──
    let imageUrn: string | null = null;
    if (a.image_url) {
      try {
        const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
          method: "POST",
          headers: liHeaders,
          body: JSON.stringify({ initializeUploadRequest: { owner: orgUrn } }),
        });
        const initJson = await initRes.json();
        const uploadUrl = initJson?.value?.uploadUrl;
        const urn = initJson?.value?.image;
        if (uploadUrl && urn) {
          const imgBytes = new Uint8Array(await (await fetch(a.image_url)).arrayBuffer());
          const put = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${accessToken}` },
            body: imgBytes,
          });
          if (put.ok) imageUrn = urn;
        }
      } catch (_) {
        imageUrn = null; // On poste en texte seul si l'upload image échoue.
      }
    }

    // ── Création du post ──
    const postBody: Record<string, unknown> = {
      author: orgUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    if (imageUrn) postBody.content = { media: { id: imageUrn, altText: a.title.slice(0, 350) } };

    const postRes = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: liHeaders,
      body: JSON.stringify(postBody),
    });
    if (!postRes.ok) {
      const errTxt = await postRes.text();
      return json({ ok: false, error: `LinkedIn ${postRes.status}: ${errTxt.slice(0, 600)}` });
    }
    const postUrn = postRes.headers.get("x-restli-id") ?? postRes.headers.get("x-linkedin-id") ?? null;

    await supabase
      .from("blog_articles")
      .update({ linkedin_shared_at: new Date().toISOString(), linkedin_post_urn: postUrn })
      .eq("id", a.id);

    return json({ ok: true, urn: postUrn, withImage: !!imageUrn });
  } catch (e) {
    return json({ ok: false, error: String(e) });
  }
});

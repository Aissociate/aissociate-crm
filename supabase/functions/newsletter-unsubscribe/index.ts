// Désinscription newsletter en un clic (lien public, jeton par contact).
// Déployée avec verify_jwt = false : accédée directement depuis l'e-mail.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const SITE_URL = "https://aissociate.re";

function page(title: string, message: string): Response {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f8;color:#15151f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e8e8ee;border-radius:14px;">
<tr><td style="padding:36px 32px;text-align:center;">
<h1 style="margin:0 0 12px;font-size:22px;">${title}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#55555f;">${message}</p>
<a href="${SITE_URL}" style="display:inline-block;background:#ea6a1e;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 22px;border-radius:8px;">Retour au site</a>
</td></tr></table></td></tr></table></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("t") ?? "").trim();
    // Validation basique du format UUID (évite les requêtes inutiles).
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      return page("Lien invalide", "Le lien de désinscription est incomplet ou incorrect.");
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await sb.from("contacts")
      .update({ newsletter_unsubscribed: true })
      .eq("unsubscribe_token", token)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return page("Lien invalide ou expiré", "Nous n'avons pas pu traiter cette désinscription. Vous êtes peut-être déjà désinscrit.");
    }
    return page("Désinscription confirmée", "Vous ne recevrez plus notre newsletter. Vous pouvez vous réinscrire à tout moment en nous contactant.");
  } catch {
    return page("Erreur", "Une erreur est survenue. Merci de réessayer plus tard.");
  }
});

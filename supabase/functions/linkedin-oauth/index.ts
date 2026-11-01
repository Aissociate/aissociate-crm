// Edge Function — connexion OAuth LinkedIn (bouton « Connecter LinkedIn » des Paramètres).
// Déployée avec verify_jwt = false : LinkedIn rappelle l'URL en GET sans JWT.
//
//   POST { action: "start", return_to }  (admin authentifié)
//        -> { url } : page d'autorisation LinkedIn ; un state anti-CSRF est stocké
//           dans parametres (cle='linkedin_oauth_state', 10 min).
//   GET  ?code=…&state=…  (redirect_uri = cette fonction)
//        -> échange du code contre access_token + refresh_token, détection de la page
//           entreprise administrée (si org_urn vide), puis 302 vers return_to?linkedin=ok|error.
//
// L'URL de rappel à déclarer dans l'app LinkedIn (onglet Auth) est
//   <SUPABASE_URL>/functions/v1/linkedin-oauth
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { exchangeToken, LI_VERSION, readCfg, saveCfg, tokenFields } from "../_shared/linkedin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SCOPES = "w_organization_social r_organization_admin";
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/linkedin-oauth`;

function back(returnTo: string, status: "ok" | "error", msg?: string): Response {
  const u = new URL(returnTo);
  u.searchParams.set("linkedin", status);
  if (msg) u.searchParams.set("linkedin_msg", msg.slice(0, 300));
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

// Première page entreprise dont l'utilisateur connecté est administrateur.
async function findOrganization(accessToken: string): Promise<{ urn: string; name?: string; count: number } | null> {
  const headers = { Authorization: `Bearer ${accessToken}`, "LinkedIn-Version": LI_VERSION, "X-Restli-Protocol-Version": "2.0.0" };
  const res = await fetch("https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", { headers });
  if (!res.ok) return null;
  const els = ((await res.json())?.elements ?? []) as { organization?: string }[];
  const urn = els.find((e) => e.organization)?.organization;
  if (!urn) return null;
  let name: string | undefined;
  const org = await fetch(`https://api.linkedin.com/rest/organizations/${urn.split(":").pop()}`, { headers });
  if (org.ok) name = (await org.json())?.localizedName;
  return { urn, name, count: els.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Rappel LinkedIn ──
  if (req.method === "GET") {
    const q = new URL(req.url).searchParams;
    const { data: st } = await sb.from("parametres").select("valeur").eq("cle", "linkedin_oauth_state").maybeSingle();
    const pending = (st?.valeur ?? {}) as { state?: string; return_to?: string; expires?: number };
    if (!pending.return_to || !pending.state || q.get("state") !== pending.state || (pending.expires ?? 0) < Date.now()) {
      return new Response("Lien de connexion LinkedIn invalide ou expiré. Relancez la connexion depuis les Paramètres du CRM.", { status: 400 });
    }
    await sb.from("parametres").delete().eq("cle", "linkedin_oauth_state");
    const returnTo = pending.return_to;
    if (q.get("error")) return back(returnTo, "error", q.get("error_description") ?? q.get("error") ?? "refusé");

    try {
      const cfg = await readCfg(sb);
      const t = await exchangeToken({
        grant_type: "authorization_code",
        code: q.get("code") ?? "",
        redirect_uri: REDIRECT_URI,
        client_id: cfg.client_id ?? "",
        client_secret: cfg.client_secret ?? "",
      });
      const patch = { ...tokenFields(t), connected_at: new Date().toISOString() } as Record<string, unknown>;
      if (!t.refresh_token) { patch.refresh_token = null; patch.refresh_expires_at = null; }
      if (!cfg.org_urn) {
        const org = await findOrganization(t.access_token);
        if (org) { patch.org_urn = org.urn; patch.org_name = org.name ?? null; }
      }
      await saveCfg(sb, patch);
      return back(returnTo, "ok");
    } catch (e) {
      return back(returnTo, "error", e instanceof Error ? e.message : String(e));
    }
  }

  // ── Démarrage (admin) ──
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: "Non authentifié" }, 401);
    const { data: moi } = await sb.from("profiles").select("role, actif").eq("id", user.id).maybeSingle();
    if (moi?.role !== "admin" || !moi.actif) return json({ error: "Réservé aux administrateurs" }, 403);

    const { action, return_to } = await req.json().catch(() => ({}));
    if (action !== "start" || !/^https?:\/\//.test(return_to ?? "")) return json({ error: "Requête invalide" }, 400);
    const cfg = await readCfg(sb);
    if (!cfg.client_id || !cfg.client_secret) return json({ error: "Renseignez et enregistrez d'abord le Client ID et le Client Secret." }, 400);

    const state = crypto.randomUUID();
    await sb.from("parametres").upsert({
      cle: "linkedin_oauth_state",
      valeur: { state, return_to, expires: Date.now() + 10 * 60 * 1000 },
      description: "LinkedIn : connexion OAuth en cours (temporaire).",
    }, { onConflict: "cle" });

    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", cfg.client_id);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", SCOPES);
    return json({ url: url.toString(), redirect_uri: REDIRECT_URI });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

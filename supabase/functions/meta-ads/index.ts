// Supabase Edge Function — Meta Marketing API (lecture des performances Ads)
// Lecture seule : remonte dépense, impressions, clics, portée et leads d'un
// compte publicitaire Meta, au global et par campagne, sur une plage de dates.
//
// Sécurité :
//  - réservé à la DIRECTION (admin / directeur_commercial) ;
//  - le token Meta est lu CÔTÉ SERVEUR (secret Supabase META_ACCESS_TOKEN ou
//    table `parametres` cle='meta_ads', accessible via service_role) et n'est
//    JAMAIS exposé au navigateur.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Somme des actions « lead » (formulaires Meta + conversions pixel lead).
function sumLeads(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter((a) => String((a as { action_type?: string }).action_type ?? "").includes("lead"))
    .reduce((s, a) => s + Number((a as { value?: string }).value ?? 0), 0);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // — Authentification + contrôle de rôle (direction uniquement) —
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: ud } = await userClient.auth.getUser();
    const user = ud.user;
    if (!user) return json({ error: "Non authentifié" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE);
    const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = (profile?.role as string) ?? "conseiller";
    if (role !== "admin" && role !== "directeur_commercial") {
      return json({ error: "Accès réservé à la direction" }, 403);
    }

    const body = await req.json().catch(() => ({})) as { action?: string; since?: string; until?: string };
    const action = body.action ?? "insights";

    // — Configuration Meta (secret prioritaire, sinon table parametres) —
    const { data: cfgRow } = await sb.from("parametres").select("valeur").eq("cle", "meta_ads").maybeSingle();
    const cfg = (cfgRow?.valeur ?? {}) as Record<string, string>;
    const token = Deno.env.get("META_ACCESS_TOKEN") || cfg.access_token;
    let acct = (Deno.env.get("META_AD_ACCOUNT_ID") || cfg.ad_account_id || "").trim();
    const version = Deno.env.get("META_API_VERSION") || cfg.api_version || "v21.0";

    if (!token || !acct) {
      return json({ ok: false, configured: false, message: "Token ou compte publicitaire Meta absent (Paramètres › Publicité Meta)." });
    }
    acct = acct.replace(/^act_/, "");
    const base = `https://graph.facebook.com/${version}`;

    if (action === "insights") {
      const tr = body.since && body.until
        ? `&time_range=${encodeURIComponent(JSON.stringify({ since: body.since, until: body.until }))}`
        : "&date_preset=last_30d";

      // Métadonnées du compte (devise, nom)
      const acctRes = await fetch(`${base}/act_${acct}?fields=currency,name&access_token=${encodeURIComponent(token)}`);
      const acctJson = await acctRes.json();
      if (acctJson.error) return json({ ok: false, configured: true, error: acctJson.error.message ?? "Erreur Meta" });

      // Totaux compte
      const totRes = await fetch(`${base}/act_${acct}/insights?fields=spend,impressions,clicks,ctr,cpc,reach,actions${tr}&access_token=${encodeURIComponent(token)}`);
      const totJson = await totRes.json();
      if (totJson.error) return json({ ok: false, configured: true, error: totJson.error.message ?? "Erreur Meta" });
      const t = (Array.isArray(totJson.data) && totJson.data[0]) ? totJson.data[0] : {};
      const totals = {
        spend: Number(t.spend ?? 0), impressions: Number(t.impressions ?? 0), clicks: Number(t.clicks ?? 0),
        ctr: Number(t.ctr ?? 0), cpc: Number(t.cpc ?? 0), reach: Number(t.reach ?? 0), leads: sumLeads(t.actions),
      };

      // Détail par campagne
      const campRes = await fetch(`${base}/act_${acct}/insights?level=campaign&fields=campaign_name,spend,impressions,clicks,actions${tr}&limit=100&access_token=${encodeURIComponent(token)}`);
      const campJson = await campRes.json();
      const campaigns = Array.isArray(campJson.data)
        ? campJson.data.map((c: Record<string, unknown>) => ({
            name: c.campaign_name as string,
            spend: Number(c.spend ?? 0), impressions: Number(c.impressions ?? 0),
            clicks: Number(c.clicks ?? 0), leads: sumLeads(c.actions),
          })).sort((a, b) => b.spend - a.spend)
        : [];

      return json({
        ok: true, configured: true,
        currency: acctJson.currency ?? "EUR", account: acctJson.name ?? null,
        totals, campaigns,
      });
    }

    return json({ error: `Action inconnue : ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

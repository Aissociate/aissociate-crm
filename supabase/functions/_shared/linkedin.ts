// Accès LinkedIn partagé (linkedin-share, linkedin-oauth) : version d'API, lecture de
// la config et renouvellement automatique du token via le refresh_token OAuth.
// deno-lint-ignore-file no-explicit-any

export const LI_VERSION = "202605"; // Version de l'API LinkedIn (YYYYMM, supportée ~12 mois : à bumper).

export type LinkedinCfg = {
  enabled?: boolean;
  client_id?: string;
  client_secret?: string;
  access_token?: string;
  expires_at?: string;          // ISO — expiration de l'access token
  refresh_token?: string;
  refresh_expires_at?: string;  // ISO — expiration du refresh token (~1 an)
  org_urn?: string;
  org_name?: string;
  connected_at?: string;
};

// Réponse de https://www.linkedin.com/oauth/v2/accessToken -> champs à enregistrer.
export function tokenFields(t: any): Partial<LinkedinCfg> {
  const now = Date.now();
  const out: Partial<LinkedinCfg> = {
    access_token: t.access_token,
    expires_at: new Date(now + (Number(t.expires_in) || 0) * 1000).toISOString(),
  };
  if (t.refresh_token) {
    out.refresh_token = t.refresh_token;
    if (t.refresh_token_expires_in) {
      out.refresh_expires_at = new Date(now + Number(t.refresh_token_expires_in) * 1000).toISOString();
    }
  }
  return out;
}

export async function exchangeToken(params: Record<string, string>): Promise<any> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`LinkedIn OAuth ${res.status}: ${body.error_description ?? body.error ?? "réponse invalide"}`);
  }
  return body;
}

export async function readCfg(supabase: any): Promise<LinkedinCfg> {
  const { data } = await supabase.from("parametres").select("valeur").eq("cle", "linkedin").maybeSingle();
  return (data?.valeur ?? {}) as LinkedinCfg;
}

// Fusionne `patch` dans parametres.linkedin (relit la ligne pour ne rien écraser).
export async function saveCfg(supabase: any, patch: Partial<LinkedinCfg>): Promise<LinkedinCfg> {
  const merged = { ...(await readCfg(supabase)), ...patch };
  const { error } = await supabase.from("parametres").upsert({ cle: "linkedin", valeur: merged }, { onConflict: "cle" });
  if (error) throw new Error(error.message);
  return merged;
}

// Token valide, renouvelé si l'expiration approche (< 7 jours) et qu'un refresh_token existe.
export async function validAccessToken(supabase: any, cfg: LinkedinCfg): Promise<string> {
  const expiresAt = cfg.expires_at ? Date.parse(cfg.expires_at) : NaN;
  const soon = Number.isFinite(expiresAt) && expiresAt - Date.now() < 7 * 24 * 3600 * 1000;
  if (!soon || !cfg.refresh_token || !cfg.client_id || !cfg.client_secret) return cfg.access_token ?? "";
  try {
    const t = await exchangeToken({
      grant_type: "refresh_token",
      refresh_token: cfg.refresh_token,
      client_id: cfg.client_id,
      client_secret: cfg.client_secret,
    });
    const saved = await saveCfg(supabase, tokenFields(t));
    return saved.access_token ?? "";
  } catch (_) {
    return cfg.access_token ?? ""; // On tente quand même avec l'ancien token.
  }
}

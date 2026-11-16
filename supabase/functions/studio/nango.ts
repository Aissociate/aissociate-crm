// Connexions en un clic via Nango — cloisonnement strict par espace client.
//
// Règle d'or : l'espace (workspace_id) vient TOUJOURS du serveur (session Studio,
// invitation, ou appel manager vérifié), jamais du navigateur. Il est posé en tag
// `organization_id` sur la session de connexion ; Nango le recopie sur la
// connexion et dans le webhook signé.
//
// Secret requis : NANGO_SECRET_KEY (clé API de l'environnement Nango).
// ⚠ En-têtes HTTP sortants : ASCII uniquement.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { nouveauJeton, sha256 } from "./securite.ts";

const API = "https://api.nango.dev";
const INVITATION_JOURS = 7;

export type IntegrationNango = { id: string; provider: string; nom: string; logo: string | null };
export type ConnexionEspace = {
  integration_id: string; provider: string | null; statut: string; erreur: string | null;
  connecte_par: string | null; updated_at: string;
};

function cle(): string {
  const k = Deno.env.get("NANGO_SECRET_KEY")?.trim();
  if (!k) throw new Error("Connexions en un clic indisponibles : secret NANGO_SECRET_KEY non configuré.");
  return k;
}

async function nango(chemin: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${API}${chemin}`, {
    ...init,
    headers: { "Authorization": `Bearer ${cle()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export function nangoConfigure(): boolean {
  return Boolean(Deno.env.get("NANGO_SECRET_KEY")?.trim());
}

// Intégrations activées dans Nango (mises en cache 5 min par instance).
let cache: { quand: number; liste: IntegrationNango[] } | null = null;
export async function listerIntegrations(): Promise<IntegrationNango[]> {
  if (cache && Date.now() - cache.quand < 300_000) return cache.liste;
  const r = await nango("/integrations");
  if (!r.ok) throw new Error(`Nango ${r.status} (liste des intégrations)`);
  const j = await r.json() as { data?: { unique_key: string; provider: string; display_name?: string; logo?: string }[] };
  const liste = (j.data ?? []).map((i) => ({
    id: i.unique_key, provider: i.provider, nom: i.display_name || i.unique_key, logo: i.logo ?? null,
  }));
  cache = { quand: Date.now(), liste };
  return liste;
}

/** Session de connexion Nango (30 min), étiquetée avec l'espace : renvoie le lien hébergé par Nango. */
export async function lienConnexion(p: {
  wsId: string; wsNom: string; email?: string | null; utilisateurId?: string | null; integrationId?: string | null;
}): Promise<{ lien: string; expire: string }> {
  const integrations = await listerIntegrations();
  if (p.integrationId && !integrations.some((i) => i.id === p.integrationId)) throw new Error("Application inconnue.");
  const tags: Record<string, string> = {
    organization_id: p.wsId,                                 // ← clé du cloisonnement
    end_user_id: p.utilisateurId ? `studio-${p.utilisateurId}` : `espace-${p.wsId}`,
    end_user_display_name: p.wsNom.slice(0, 255),
  };
  if (p.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) tags.end_user_email = p.email.toLowerCase();
  const r = await nango("/connect/sessions", {
    method: "POST",
    body: JSON.stringify({
      tags,
      allowed_integrations: p.integrationId ? [p.integrationId] : integrations.map((i) => i.id),
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.data?.connect_link) throw new Error(`Nango ${r.status} : session de connexion impossible`);
  return { lien: j.data.connect_link, expire: j.data.expires_at };
}

/**
 * Rattache (ou met à jour) une connexion à SON espace. Appelée par le webhook
 * signé et par la synchronisation ; refuse tout espace inexistant.
 */
export async function enregistrerConnexion(sb: SupabaseClient, c: {
  wsId: string; integrationId: string; connectionId: string; provider?: string | null;
  statut: "connecte" | "erreur"; erreur?: string | null; email?: string | null;
}): Promise<boolean> {
  const { data: ws } = await sb.from("studio_workspaces").select("id").eq("id", c.wsId).maybeSingle();
  if (!ws) return false;
  // Une connexion Nango déjà rattachée à un AUTRE espace n'est jamais déplacée.
  const { data: ailleurs } = await sb.from("studio_nango_connexions").select("workspace_id")
    .eq("connection_id", c.connectionId).eq("integration_id", c.integrationId).maybeSingle();
  if (ailleurs && ailleurs.workspace_id !== c.wsId) return false;
  const { error } = await sb.from("studio_nango_connexions").upsert({
    workspace_id: c.wsId, integration_id: c.integrationId, connection_id: c.connectionId,
    provider: c.provider ?? null, statut: c.statut, erreur: c.erreur ?? null, connecte_par: c.email ?? null,
  }, { onConflict: "workspace_id,integration_id" });
  return !error;
}

/** Secours sans webhook : relit chez Nango les connexions étiquetées avec CET espace. */
export async function synchroniser(sb: SupabaseClient, wsId: string): Promise<number> {
  const r = await nango(`/connections?tags[organization_id]=${encodeURIComponent(wsId)}&limit=100`);
  if (!r.ok) throw new Error(`Nango ${r.status} (synchronisation)`);
  const j = await r.json() as { connections?: { connection_id: string; provider_config_key: string; provider: string; tags?: Record<string, string>; errors?: unknown[] }[] };
  let n = 0;
  for (const c of j.connections ?? []) {
    if (c.tags?.organization_id !== wsId) continue; // double vérification du tag
    const ok = await enregistrerConnexion(sb, {
      wsId, integrationId: c.provider_config_key, connectionId: c.connection_id, provider: c.provider,
      statut: c.errors?.length ? "erreur" : "connecte", erreur: c.errors?.length ? "Autorisation à renouveler" : null,
      email: c.tags?.end_user_email ?? null,
    });
    if (ok) n++;
  }
  return n;
}

export async function connexionsEspace(sb: SupabaseClient, wsId: string): Promise<ConnexionEspace[]> {
  const { data } = await sb.from("studio_nango_connexions")
    .select("integration_id, provider, statut, erreur, connecte_par, updated_at").eq("workspace_id", wsId);
  return (data ?? []) as ConnexionEspace[];
}

export async function deconnecter(sb: SupabaseClient, wsId: string, integrationId: string): Promise<void> {
  const { data: c } = await sb.from("studio_nango_connexions").select("connection_id")
    .eq("workspace_id", wsId).eq("integration_id", integrationId).maybeSingle();
  if (!c) return;
  const r = await nango(`/connections/${encodeURIComponent(c.connection_id)}?provider_config_key=${encodeURIComponent(integrationId)}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(`Nango ${r.status} (déconnexion)`);
  await sb.from("studio_nango_connexions").delete().eq("workspace_id", wsId).eq("integration_id", integrationId);
}

/** Lien d'invitation durable (7 jours) vers /studio/connecter/<jeton>, rattaché à UN espace. */
export async function creerInvitation(sb: SupabaseClient, p: {
  wsId: string; integrationId?: string | null; email?: string | null; creePar: string; origine: string;
}): Promise<{ url: string; expire: string }> {
  if (p.integrationId) {
    const integrations = await listerIntegrations();
    if (!integrations.some((i) => i.id === p.integrationId)) throw new Error("Application inconnue.");
  }
  const jeton = nouveauJeton();
  const expire = new Date(Date.now() + INVITATION_JOURS * 86_400_000).toISOString();
  const { error } = await sb.from("studio_connexion_invitations").insert({
    token_hash: await sha256(jeton), workspace_id: p.wsId, integration_id: p.integrationId ?? null,
    email: p.email ?? null, cree_par: p.creePar, expires_at: expire,
  });
  if (error) throw new Error(error.message);
  return { url: `${p.origine.replace(/\/$/, "")}/studio/connecter/${jeton}`, expire };
}

/** Ouverture publique d'une invitation : l'espace vient de l'invitation, pas de la requête. */
export async function ouvrirInvitation(sb: SupabaseClient, jeton: unknown) {
  if (typeof jeton !== "string" || jeton.length !== 64) return null;
  const { data: inv } = await sb.from("studio_connexion_invitations")
    .select("id, workspace_id, integration_id, email, expires_at, studio_workspaces!inner(nom, actif)")
    .eq("token_hash", await sha256(jeton)).maybeSingle();
  if (!inv || new Date(inv.expires_at) < new Date()) return null;
  const ws = inv.studio_workspaces as unknown as { nom: string; actif: boolean };
  if (!ws.actif) return null;
  await sb.from("studio_connexion_invitations").update({ ouvert_at: new Date().toISOString() }).eq("id", inv.id);
  const { lien } = await lienConnexion({
    wsId: inv.workspace_id, wsNom: ws.nom, email: inv.email, integrationId: inv.integration_id,
  });
  const integrations = await listerIntegrations();
  return {
    lien, espace: ws.nom.replace(/^Démo — /, ""),
    application: inv.integration_id ? (integrations.find((i) => i.id === inv.integration_id)?.nom ?? inv.integration_id) : null,
  };
}

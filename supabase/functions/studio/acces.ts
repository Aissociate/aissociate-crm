// Connecteurs réservés à certains agents (table studio_connecteur_agents).
//
// Clé d'un connecteur :
// - « zernio:<id> » pour un compte relié en un clic (messagerie, agenda, fichiers, réseau social, application) ;
// - le type de la ligne studio_connecteurs (« api:brevo », « mcp:notion », « smtp »…).
// Pas de ligne pour une clé = toute l'équipe : rien ne change pour un connecteur jamais réglé.
// Les fonctions pures sont testées (acces.test.ts).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type Acces = Map<string, string[]>;

export const cleZernio = (id: string) => `zernio:${id}`;

/** Clé valable : un compte Zernio ou un type de connecteur (lettres, chiffres, « : . _ - »). */
export const cleValide = (cle: unknown): cle is string => typeof cle === "string" && /^[a-z0-9][a-z0-9:._-]{0,199}$/i.test(cle);

/** L'agent peut-il se servir de ce connecteur ? Sans réglage : oui. */
export function autorise(acces: Acces, cle: string, agentId: string): boolean {
  const agents = acces.get(cle);
  return !agents || agents.includes(agentId);
}

/** Garde ce que l'agent peut utiliser (sans agent précis : tout). */
export function filtrer<T>(liste: T[], cle: (x: T) => string, acces: Acces, agentId?: string | null): T[] {
  return agentId ? liste.filter((x) => autorise(acces, cle(x), agentId)) : liste;
}

/**
 * Agents retenus pour un connecteur : null = toute l'équipe (la ligne est supprimée).
 * Inconnus écartés ; tous les agents cochés revient à « toute l'équipe ».
 */
export function agentsRetenus(demandes: unknown, equipe: string[]): string[] | null | { erreur: string } {
  if (demandes === null || demandes === undefined) return null;
  if (!Array.isArray(demandes)) return { erreur: "Liste d'agents invalide." };
  const ok = [...new Set(demandes.map(String))].filter((a) => equipe.includes(a));
  if (!ok.length) return { erreur: "Choisissez au moins un agent, ou « Toute l'équipe »." };
  return equipe.every((a) => ok.includes(a)) ? null : ok;
}

/** Réglages de l'espace ; table absente (migration non passée) ou erreur : toute l'équipe partout. */
export async function chargerAcces(sb: SupabaseClient, wsId: string): Promise<Acces> {
  const { data, error } = await sb.from("studio_connecteur_agents").select("cle, agents").eq("workspace_id", wsId);
  if (error || !data) return new Map();
  return new Map(data.map((l) => [String(l.cle), (l.agents ?? []) as string[]]));
}

export async function reglerAcces(sb: SupabaseClient, wsId: string, cle: string, agents: string[] | null): Promise<{ erreur?: string }> {
  const { error } = agents
    ? await sb.from("studio_connecteur_agents").upsert({ workspace_id: wsId, cle, agents, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,cle" })
    : await sb.from("studio_connecteur_agents").delete().eq("workspace_id", wsId).eq("cle", cle);
  return error ? { erreur: /studio_connecteur_agents/.test(error.message) ? "Réglage indisponible pour le moment (mise à jour en cours)." : error.message } : {};
}

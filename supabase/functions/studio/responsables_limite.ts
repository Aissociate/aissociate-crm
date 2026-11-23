// Limite de responsables d'un espace, sans dépendance à l'envoi d'e-mails : importable par stripe.ts
// (appliquerContrat) et par les tests. La gestion par le propriétaire est dans responsables.ts.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { journaliser } from "./journal.ts";
import { enTrop, type Responsable } from "./contrats.ts";

export async function lister(sb: SupabaseClient, wsId: string) {
  const [{ data: comptes }, { data: ws }] = await Promise.all([
    sb.from("studio_users").select("id, email, prenom, nom, role, actif, created_at").eq("workspace_id", wsId).order("created_at"),
    sb.from("studio_workspaces").select("max_utilisateurs").eq("id", wsId).maybeSingle(),
  ]);
  const liste = (comptes ?? []) as Responsable[];
  return { responsables: liste, max: Number(ws?.max_utilisateurs ?? 1), actifs: liste.filter((c) => c.actif).length };
}

/** Après un changement de contrat : désactive les comptes au-delà de la nouvelle limite. */
export async function ajuster(sb: SupabaseClient, wsId: string, max: number) {
  const { responsables } = await lister(sb, wsId);
  const ids = enTrop(responsables, max);
  if (!ids.length) return [];
  await sb.from("studio_users").update({ actif: false }).in("id", ids);
  await sb.from("studio_sessions").delete().in("user_id", ids);
  await journaliser(sb, {
    wsId, acteur: "systeme", action: "responsables_desactives",
    detail: { max, emails: responsables.filter((r) => ids.includes(r.id)).map((r) => r.email) },
  });
  return ids;
}

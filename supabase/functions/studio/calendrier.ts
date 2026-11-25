// Calendrier par défaut de l'espace (Aujourd'hui › Calendrier) : ce qui est prévu, sans agenda externe.
//
// Trois sources, toutes internes au Studio :
// - les rappels (studio_rappels) posés par un agent (outil rappel_programmer) ou par l'utilisateur ;
// - les prochains passages des routines actives (studio_taches : jours 1 = lundi … 7 = dimanche, heures pleines) ;
// - les publications programmées sur les réseaux (livrables reseaux_publier avec une date), validées ou à valider.
// Heures : La Réunion (UTC+4, sans heure d'été).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { prochaineExecution } from "./taches.ts";

export type TypeEvenement = "rappel" | "routine" | "publication";
export type Evenement = {
  id: string; type: TypeEvenement; quand: string; titre: string; agent_id: string | null;
  note?: string | null; statut?: string | null; fait?: boolean; ref_id?: string | null;
};

const JOUR_MS = 86_400_000;
const DECALAGE_MS = 4 * 3_600_000;
export const JOURS_DEFAUT = 30;
export const JOURS_MAX = 92;
export const TITRE_MAX = 200;
export const NOTE_MAX = 2000;
/** Rappels à venir au plus par espace (garde-fou contre un agent qui boucle). */
export const RAPPELS_MAX = 300;
const PASSAGES_MAX = 120;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const jourValide = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
/** Minuit (heure de La Réunion) d'une date « AAAA-MM-JJ », en UTC. */
const minuit = (d: string) => new Date(`${d}T00:00:00+04:00`);
/** Date du jour à La Réunion, « AAAA-MM-JJ ». */
export const aujourdhui = (maintenant = new Date()) => new Date(maintenant.getTime() + DECALAGE_MS).toISOString().slice(0, 10);

/** Période demandée : du = début de journée (défaut : aujourd'hui), au = fin de journée (défaut : +30 jours), 92 jours au plus. */
export function bornes(du?: unknown, au?: unknown, maintenant = new Date()): { debut: Date; fin: Date } {
  const debut = minuit(jourValide(du) ?? aujourdhui(maintenant));
  const finDemandee = jourValide(au) ? new Date(minuit(jourValide(au)!).getTime() + JOUR_MS - 1) : new Date(debut.getTime() + JOURS_DEFAUT * JOUR_MS - 1);
  const fin = new Date(Math.min(Math.max(finDemandee.getTime(), debut.getTime()), debut.getTime() + JOURS_MAX * JOUR_MS - 1));
  return { debut, fin };
}

/** « 2026-12-03T09:30 » (heure de La Réunion) → instant UTC ; null si le format est invalide. */
export function instantReunion(v: unknown): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(String(v ?? "").trim());
  if (!m || Number(m[2]) > 23 || Number(m[3]) > 59) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00+04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Passages d'une routine entre deux instants (bornes comprises). */
export function passages(p: { heures: number[]; jours: number[] }, debut: Date, fin: Date, max = PASSAGES_MAX): Date[] {
  const out: Date[] = [];
  let n = prochaineExecution(p, new Date(debut.getTime() - 1));
  while (n && n <= fin && out.length < max) {
    out.push(n);
    n = prochaineExecution(p, n);
  }
  return out;
}

/** Champs d'un rappel saisi (agent ou utilisateur), vérifiés. */
export function rappelValide(v: { titre?: unknown; quand?: unknown; note?: unknown }, maintenant = new Date()):
  { titre: string; quand: Date; note: string | null } | { erreur: string } {
  const titre = String(v.titre ?? "").trim().slice(0, TITRE_MAX);
  if (!titre) return { erreur: "Titre du rappel requis." };
  const quand = instantReunion(v.quand);
  if (!quand) return { erreur: "Date et heure requises : AAAA-MM-JJTHH:MM, heure de La Réunion." };
  if (quand.getTime() < maintenant.getTime() - 60_000) return { erreur: "Cette date est passée : un rappel se pose dans le futur." };
  if (quand.getTime() > maintenant.getTime() + 2 * 365 * JOUR_MS) return { erreur: "Un rappel se pose dans les deux ans à venir." };
  const note = String(v.note ?? "").trim().slice(0, NOTE_MAX) || null;
  return { titre, quand, note };
}

type LigneRoutine = { id: string; titre: string; agent_id: string; heures: number[]; jours: number[] };
type LigneRappel = { id: string; titre: string; agent_id: string | null; note: string | null; quand: string; fait_le: string | null };
type LignePublication = { id: string; titre: string; agent_id: string | null; statut: string; action: Record<string, unknown> | null };

/** Assemble les trois sources, triées par date (pur, testé). */
export function assembler(
  src: { rappels: LigneRappel[]; routines: LigneRoutine[]; publications: LignePublication[] },
  debut: Date, fin: Date,
): Evenement[] {
  const evts: Evenement[] = [];
  for (const r of src.rappels) {
    evts.push({ id: `rappel:${r.id}`, type: "rappel", quand: new Date(r.quand).toISOString(), titre: r.titre, agent_id: r.agent_id, note: r.note, fait: Boolean(r.fait_le), ref_id: r.id });
  }
  for (const t of src.routines) {
    for (const d of passages({ heures: t.heures ?? [], jours: t.jours ?? [] }, debut, fin)) {
      evts.push({ id: `routine:${t.id}:${d.getTime()}`, type: "routine", quand: d.toISOString(), titre: t.titre, agent_id: t.agent_id, ref_id: t.id });
    }
  }
  for (const l of src.publications) {
    const quand = instantReunion(l.action?.programme);
    if (!quand || quand < debut || quand > fin) continue;
    evts.push({ id: `publication:${l.id}`, type: "publication", quand: quand.toISOString(), titre: l.titre, agent_id: l.agent_id, statut: l.statut, ref_id: l.id });
  }
  return evts.sort((a, b) => a.quand.localeCompare(b.quand) || a.titre.localeCompare(b.titre));
}

/** Calendrier de l'espace sur une période. Table des rappels absente (migration non appliquée) → sans rappels. */
export async function lireCalendrier(sb: SupabaseClient, wsId: string, debut: Date, fin: Date): Promise<Evenement[]> {
  const [rappels, routines, publications] = await Promise.all([
    sb.from("studio_rappels").select("id, titre, agent_id, note, quand, fait_le").eq("workspace_id", wsId)
      .gte("quand", debut.toISOString()).lte("quand", fin.toISOString()).order("quand").limit(500),
    sb.from("studio_taches").select("id, titre, agent_id, heures, jours").eq("workspace_id", wsId).eq("actif", true).limit(100),
    sb.from("studio_livrables").select("id, titre, agent_id, statut, action").eq("workspace_id", wsId)
      .eq("action->>type", "reseaux_publier").in("statut", ["a_valider", "valide"]).not("action->>programme", "is", null)
      .order("created_at", { ascending: false }).limit(200),
  ]);
  return assembler({
    rappels: (rappels.data ?? []) as LigneRappel[],
    routines: (routines.data ?? []) as LigneRoutine[],
    publications: (publications.data ?? []) as LignePublication[],
  }, debut, fin);
}

/** Pose un rappel (agent ou utilisateur). */
export async function creerRappel(sb: SupabaseClient, p: {
  wsId: string; titre: unknown; quand: unknown; note?: unknown; agentId?: string | null; creePar: string; conversationId?: string | null;
}): Promise<{ id: string; titre: string; quand: Date } | { erreur: string }> {
  const v = rappelValide(p);
  if ("erreur" in v) return v;
  const { count } = await sb.from("studio_rappels").select("id", { count: "exact", head: true })
    .eq("workspace_id", p.wsId).is("fait_le", null).gte("quand", new Date().toISOString());
  if ((count ?? 0) >= RAPPELS_MAX) return { erreur: `${RAPPELS_MAX} rappels à venir au plus : supprimez ou cochez ceux qui ne servent plus.` };
  const { data, error } = await sb.from("studio_rappels").insert({
    workspace_id: p.wsId, agent_id: p.agentId ?? null, titre: v.titre, note: v.note, quand: v.quand.toISOString(),
    cree_par: p.creePar, conversation_id: UUID.test(String(p.conversationId ?? "")) ? p.conversationId : null,
  }).select("id").single();
  if (error || !data) return { erreur: /studio_rappels/.test(error?.message ?? "") ? "Calendrier indisponible pour le moment (mise à jour en cours)." : error?.message ?? "Rappel non enregistré." };
  return { id: String(data.id), titre: v.titre, quand: v.quand };
}

/** « mercredi 3 décembre à 09:30 » (heure de La Réunion). */
export const lisible = (d: Date | string) =>
  new Date(d).toLocaleString("fr-FR", { timeZone: "Indian/Reunion", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** Résumé texte du calendrier pour un agent (outil calendrier_lister). */
export function texteCalendrier(evts: Evenement[], prenoms: Map<string, string>): string {
  if (!evts.length) return "Rien de prévu sur cette période.";
  const quoi: Record<TypeEvenement, string> = { rappel: "Rappel", routine: "Routine", publication: "Publication programmée" };
  return evts.slice(0, 150).map((e) => {
    const qui = e.agent_id ? ` (${prenoms.get(e.agent_id) ?? e.agent_id})` : "";
    const etat = e.type === "rappel" && e.fait ? " [fait]" : e.type === "publication" && e.statut === "a_valider" ? " [à valider]" : "";
    return `- ${lisible(e.quand)} · ${quoi[e.type]}${qui} : ${e.titre}${etat}${e.note ? ` — ${e.note.slice(0, 200)}` : ""}`;
  }).join("\n") + (evts.length > 150 ? `\n… et ${evts.length - 150} autres.` : "");
}

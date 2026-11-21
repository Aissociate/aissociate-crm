// Routine proposée depuis le chat : Léa (outil routine_proposer) décrit une vraie routine
// planifiée — étapes, consigne, jours et heures — au lieu d'un simple document. La proposition
// devient une décision « à valider » ; au « VALIDÉ », la routine est créée en mode essai
// (7 jours, rien n'est envoyé), exactement comme depuis la page « Routines ».
// Contrôles : ceux de la proposition de la page Routines (validerProposition) — agents de
// l'équipe seulement, « Vous validez » devant tout envoi.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { journaliser } from "./journal.ts";
import { chaine, validerProposition, type Etape } from "./routines.ts";
import { libellePlanning, planningValide, prochaineExecution } from "./taches.ts";

export const NOM_OUTIL_ROUTINE = "routine_proposer";
/** Durée du mode essai d'une nouvelle routine (jours). */
export const ESSAI_JOURS = 7;
/** Routines au plus par espace. */
export const ROUTINES_MAX = 20;

export type ActionRoutine = {
  type: "routine_creer"; titre: string; agent: string; etapes: Etape[]; consigne: string;
  heures: number[]; jours: number[]; contenu: string;
  /** Qui a demandé la routine (null : demande reçue par e-mail → propriétaire de l'espace). */
  user_id?: string | null;
};

type Membre = { id: string; prenom: string };

export function definitionRoutine(equipe: Membre[]) {
  return {
    type: "function" as const,
    function: {
      name: NOM_OUTIL_ROUTINE,
      description: "Propose une ROUTINE : un travail rejoué automatiquement aux jours et heures choisis (heure de La Réunion) par un agent de l'équipe. À utiliser dès que le dirigeant demande une routine, une tâche récurrente, régulière ou automatique (« chaque lundi… », « tous les matins… ») : un document ou une méthode ne se déclenche jamais seul. La routine est créée quand le dirigeant valide la décision, puis tourne 7 jours en mode essai (rien n'est envoyé) avant qu'il la mette en route. Tout ce qui part (e-mail, publication) reste soumis à sa validation à chaque passage.",
      parameters: {
        type: "object",
        properties: {
          titre: { type: "string", description: "Nom court de la routine (« Posts réseaux du lundi, mercredi, vendredi »)" },
          agent: { type: "string", enum: equipe.map((a) => a.id), description: "Agent qui exécute la routine à chaque passage" },
          etapes: {
            type: "array", description: "2 à 6 étapes dans l'ordre. Une étape « envoi » (envoyer, publier) vient toujours après une étape « validation ».",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["agent", "validation", "envoi"] },
                agent: { type: "string", enum: equipe.map((a) => a.id), description: "Pour agent et envoi" },
                texte: { type: "string", description: "Phrase courte dont l'agent est le sujet (« Hugo rédige les 3 posts de la semaine »)" },
              },
              required: ["type"],
            },
          },
          consigne: { type: "string", description: "Consigne détaillée relue par l'agent à chaque passage : ce qu'il fait à chaque étape, les outils à utiliser, les règles à respecter (méthodes et documents de l'espace à suivre, cités par leur titre), ce qu'il ne faut pas inventer." },
          jours: { type: "array", items: { type: "integer" }, description: "Jours de passage : 1 = lundi … 7 = dimanche" },
          heures: { type: "array", items: { type: "integer" }, description: "Heures de passage, de 6 à 22 (heure de La Réunion)" },
        },
        required: ["titre", "agent", "etapes", "consigne", "jours", "heures"],
      },
    },
  };
}

export const CONSIGNE_ROUTINE = `## Outil : routines
- Quand le dirigeant demande une routine ou un travail récurrent, propose-la avec ${NOM_OUTIL_ROUTINE} (en plus d'un éventuel document de méthode) : sans cet outil, rien ne se déclenche tout seul. N'annonce jamais une routine comme « en place » ou « automatique » : donne la référence renvoyée et dis qu'elle démarrera en essai après sa validation.`;

/** Aperçu de la décision : quand, déroulé, mode essai, consigne. */
export function apercuRoutine(a: Omit<ActionRoutine, "contenu" | "type">, prenoms: Map<string, string>): string {
  const etapes = chaine({ titre: a.titre, agent_id: a.agent, heures: a.heures, jours: a.jours, etapes: a.etapes }, prenoms).slice(1);
  return [
    `**Quand :** ${libellePlanning({ heures: a.heures, jours: a.jours })} (heure de La Réunion)`,
    `**Exécutée par :** ${prenoms.get(a.agent) ?? a.agent}`,
    `**Déroulé :**\n${etapes.map((e, i) => `${i + 1}. ${e.type === "validation" ? `Vous validez — ${e.texte.charAt(0).toLowerCase()}${e.texte.slice(1)}` : e.texte}`).join("\n")}`,
    `**Démarrage :** à votre validation, en mode essai pendant ${ESSAI_JOURS} jours (les agents préparent, rien n'est envoyé) ; vous la mettez ensuite en route depuis « Routines ».`,
    `---\n\n**Consigne suivie à chaque passage :**\n\n${a.consigne}`,
  ].join("\n\n");
}

/** Arguments de l'agent → action à valider, ou erreur à lui renvoyer pour qu'il corrige. */
export function actionRoutine(args: Record<string, unknown>, equipe: Membre[], userId: string | null): ActionRoutine | { erreur: string } {
  const p = planningValide({ heures: args.heures, jours: args.jours });
  if ("erreur" in p) return { erreur: `${p.erreur} (jours 1 = lundi … 7 = dimanche, heures 6 à 22).` };
  const heures = p.heures.filter((h) => h >= 6 && h <= 22);
  if (!heures.length) return { erreur: "Heures de passage entre 6 et 22 (heure de La Réunion)." };
  const v = validerProposition({ titre: args.titre, agent: args.agent, etapes: args.etapes, consigne: args.consigne, planning: { heures, jours: p.jours } }, equipe);
  if ("erreur" in v) return { erreur: `${v.erreur.replace(/ Reformulez-la en une phrase\.$/, "")} Précise un titre, une consigne détaillée et des étapes dont le sujet est un agent de l'équipe.` };
  const prenoms = new Map(equipe.map((a) => [a.id, a.prenom]));
  const base = { titre: v.titre, agent: v.agent, etapes: v.etapes, consigne: v.consigne, heures: v.planning.heures, jours: v.planning.jours };
  return { type: "routine_creer", ...base, contenu: apercuRoutine(base, prenoms), user_id: userId };
}

/** « VALIDÉ » : la routine est créée en mode essai. */
export async function creerRoutineValidee(sb: SupabaseClient, wsId: string, a: ActionRoutine): Promise<{ ok: true; id: string; lien: null } | { ok: false; erreur: string }> {
  const { count } = await sb.from("studio_taches").select("id", { count: "exact", head: true }).eq("workspace_id", wsId);
  if ((count ?? 0) >= ROUTINES_MAX) return { ok: false, erreur: `${ROUTINES_MAX} routines au maximum par espace : mettez-en une en pause ou supprimez-la dans « Routines ».` };
  let userId = a.user_id ?? null;
  if (!userId) {
    const { data } = await sb.from("studio_users").select("id").eq("workspace_id", wsId).eq("role", "proprietaire").eq("actif", true).limit(1).maybeSingle();
    userId = data?.id ? String(data.id) : null;
  }
  if (!userId) return { ok: false, erreur: "Propriétaire de l'espace introuvable." };
  const maintenant = new Date();
  const { data, error } = await sb.from("studio_taches").insert({
    workspace_id: wsId, user_id: userId, agent_id: a.agent, titre: a.titre.slice(0, 120), consigne: a.consigne.slice(0, 4000),
    modele: null, reglages: {}, etapes: a.etapes, heures: a.heures, jours: a.jours, actif: true,
    essai_jusqu_au: new Date(maintenant.getTime() + ESSAI_JOURS * 86_400_000).toISOString(),
    prochaine_execution: prochaineExecution({ heures: a.heures, jours: a.jours }, maintenant)?.toISOString() ?? null,
  }).select("id").single();
  if (error || !data) return { ok: false, erreur: error?.message ?? "Routine non créée." };
  await journaliser(sb, {
    wsId, acteur: "proprietaire", agentId: a.agent, action: "routine_creee",
    detail: { tache: data.id, titre: a.titre, modele: null, essai_jours: ESSAI_JOURS, depuis: "chat" },
  });
  return { ok: true, id: String(data.id), lien: null };
}

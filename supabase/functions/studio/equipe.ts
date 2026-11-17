// Missions d'équipe : l'agent qui pilote une demande consulte un collègue de l'espace
// (outil consulter_collegue) puis intègre sa contribution dans un seul livrable.
// Exemple : un article de blog, angle et ton par le marketing, mots-clés par le SEO.
// Garde-fous : 3 consultations par demande au plus ; le collègue consulté répond sans
// outils, donc ne peut pas consulter à son tour ; son coût s'ajoute à celui de la demande ;
// la consultation ne compte pas dans le quota (aucun message client n'est créé).
import type { DefinitionOutil } from "./outils.ts";

export const NOM_OUTIL = "consulter_collegue";
export const MAX_CONSULTATIONS = 3;

export type Collegue = { id: string; prenom: string; metier: string };

export function definition(collegues: Collegue[]): DefinitionOutil {
  return {
    type: "function", function: {
      name: NOM_OUTIL,
      description: "Consulte un collègue de l'équipe sur la partie d'une demande qui relève de son métier (ex. mots-clés SEO pour un article, angle marketing, chiffrage). Il te répond directement ; tu intègres sa contribution dans ta réponse. "
        + `${MAX_CONSULTATIONS} consultations au plus par demande.`,
      parameters: {
        type: "object",
        properties: {
          agent_id: { type: "string", enum: collegues.map((c) => c.id), description: "Id du collègue consulté" },
          question: { type: "string", description: "Ce que tu attends de lui, avec le contexte utile (sujet, cible, contraintes, ton brouillon s'il y en a un)" },
        },
        required: ["agent_id", "question"],
      },
    },
  };
}

export function consigne(collegues: Collegue[]): string {
  return [
    "## Travail en équipe",
    "Collègues consultables avec consulter_collegue :",
    ...collegues.map((c) => `- ${c.prenom} (${c.metier}) — id ${c.id}`),
    "- Quand une demande relève surtout de ton métier mais qu'une partie touche celui d'un collègue (ex. un article de blog qui demande un angle marketing et une optimisation SEO), garde la main : consulte le collègue sur cette partie, puis livre UN résultat complet qui intègre sa contribution. C'est préférable à la balise de relais, qui oblige le client à renvoyer sa demande.",
    "- Garde la balise de relais pour une demande qui sort ENTIÈREMENT de ton métier.",
    `- Pose une question précise et autonome (le collègue ne voit pas la conversation). ${MAX_CONSULTATIONS} consultations au plus par demande ; ne consulte pas pour une partie que tu sais faire.`,
  ].join("\n");
}

/** Consigne ajoutée au prompt du collègue consulté. */
export function consigneConsulte(pilote: { prenom: string; metier: string }): string {
  return `## Consultation interne
${pilote.prenom} (${pilote.metier}), ton collègue, te consulte sur la partie de sa mission qui relève de ton métier. Réponds-lui directement et concrètement, prêt à intégrer : pas de salutation, pas de question en retour, pas de balise de relais. Si une partie ne relève pas de toi, ignore-la.`;
}

/** Réponse du collègue nettoyée (balise de relais retirée, longueur bornée). */
export function nettoyer(texte: string): string {
  return texte.replace(/\[\[RELAIS:[^\]]*\]\]/gi, "").trim().slice(0, 12_000);
}

/** Mention discrète ajoutée à la réponse finale. */
export function mentionAide(aides: string[]): string {
  const noms = [...new Set(aides)];
  if (!noms.length) return "";
  const liste = noms.length === 1 ? noms[0] : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
  return `_Avec l'aide de ${liste}._`;
}

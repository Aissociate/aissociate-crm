// Missions d'équipe : l'agent qui pilote une demande consulte un collègue de l'espace
// (outil consulter_collegue) puis intègre sa contribution dans un seul livrable.
// Exemple : un article de blog, angle et ton par le marketing, mots-clés par le SEO.
// Garde-fous : 3 consultations par demande au plus ; le collègue consulté répond sans
// outils, donc ne peut pas consulter à son tour ; son coût s'ajoute à celui de la demande ;
// la consultation ne compte pas dans le quota (aucun message client n'est créé).
import type { DefinitionOutil } from "./outils.ts";
import type { Champ } from "./contexte.ts";
import { listePouvoirs, type PouvoirCollegue } from "./pouvoirs.ts";

export const NOM_OUTIL = "consulter_collegue";
export const MAX_CONSULTATIONS = 3;

export type Collegue = { id: string; prenom: string; metier: string; pouvoirs?: PouvoirCollegue[] };

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

// ─────────────────────────────────────────────────────────────────────────────
// Orchestration : Léa est le point d'entrée de l'espace. Elle confie le travail
// aux spécialistes (outil confier_mission), relit ce qu'ils rendent, le leur
// renvoie pour correction s'il le faut, puis répond au client en une seule fois.
// À la différence de consulter_collegue, le spécialiste travaille AVEC ses
// outils (recherche web, base de connaissances, notes, brouillons à valider) et
// garde le fil de la mission : un second appel au même collègue est une reprise.
// Garde-fous : MAX_MISSIONS appels par demande, MAX_PAR_COLLEGUE par collègue
// (une mission + deux reprises), TOURS_MISSION tours d'outils par appel. Le coût
// de tout l'aller-retour s'ajoute à celui de la demande, qui compte pour une.
// ─────────────────────────────────────────────────────────────────────────────
export const ORCHESTRATEUR = "lea";
export const NOM_MISSION = "confier_mission";
export const MAX_MISSIONS = 6;
export const MAX_PAR_COLLEGUE = 3;
export const TOURS_MISSION = 5;
/** Dernier tour d'une mission : le spécialiste doit rendre son travail, sans outil. */
export const RELANCE_MISSION = "(Tu as assez d'éléments. Rends maintenant ton travail complet, sans appeler d'outil ; liste en « Points à confirmer » ce que tu n'as pas pu vérifier.)";
/** Plafond de jetons d'un tour de mission, raisonnement compris : un livrable long (12 textes) dépassait 8 000. */
export const PLAFOND_MISSION = 16_000;
/** Réponse vide parce que le plafond est atteint (le raisonnement l'a consommé) : relancer sans raisonnement, une fois. */
export const relancerSansRaisonnement = (fin: string, dejaSansRaisonnement: boolean) => fin === "length" && !dejaSansRaisonnement;

export const estOrchestrateur = (agentId: string) => agentId === ORCHESTRATEUR;

/** Agents facturés : l'orchestratrice est incluse dans tous les espaces, elle ne compte pas. */
export const nbFactures = (agents: { id: string }[]) => agents.filter((a) => !estOrchestrateur(a.id)).length;

export function definitionMission(collegues: Collegue[]): DefinitionOutil {
  return {
    type: "function", function: {
      name: NOM_MISSION,
      description: "Confie une mission à un spécialiste de l'équipe, qui la réalise avec ses propres outils et te rend son travail. "
        + "Rappeler le même spécialiste poursuit la mission : il a gardé son travail, donne-lui seulement tes corrections. "
        + `${MAX_MISSIONS} appels au plus par demande, ${MAX_PAR_COLLEGUE} par spécialiste.`,
      parameters: {
        type: "object",
        properties: {
          agent_id: { type: "string", enum: collegues.map((c) => c.id), description: "Id du spécialiste" },
          consigne: { type: "string", description: "Premier appel : la mission complète et autonome (demande du client, objectif, cible, contraintes, éléments déjà fournis, travail d'un autre collègue à reprendre). Appels suivants : ce qui doit être corrigé ou complété, point par point. Avec un super-pouvoir : les précisions qui complètent ses champs." },
          pouvoir: { type: "string", description: "Facultatif : id d'un super-pouvoir du spécialiste à activer (liste dans ton rôle). Un super-pouvoir visuel ou vidéo crée directement le média, affiché au client sous ta réponse." },
          valeurs: { type: "object", additionalProperties: { type: "string" }, description: "Avec pouvoir : valeurs de ses champs, par nom de champ (ex. {\"sujet\": \"…\", \"format\": \"4:5\"})." },
        },
        required: ["agent_id"],
      },
    },
  };
}

/** Remplace la règle de périmètre du spécialiste dans le prompt de l'orchestratrice. */
export function perimetreOrchestrateur(collegues: Collegue[]): string {
  if (!collegues.length) {
    return `## Ton rôle
Tu es l'interlocutrice unique de l'entreprise dans cet espace. Aucun spécialiste n'est encore ouvert : traite toi-même les demandes, et quand un sujet demande une expertise métier poussée (comptabilité, juridique, SEO, RH, prospection, marketing), fais au mieux puis signale qu'un spécialiste peut être ajouté à l'équipe depuis « Mon périmètre ».`;
  }
  return `## Ton rôle : point d'entrée et chef d'orchestre
Tu es l'interlocutrice unique de l'entreprise. Le client te parle à toi ; tu fais travailler les spécialistes en coulisse avec ${NOM_MISSION}, tu contrôles leur travail, et tu rends UNE réponse complète.

Spécialistes de l'espace :
${collegues.map((c) => `- ${c.prenom} (${c.metier}) — id ${c.id}${c.pouvoirs?.length ? `\n  Super-pouvoirs : ${listePouvoirs(c.pouvoirs)}` : ""}`).join("\n")}

Méthode, à chaque demande :
1. Trier. Une salutation, une question sur l'espace, une tâche d'organisation ou d'assistanat courant (reformuler, résumer, classer, planifier) : réponds toi-même, sans mobiliser personne. Tout ce qui relève du métier d'un spécialiste de la liste : confie-le-lui TOUJOURS, même pour une question courte, même si tu connais la réponse, même si une note ou une recherche te la donnerait. Il a la méthode et la base de connaissances de son métier ; toi, tu contrôles. Ne fais pas toi-même la recherche ou la rédaction qui lui revient.
2. Clarifier seulement si c'est bloquant. S'il manque une information sans laquelle le travail serait faux, pose au client 1 ou 2 questions AVANT de mobiliser l'équipe. Sinon avance avec des hypothèses raisonnables, que tu signaleras.
3. Confier. Le spécialiste ne voit pas la conversation : ta consigne doit se suffire (demande exacte du client, objectif, cible, contraintes, éléments et documents fournis, format attendu). Une demande à plusieurs métiers : fais intervenir chacun sur sa partie, dans l'ordre utile, et transmets au suivant le travail du précédent quand il en dépend (ex. le texte du marketing au référencement).
4. Relire avant de répondre. Vérifie le travail rendu comme le ferait une responsable exigeante : répond-il à TOUTE la demande ? Les faits, chiffres, prix et noms sont-ils ceux de la fiche entreprise et des ressources ? Est-ce cohérent entre les collègues, directement utilisable, au bon ton ? Y a-t-il une affirmation sans source sur un sujet sensible (droit, fiscalité, social) ?
   Une demande qui correspond à un super-pouvoir d'un spécialiste (un post, un calendrier, un visuel, une vidéo…) : active-le avec ${NOM_MISSION} (pouvoir + valeurs), il cadre le travail comme le formulaire du client. Pour un visuel ou une vidéo, c'est le seul moyen d'en créer un : ne te contente pas d'en écrire la description.
5. Renvoyer si nécessaire. Si un point ne va pas, rappelle le même spécialiste avec des corrections précises, point par point (deux reprises au plus par spécialiste). Ne renvoie pas pour des détails de style que tu peux ajuster toi-même.
6. Répondre. Assemble une réponse unique, prête à l'emploi, comme si elle venait d'une seule personne : pas de récit des échanges internes. Reprends fidèlement le contenu des spécialistes, leurs sources, et les références des éléments qu'ils ont préparés (documents, brouillons à valider L-xxxx). Signale en une ligne les hypothèses prises et les points que le client doit confirmer.

Règles :
- N'écris jamais de balise [[RELAIS:…]] et ne demande jamais au client de s'adresser à quelqu'un d'autre : c'est toi qui fais circuler la demande.
- N'annonce pas que tu « vas transmettre » sans le faire : appelle ${NOM_MISSION} tout de suite, sans texte d'annonce.
- Si un spécialiste ne peut pas répondre ou si la limite d'appels est atteinte, termine avec ce que tu as et dis clairement ce qui manque.
- Si la demande relève d'un métier qu'aucun spécialiste de l'espace ne couvre, traite-la au mieux toi-même et précise la limite.`;
}

/** Consigne ajoutée au prompt du spécialiste qui travaille pour l'orchestratrice. */
export function consigneMission(pilote: { prenom: string }): string {
  return `## Mission confiée par ${pilote.prenom}
${pilote.prenom}, qui coordonne l'équipe, te confie une mission pour le client. C'est elle qui lui répondra : tu lui rends ton travail, tu ne t'adresses pas au client.
- Réalise la mission entièrement, avec tes outils si besoin (recherche, base de connaissances, notes, documents, brouillons à valider). Va à l'essentiel : deux recherches web et deux lectures de page au plus, puis rédige. Rends un travail fini, prêt à être repris tel quel : pas de salutation, pas de plan d'intention.
- Ne pose pas de question en retour. S'il manque une information, prends l'hypothèse la plus raisonnable et termine par une section « Points à confirmer » qui la liste.
- Garde tes sources (ligne « Sources : ») et donne la référence de tout élément que tu as préparé (document, brouillon L-xxxx).
- Si ${pilote.prenom} te renvoie ton travail avec des corrections, rends la version corrigée COMPLÈTE, pas seulement les modifications.
- N'écris aucune balise [[RELAIS:…]]. Si une partie ne relève pas de ton métier, dis-le en une ligne et traite le reste.`;
}

/** Refus d'un appel de mission (limites), ou null s'il peut partir. */
export function refusMission(nbTotal: number, nbCollegue: number): string | null {
  if (nbTotal >= MAX_MISSIONS) return `Limite de ${MAX_MISSIONS} appels à l'équipe atteinte : rédige ta réponse avec ce que tu as.`;
  if (nbCollegue >= MAX_PAR_COLLEGUE) return `Ce spécialiste a déjà été sollicité ${MAX_PAR_COLLEGUE} fois : termine avec sa dernière version.`;
  return null;
}

/**
 * Valeurs d'un super-pouvoir activé par Léa. Les champs requis encore vides reçoivent la consigne
 * (le sujet d'un visuel, par exemple) ; un choix requis vide prend sa première option.
 */
export function valeursMission(sp: { champs: Champ[] }, brut: unknown, consigne: string): Record<string, string> {
  const src = brut && typeof brut === "object" && !Array.isArray(brut) ? brut as Record<string, unknown> : {};
  const v: Record<string, string> = {};
  for (const c of sp.champs) {
    const x = String(src[c.nom] ?? "").trim();
    if (x) v[c.nom] = x;
  }
  let consigneUtilisee = false;
  for (const c of sp.champs) {
    if (!c.requis || v[c.nom]) continue;
    if (c.type === "choix" && c.options?.length) v[c.nom] = c.options[0];
    else if (consigne && !consigneUtilisee) { v[c.nom] = consigne; consigneUtilisee = true; }
  }
  return v;
}

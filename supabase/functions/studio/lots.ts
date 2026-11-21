// Traitements en lots dans « Mes ressources » : gestion groupée (activer, ranger, supprimer)
// et documents confiés à un agent, un livrable par document ou une synthèse unique.
// Module pur (testé) : le moteur est dans index.ts (lot_lancer → lot_etape, une instance par document).

/** Au plus 50 ressources par opération groupée, 25 documents par lot confié à un agent. */
export const GESTION_MAX = 50;
export const LOT_MAX = 25;
/** Synthèse : tous les documents lus ensemble, 12 au plus, 120 000 caractères au total. */
export const SYNTHESE_MAX = 12;
export const SYNTHESE_TEXTE = 120_000;
/** Un document seul : 60 000 caractères lus (comme une pièce jointe du chat). */
export const DOCUMENT_TEXTE = 60_000;

export type OpGestion = "activer" | "desactiver" | "ranger" | "supprimer";
export type ModeLot = "chaque" | "synthese";

/** Identifiants uniques, bornés, de forme valide. */
export function idsValides(v: unknown, max: number): string[] | { erreur: string } {
  if (!Array.isArray(v) || !v.length) return { erreur: "Sélectionnez au moins une ressource." };
  const ids = [...new Set(v.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)))];
  if (!ids.length) return { erreur: "Sélection invalide." };
  if (ids.length > max) return { erreur: `${max} ressources au plus à la fois : affinez la sélection.` };
  return ids;
}

export function opGestion(v: unknown): OpGestion | null {
  return v === "activer" || v === "desactiver" || v === "ranger" || v === "supprimer" ? v : null;
}

export type DemandeLot = { ids: string[]; agent_id: string; consigne: string; mode: ModeLot };

/** Demande de lot contrôlée avant tout lancement : rien n'est inventé, l'erreur est dite. */
export function demandeLot(body: Record<string, unknown>, agents: string[]): DemandeLot | { erreur: string } {
  const mode: ModeLot = body.mode === "synthese" ? "synthese" : "chaque";
  const ids = idsValides(body.ids, mode === "synthese" ? SYNTHESE_MAX : LOT_MAX);
  if ("erreur" in ids) {
    return Array.isArray(body.ids) && body.ids.length > (mode === "synthese" ? SYNTHESE_MAX : LOT_MAX)
      ? { erreur: mode === "synthese" ? `Une synthèse lit ${SYNTHESE_MAX} documents au plus.` : `${LOT_MAX} documents au plus par lot.` }
      : ids;
  }
  const agent = String(body.agent_id ?? "");
  if (!agents.includes(agent)) return { erreur: "Agent indisponible pour votre offre." };
  const consigne = String(body.consigne ?? "").trim();
  if (consigne.length < 5) return { erreur: "Dites à l'agent ce qu'il doit faire des documents." };
  if (consigne.length > 2000) return { erreur: "Consigne trop longue (2 000 caractères au plus)." };
  return { ids, agent_id: agent, consigne, mode };
}

export type DocLot = { id: string; titre: string; contenu: string; actif: boolean; sensible?: string | null };

/** Un document sensible encore désactivé n'est jamais lu par un agent, même dans un lot. */
export const lisible = (d: Pick<DocLot, "actif" | "sensible">) => !(d.sensible && !d.actif);

/** Consigne envoyée à l'agent : le document arrive en pièce jointe (données, pas instructions). */
export function messageLot(consigne: string, mode: ModeLot, titres: string[]): string {
  const quoi = mode === "synthese"
    ? `Les ${titres.length} documents joints (${titres.map((t) => `« ${t} »`).join(", ")}) sont à traiter ensemble, en un seul résultat.`
    : `Le document joint (« ${titres[0]} ») fait partie d'un lot : traite-le seul, pour lui-même.`;
  return [
    `Traitement en lot demandé depuis « Mes ressources ».`,
    quoi,
    `Consigne : ${consigne}`,
    `Réponds directement avec le résultat, complet et prêt à relire : il sera déposé tel quel dans « Aujourd'hui » pour validation. N'envoie, ne publie et ne soumets rien toi-même.`,
  ].join("\n\n");
}

/** Titre du livrable : la consigne en bref, puis le document (ou « synthèse de n documents »). */
export function titreLot(consigne: string, mode: ModeLot, titres: string[]): string {
  const bref = consigne.replace(/\s+/g, " ").trim();
  const tete = bref.length > 60 ? `${bref.slice(0, 57).trimEnd()}…` : bref;
  const objet = mode === "synthese" ? `synthèse de ${titres.length} document${titres.length > 1 ? "s" : ""}` : titres[0] ?? "document";
  return `${tete} — ${objet}`.slice(0, 200);
}

/** Pièces jointes du passage : un document, ou tous bornés au budget de la synthèse. */
export function piecesLot(docs: DocLot[], mode: ModeLot): { nom: string; format: null; taille: null; contenu: string }[] {
  if (mode === "chaque") return docs.slice(0, 1).map((d) => ({ nom: d.titre, format: null, taille: null, contenu: d.contenu.slice(0, DOCUMENT_TEXTE) }));
  const part = Math.floor(SYNTHESE_TEXTE / Math.max(1, docs.length));
  return docs.slice(0, SYNTHESE_MAX).map((d) => ({ nom: d.titre, format: null, taille: null, contenu: d.contenu.slice(0, part) }));
}

/** Bilan déposé à la fin d'un lot qui a connu des échecs (sinon les livrables parlent d'eux-mêmes). */
export function bilanEchecs(consigne: string, total: number, echecs: { titre: string; erreur: string }[]): string {
  return [
    `Sur ${total} document${total > 1 ? "s" : ""} confiés (« ${consigne.slice(0, 120)} »), ${echecs.length} n'${echecs.length > 1 ? "ont" : "a"} pas pu être traité${echecs.length > 1 ? "s" : ""} :`,
    echecs.map((e) => `- ${e.titre} : ${e.erreur}`).join("\n"),
    "Les autres résultats sont dans « Aujourd'hui ». Vous pouvez relancer les documents manquants depuis « Mes ressources ».",
  ].join("\n\n");
}

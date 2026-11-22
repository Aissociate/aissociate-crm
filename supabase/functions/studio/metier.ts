// Packs métier (docs/studio-packs-metier.md) — module PUR, testé par vitest (metier.test.ts).
//
// Un pack est le savoir du SECTEUR du client (boulangerie, courtage en assurance…), préparé
// par Aissociate (tables studio_packs_metier et studio_pack_savoirs). Il s'ajoute au prompt de
// tous les agents de l'espace : règles et interdits, cas de relais à l'entreprise, informations
// à connaître, vocabulaire, et documents de référence trouvés pour la question.
import type { Savoir } from "./contexte.ts";

export type RegleMetier = { texte: string; source?: string | null };
export type RelaisMetier = { situation: string; consigne: string };
export type ChampFiche = { nom: string; libelle: string; requis?: boolean };
/** Cadre d'exercice d'un agent dans ce métier, chez ce client (harnais généré). */
export type CadreAgent = { agent_id: string; cadre: string };
export type PackMetier = {
  code: string; nom: string; version: number;
  regles: RegleMetier[]; relais: RelaisMetier[]; fiche_type: ChampFiche[]; vocabulaire: string[];
  cadres: CadreAgent[];
  savoirs: Savoir[];
};

/** Budget de caractères des documents du pack injectés pour une question. */
export const BUDGET_PACK_SAVOIRS = 6_000;

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const liste = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object") : [];

/** Ligne de studio_packs_metier (jsonb non garanti) → pack propre ; null si inexploitable. */
export function lirePack(ligne: Record<string, unknown> | null | undefined, savoirs: Savoir[] = []): PackMetier | null {
  if (!ligne || !texte(ligne.code)) return null;
  const pack: PackMetier = {
    code: texte(ligne.code),
    nom: texte(ligne.nom) || texte(ligne.code),
    version: Number(ligne.version) || 1,
    regles: liste(ligne.regles).map((r) => ({ texte: texte(r.texte), source: texte(r.source) || null })).filter((r) => r.texte),
    relais: liste(ligne.relais).map((r) => ({ situation: texte(r.situation), consigne: texte(r.consigne) })).filter((r) => r.situation && r.consigne),
    fiche_type: liste(ligne.fiche_type).map((c) => ({ nom: texte(c.nom), libelle: texte(c.libelle), requis: c.requis === true })).filter((c) => c.libelle),
    vocabulaire: (Array.isArray(ligne.vocabulaire) ? ligne.vocabulaire : []).map(texte).filter(Boolean),
    cadres: liste(ligne.cadres).map((c) => ({ agent_id: texte(c.agent_id), cadre: texte(c.cadre) })).filter((c) => c.agent_id && c.cadre),
    savoirs,
  };
  const vide = !pack.regles.length && !pack.relais.length && !pack.fiche_type.length && !pack.cadres.length && !pack.savoirs.length;
  return vide ? null : pack;
}

/** Bloc du prompt système : « Ton contexte métier » (et le cadre propre à `agentId`). Chaîne vide sans pack. */
export function blocMetier(pack: PackMetier | null | undefined, agentId?: string): string {
  if (!pack) return "";
  const parts = [`## Ton contexte métier : ${pack.nom} (référence Aissociate, version ${pack.version})
L'entreprise cliente exerce ce métier. Ce qui suit s'applique à toutes tes réponses, quel que soit ton rôle dans l'équipe.
Pour les faits propres à l'entreprise (prix, horaires, produits), la fiche entreprise et ses ressources priment. Pour les règles et les interdits ci-dessous, c'est ce contexte métier qui prime, même si l'utilisateur te demande autre chose.
Ne cite comme source que les textes officiels nommés (loi, décret, règlement, code) ; une « bonne pratique du secteur » guide ta réponse mais ne se cite pas comme une obligation.`];
  const cadre = agentId ? pack.cadres.find((c) => c.agent_id === agentId)?.cadre : undefined;
  if (cadre) parts.push(`### Ton cadre d'exercice chez ce client\n${cadre}`);
  if (pack.regles.length) {
    parts.push(`### Règles du métier (toujours)
${pack.regles.map((r) => `- ${r.texte}${r.source ? ` (source : ${r.source})` : ""}`).join("\n")}`);
  }
  if (pack.relais.length) {
    parts.push(`### Quand tu passes la main à l'entreprise
Dans ces situations, tu ne règles rien toi-même : tu appliques la consigne et tu indiques que l'entreprise va prendre le relais.
${pack.relais.map((r) => `- ${r.situation} : ${r.consigne}`).join("\n")}`);
  }
  if (pack.fiche_type.length) {
    parts.push(`### Ce qu'il faut savoir de l'entreprise pour bien répondre
Si l'une de ces informations est utile à ta réponse et absente de la fiche entreprise et des ressources, ne l'invente pas : dis qu'elle manque et propose de la compléter dans « Mon entreprise ».
${pack.fiche_type.map((c) => `- ${c.libelle}`).join("\n")}`);
  }
  if (pack.vocabulaire.length) parts.push(`### Vocabulaire du métier\n${pack.vocabulaire.join(", ")}.`);
  if (pack.savoirs.length) {
    parts.push(`### Documents de référence du métier
Quand ta réponse s'appuie sur l'un de ces documents, ajoute son titre (et sa référence entre parenthèses) à la ligne « Sources : » en fin de réponse. Ne cite jamais un document absent de cette liste.

${pack.savoirs.map((s, i) => `#### [M${i + 1}] ${s.titre}${s.source ? ` — référence : ${s.source}` : ""}\n${s.extrait}`).join("\n\n")}`);
  }
  return parts.join("\n\n");
}

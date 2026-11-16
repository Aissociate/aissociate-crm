// Rapport mensuel de valeur d'un espace client — module PUR (testé par vitest).
// Montré au client (Studio › Rapport) et au CRM ; il ne contient AUCUN coût :
// la rentabilité reste côté Aissociate (vue studio_rentabilite_mois).

export type MessageRapport = {
  role: "user" | "assistant"; agent_id: string | null; retour: number | null;
  content: string; epingle: boolean; created_at: string; media_id?: string | null;
};
export type ConversationRapport = { titre: string; agent_id: string; updated_at: string };
export type MediaRapport = { type: "image" | "video"; statut: string; created_at: string };
export type AgentRapport = { id: string; prenom: string; metier: string; minutes_par_tache: number };

export type Rapport = {
  mois: string;            // AAAA-MM
  libelle: string;         // « novembre 2026 »
  missions: number;
  reponses_utiles: number;
  minutes: number;
  contenus_gardes: number;
  images: number;
  videos: number;
  par_agent: { agent_id: string; prenom: string; metier: string; missions: number; minutes: number }[];
  exemples: { titre: string; agent: string }[];
  precedent: { missions: number; minutes: number };
};

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Bornes UTC du mois (AAAA-MM) et du mois précédent. */
export function bornesMois(mois: string) {
  const [a, m] = mois.split("-").map(Number);
  const debut = new Date(Date.UTC(a, m - 1, 1));
  const fin = new Date(Date.UTC(a, m, 1));
  const debutPrecedent = new Date(Date.UTC(a, m - 2, 1));
  return { debut: debut.toISOString(), fin: fin.toISOString(), debutPrecedent: debutPrecedent.toISOString(), libelle: `${MOIS[m - 1]} ${a}` };
}

export function moisValide(m: unknown): string {
  const s = String(m ?? "");
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  return new Date().toISOString().slice(0, 7);
}

const estRelais = (c: string) => c.includes("[[RELAIS:");
/** Réponse utile : non notée « à revoir » et pas un simple relais vers un collègue. */
const utile = (m: MessageRapport) => m.role === "assistant" && m.retour !== -1 && !estRelais(m.content);

export function calculerRapport(p: {
  mois: string; messages: MessageRapport[]; conversations: ConversationRapport[];
  medias: MediaRapport[]; agents: AgentRapport[];
}): Rapport {
  const { debut, fin, debutPrecedent, libelle } = bornesMois(p.mois);
  const dans = (d: string, a: string, b: string) => d >= a && d < b;
  const minutesDe = new Map(p.agents.map((a) => [a.id, a.minutes_par_tache]));
  const duMois = p.messages.filter((m) => dans(m.created_at, debut, fin));
  const precedents = p.messages.filter((m) => dans(m.created_at, debutPrecedent, debut));
  const minutes = (ms: MessageRapport[]) => ms.filter(utile).reduce((n, m) => n + (minutesDe.get(String(m.agent_id)) ?? 15), 0);

  const parAgent = p.agents.map((a) => ({
    agent_id: a.id, prenom: a.prenom, metier: a.metier,
    missions: duMois.filter((m) => m.role === "user" && m.agent_id === a.id).length,
    minutes: minutes(duMois.filter((m) => m.agent_id === a.id)),
  })).filter((a) => a.missions > 0).sort((x, y) => y.minutes - x.minutes);

  const prenomDe = new Map(p.agents.map((a) => [a.id, a.prenom]));
  return {
    mois: p.mois, libelle,
    missions: duMois.filter((m) => m.role === "user").length,
    reponses_utiles: duMois.filter(utile).length,
    minutes: minutes(duMois),
    contenus_gardes: duMois.filter((m) => m.role === "assistant" && m.epingle).length,
    images: p.medias.filter((x) => x.type === "image" && x.statut === "pret" && dans(x.created_at, debut, fin)).length,
    videos: p.medias.filter((x) => x.type === "video" && x.statut === "pret" && dans(x.created_at, debut, fin)).length,
    par_agent: parAgent,
    exemples: p.conversations.filter((c) => dans(c.updated_at, debut, fin))
      .sort((x, y) => y.updated_at.localeCompare(x.updated_at)).slice(0, 6)
      .map((c) => ({ titre: c.titre, agent: prenomDe.get(c.agent_id) ?? "" })),
    precedent: { missions: precedents.filter((m) => m.role === "user").length, minutes: minutes(precedents) },
  };
}

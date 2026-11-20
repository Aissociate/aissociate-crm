// Analyse quotidienne des conversations du Studio — partie pure (testée par vitest,
// aucun import `npm:`). Le passage lui-même est dans ameliorations.ts.
//
// Principe : les conversations des dernières 24 h sont transcrites, un LLM en tire
// au plus quelques propositions qui facilitent réellement la vie du client, puis
// chaque proposition est vérifiée ici (citation réellement prononcée par le client,
// champs complets, pas de doublon avec ce qui est déjà déposé) avant d'arriver
// dans CRM › Développement (table `tickets`, type « proposition »).

export const FONCTION_JOB = "studio-ameliorations";
/** Ligne d'en-tête qui signe les propositions déposées par ce job. */
export const SIGNATURE = "Proposition issue de l'analyse quotidienne des conversations du Studio IA.";
export const MAX_PROPOSITIONS = 5;
export const CITATION_MAX = 280;
const MESSAGE_CLIENT_MAX = 1500;
const MESSAGE_AGENT_MAX = 500;
const TRANSCRIPTION_MAX = 80_000;

export const CATEGORIES = {
  besoin_recurrent: "Besoin récurrent mal couvert",
  friction: "Friction dans l'usage",
  outil_manquant: "Outil ou format manquant",
  demande_non_satisfaite: "Demande que l'agent n'a pas su satisfaire",
} as const;
export type Categorie = keyof typeof CATEGORIES;

export type Message = { conversation_id: string; role: string; content: string; agent_id: string | null; created_at: string };
export type Conversation = { id: string; workspace_id: string; agent_id: string; titre: string; user_id: string };
export type Contexte = {
  espaces: Record<string, string>;   // workspace_id → nom
  agents: Record<string, string>;    // agent_id → prénom
  exclus: Set<string>;               // user_id des comptes de contrôle / test
};

/** Conversation transcrite, avec la référence courte donnée au LLM (C1, C2…). */
export type Transcription = {
  ref: string; conversationId: string; espace: string; agents: string[]; date: string;
  texte: string; paroleClient: string[];
};

export type Proposition = {
  titre: string; categorie: Categorie; probleme: string; cas_usage: string; proposition: string;
  citation: string; conversation: string; espace: string; agents: string[]; date: string;
};

const coupe = (t: string, n: number) => (t.length > n ? t.slice(0, n).trimEnd() + " […]" : t);
/** Blocs internes retirés des messages d'agent (raisonnement, balises d'outils). */
const nettoyerAgent = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/\s+\n/g, "\n").trim();

/** Transcrit les conversations (hors comptes de contrôle), messages dans l'ordre, longueurs bornées. */
export function transcrire(conversations: Conversation[], messages: Message[], ctx: Contexte): Transcription[] {
  const parConv = new Map<string, Message[]>();
  for (const m of messages) {
    if (!m.content?.trim()) continue;
    const l = parConv.get(m.conversation_id) ?? [];
    l.push(m);
    parConv.set(m.conversation_id, l);
  }
  const res: Transcription[] = [];
  let total = 0;
  const triees = conversations
    .filter((c) => !ctx.exclus.has(c.user_id) && (parConv.get(c.id) ?? []).some((m) => m.role === "user"))
    .sort((a, b) => dernier(parConv.get(b.id)!).localeCompare(dernier(parConv.get(a.id)!)));
  for (const c of triees) {
    const msgs = parConv.get(c.id)!.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const agents = [...new Set([c.agent_id, ...msgs.map((m) => m.agent_id)].filter((x): x is string => !!x))]
      .map((id) => ctx.agents[id] ?? id);
    const lignes = msgs.map((m) => m.role === "user"
      ? `CLIENT : ${coupe(m.content.trim(), MESSAGE_CLIENT_MAX)}`
      : `${(ctx.agents[m.agent_id ?? c.agent_id] ?? "AGENT").toUpperCase()} : ${coupe(nettoyerAgent(m.content), MESSAGE_AGENT_MAX)}`);
    const ref = `C${res.length + 1}`;
    const espace = ctx.espaces[c.workspace_id] ?? "Espace inconnu";
    const texte = `### ${ref} — espace « ${espace} », agent(s) : ${agents.join(", ")}, sujet : ${c.titre}\n${lignes.join("\n")}`;
    if (total + texte.length > TRANSCRIPTION_MAX) break;
    total += texte.length;
    res.push({
      ref, conversationId: c.id, espace, agents, date: dernier(msgs).slice(0, 10), texte,
      paroleClient: msgs.filter((m) => m.role === "user").map((m) => m.content),
    });
  }
  return res;
}
const dernier = (msgs: Message[]) => msgs.reduce((d, m) => (m.created_at > d ? m.created_at : d), "");

export function consigneAnalyse(): string {
  return [
    "Tu es responsable produit du Studio IA d'Aissociate : des agents IA (Léa l'assistante qui orchestre, Hugo marketing, Sam commercial, Inès SEO, Maël administratif, Nora RH, Théo comptabilité) travaillent pour des entreprises clientes.",
    "Tu lis les conversations des dernières 24 heures entre les clients et les agents, et tu en tires des propositions d'amélioration du Studio.",
    "",
    "RETIENS uniquement ce qui faciliterait réellement la vie du client :",
    "- besoin_recurrent : un besoin qui revient (ou reviendra clairement) et que le Studio couvre mal ;",
    "- friction : le client a dû s'y reprendre, contourner, répéter, corriger l'agent, ou a perdu du temps ;",
    "- outil_manquant : une action, une intégration ou un format de sortie qui manque (export, document, connecteur…) ;",
    "- demande_non_satisfaite : l'agent n'a pas su faire ce qui était demandé, a refusé, ou a répondu à côté.",
    "",
    "ÉCARTE : le bruit, les tests, les salutations, les demandes ponctuelles sans portée générale, les réglages internes ou de configuration, les questions auxquelles l'agent a bien répondu, les sujets propres au métier du client qui n'appellent aucune évolution du Studio. Dans le doute, écarte : mieux vaut zéro proposition qu'une proposition faible.",
    `Au plus ${MAX_PROPOSITIONS} propositions, une seule par besoin (regroupe les conversations qui disent la même chose). Ne repropose rien de ce qui figure dans la liste « Déjà déposées ».`,
    "",
    "Pour chaque proposition :",
    "- titre : l'amélioration, formulée comme une action (« Permettre de… », « Ajouter… »), 10 à 100 caractères ;",
    "- categorie : une des quatre valeurs ci-dessus ;",
    "- probleme : ce que le client a vécu dans la conversation, en une ou deux phrases (ne suppose pas ce que le Studio sait ou ne sait pas faire au-delà de ce que montre l'échange) ;",
    "- cas_usage : un exemple concret d'utilisation une fois l'amélioration faite (qui, quoi, quel gain) ;",
    "- proposition : ce qu'il faudrait construire, en deux ou trois phrases ;",
    "- citation : un extrait COPIÉ MOT POUR MOT, fautes comprises, d'une ligne qui commence par « CLIENT : » (jamais d'une ligne d'agent), 15 à 250 caractères, qui illustre exactement le problème décrit. Si aucune phrase du client ne montre le problème, n'émets pas la proposition ;",
    "- conversation : la référence de la conversation citée (C1, C2…).",
    "",
    'Réponds uniquement par un objet JSON : {"propositions": [ … ]}. S\'il n\'y a rien de pertinent : {"propositions": []}.',
  ].join("\n");
}

/** Relance quand des citations ne viennent pas du client : le modèle corrige ou retire. */
export function demandeCorrection(rejets: { titre: string; motif: string }[]): string {
  return [
    "Ces propositions ont une citation qui ne figure dans aucune ligne « CLIENT : » de la conversation indiquée :",
    ...rejets.map((r) => `- ${r.titre}`),
    "Pour chacune, remplace la citation par un extrait copié mot pour mot d'une ligne « CLIENT : » qui illustre le problème, ou retire la proposition si le client ne l'exprime pas lui-même.",
    'Renvoie la liste complète corrigée, au même format JSON : {"propositions": [ … ]}.',
  ].join("\n");
}
export const MOTIF_CITATION = "citation absente des messages du client";

export function demandeAnalyse(transcriptions: Transcription[], dejaDeposees: string[]): string {
  return [
    "Déjà déposées (ne pas reproposer) :",
    dejaDeposees.length ? dejaDeposees.slice(0, 150).map((t) => `- ${t}`).join("\n") : "(aucune)",
    "",
    "Conversations des dernières 24 heures :",
    "",
    transcriptions.map((t) => t.texte).join("\n\n"),
  ].join("\n");
}

/** Extrait l'objet JSON d'une réponse de modèle (balises de code, texte autour, raisonnement). */
export function extraireJson(texte: string): unknown {
  const t = texte.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const bloc = t.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  for (const candidat of [bloc, t]) {
    if (!candidat) continue;
    const debut = candidat.indexOf("{"), fin = candidat.lastIndexOf("}");
    if (debut < 0 || fin <= debut) continue;
    try { return JSON.parse(candidat.slice(debut, fin + 1)); } catch { /* candidat suivant */ }
  }
  return null;
}

/** Texte comparable : minuscules, sans accents ni ponctuation, espaces réduits. */
export function normaliser(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’'"«»“”]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** La citation figure-t-elle (à la ponctuation près) dans ce que le client a écrit ? */
export function citationAuthentique(citation: string, paroleClient: string[]): boolean {
  const c = normaliser(citation.replace(/\[…\]|\.\.\.|…/g, " "));
  if (c.length < 12) return false;
  return paroleClient.some((p) => normaliser(p).includes(c));
}

const MOTS_VIDES = new Set("le la les un une des du de d l a au aux et ou en pour par sur dans avec sans que qui quoi ce ces son sa ses leur leurs plus pouvoir permettre ajouter faire etre avoir client clients agent agents studio".split(" "));
const motsCles = (t: string) => new Set(normaliser(t).split(" ").filter((m) => m.length > 2 && !MOTS_VIDES.has(m)));

/** Ressemblance de deux titres (Jaccard sur les mots porteurs). */
export function ressemblance(a: string, b: string): number {
  const x = motsCles(a), y = motsCles(b);
  if (!x.size || !y.size) return 0;
  let commun = 0;
  for (const m of x) if (y.has(m)) commun++;
  return commun / (x.size + y.size - commun);
}
export const SEUIL_DOUBLON = 0.5;

/**
 * Propositions retenues : champs complets, catégorie connue, conversation existante,
 * citation réellement écrite par le client, sans doublon (entre elles ni avec l'existant).
 * Les rejets sont rendus avec leur motif, pour le journal.
 */
export function retenir(brut: unknown, transcriptions: Transcription[], dejaDeposees: string[]): { retenues: Proposition[]; rejets: { titre: string; motif: string }[] } {
  const liste = Array.isArray((brut as { propositions?: unknown })?.propositions) ? (brut as { propositions: unknown[] }).propositions : [];
  const retenues: Proposition[] = [], rejets: { titre: string; motif: string }[] = [];
  const parRef = new Map(transcriptions.map((t) => [t.ref, t]));
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  for (const p of liste) {
    const o = (p ?? {}) as Record<string, unknown>;
    const titre = txt(o.titre).replace(/\s+/g, " ").slice(0, 120);
    const rejeter = (motif: string) => rejets.push({ titre: titre || "(sans titre)", motif });
    const categorie = txt(o.categorie) as Categorie;
    const t = parRef.get(txt(o.conversation).toUpperCase());
    const citation = txt(o.citation).replace(/^["«“\s]+|["»”\s]+$/g, "");
    if (titre.length < 10) { rejeter("titre absent ou trop court"); continue; }
    if (!(categorie in CATEGORIES)) { rejeter(`catégorie inconnue (${categorie || "vide"})`); continue; }
    if (!txt(o.cas_usage) || !txt(o.probleme) || !txt(o.proposition)) { rejeter("cas d'usage, problème ou proposition manquant"); continue; }
    if (!t) { rejeter("conversation citée introuvable"); continue; }
    if (!citationAuthentique(citation, t.paroleClient)) { rejeter(MOTIF_CITATION); continue; }
    const deja = [...dejaDeposees, ...retenues.map((r) => r.titre)].find((d) => ressemblance(titre, d) >= SEUIL_DOUBLON);
    if (deja) { rejeter(`doublon de « ${deja} »`); continue; }
    if (retenues.length >= MAX_PROPOSITIONS) { rejeter("au-delà du maximum quotidien"); continue; }
    retenues.push({
      titre, categorie, probleme: txt(o.probleme), cas_usage: txt(o.cas_usage), proposition: txt(o.proposition),
      citation: coupe(citation, CITATION_MAX), conversation: t.conversationId, espace: t.espace, agents: t.agents, date: t.date,
    });
  }
  return { retenues, rejets };
}

const dateFr = (iso: string) => {
  const [a, m, j] = iso.split("-");
  return a && m && j ? `${j}/${m}/${a}` : iso;
};

/** Ticket « proposition » de CRM › Développement. */
export function versTicket(p: Proposition): { titre: string; description: string } {
  return {
    titre: p.titre,
    description: [
      SIGNATURE,
      "",
      `Catégorie : ${CATEGORIES[p.categorie]}`,
      `Espace : ${p.espace} — agent(s) : ${p.agents.join(", ")} — conversation du ${dateFr(p.date)}`,
      "",
      "Situation (extrait du message du client) :",
      `« ${p.citation} »`,
      "",
      `Problème : ${p.probleme}`,
      "",
      `Cas d'usage : ${p.cas_usage}`,
      "",
      `Proposition : ${p.proposition}`,
      "",
      `Référence conversation : ${p.conversation}`,
    ].join("\n"),
  };
}

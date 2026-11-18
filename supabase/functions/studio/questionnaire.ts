// Questionnaire d'onboarding d'un client du Studio IA — module PUR, source unique :
// rendu par le formulaire public (src/studio/pages/Questionnaire.tsx), noté par
// l'Edge Function `studio`, testé par vitest.
// Repris du paquet « plateforme multi-tenant » (socle/03), adapté à notre offre :
// la section 0 porte sur les agents souhaités (pas sur des formules SOLO/DUO/TRIO).

export type TypeChamp = "texte" | "long" | "nombre" | "montant" | "date" | "ouinon" | "choix" | "multi";
export type Question = {
  id: string; libelle: string; type: TypeChamp; requis?: boolean; options?: string[]; aide?: string;
};
export type Section = { id: string; titre: string; intro?: string; questions: Question[] };
export type Reponses = Record<string, string | string[] | undefined>;

export const AGENTS_CATALOGUE = [
  { id: "lea", libelle: "Léa — assistante générale" },
  { id: "hugo", libelle: "Hugo — marketing & réseaux sociaux" },
  { id: "sam", libelle: "Sam — commercial & prospection" },
  { id: "ines", libelle: "Inès — SEO & contenus web" },
  { id: "mael", libelle: "Maël — administratif & juridique" },
  { id: "nora", libelle: "Nora — RH & formation" },
];

export const SECTIONS: Section[] = [
  {
    id: "0", titre: "Votre projet",
    intro: "Choisissez les agents dont vous avez besoin : vous pourrez en ajouter plus tard.",
    questions: [
      { id: "agents", libelle: "Agents souhaités", type: "multi", requis: true, options: AGENTS_CATALOGUE.map((a) => a.id) },
    ],
  },
  {
    id: "A", titre: "Identité de l'entreprise",
    questions: [
      // A1 devient le nom de l'espace, de l'e-mail d'accueil et du papier à en-tête : le nom seul.
      { id: "A1", libelle: "Nom de votre entreprise", type: "texte", requis: true },
      { id: "A1b", libelle: "Forme juridique et SIRET", type: "texte" },
      { id: "A2", libelle: "Secteur d'activité (et code NAF si connu)", type: "texte", requis: true },
      { id: "A3", libelle: "Effectif total (équivalents temps plein)", type: "nombre", requis: true },
      { id: "A4", libelle: "Chiffre d'affaires des 12 derniers mois", type: "choix", options: ["< 50 k€", "50–250 k€", "250 k€–1 M€", "> 1 M€"] },
      { id: "A5", libelle: "Qui décide ? Le dirigeant est-il seul décideur, qui délègue ?", type: "texte", requis: true },
      { id: "A6", libelle: "Avez-vous un DPO ou un référent RGPD ?", type: "ouinon" },
    ],
  },
  {
    id: "B", titre: "Activité",
    intro: "La question sur les tâches qui vous coûtent le plus de temps est la plus importante : vos agents commencent par là.",
    questions: [
      { id: "B1", libelle: "En quelques lignes : ce que vous vendez, et à qui", type: "long", requis: true },
      { id: "B2", libelle: "Vos 3 offres les plus vendues (avec leurs prix si possible)", type: "long" },
      { id: "B3", libelle: "Comment un client arrive-t-il chez vous aujourd'hui ?", type: "long" },
      { id: "B4", libelle: "Combien de devis par mois, et quel taux de signature environ ?", type: "texte" },
      { id: "B6", libelle: "Avez-vous des pics saisonniers ? Lesquels ?", type: "texte" },
      { id: "B7", libelle: "Quelles tâches vous coûtent le plus de temps chaque semaine ?", type: "long", requis: true },
      { id: "B7h", libelle: "Combien d'heures par semaine y passez-vous, au total ?", type: "nombre", requis: true },
    ],
  },
  {
    id: "C", titre: "Organisation",
    questions: [
      { id: "C1", libelle: "Qui fait quoi, et qui valide quoi ?", type: "long" },
      { id: "C2", libelle: "Qui, à part vous, pourra confier des missions aux agents ?", type: "texte" },
      { id: "C3", libelle: "Quels sujets sont hors limites pour un agent ?", type: "long" },
    ],
  },
  {
    id: "D", titre: "Outils et données",
    questions: [
      { id: "D1", libelle: "Messagerie : quel fournisseur (Gmail, Outlook, autre) ?", type: "texte" },
      { id: "D2", libelle: "Comptabilité / facturation : quel logiciel ?", type: "texte" },
      { id: "D3", libelle: "CRM ou suivi commercial : lequel ?", type: "texte" },
      { id: "D5", libelle: "Site web (adresse)", type: "texte" },
      { id: "D6", libelle: "Réseaux sociaux utilisés (comptes professionnels)", type: "texte" },
      { id: "D7", libelle: "Agenda, planning : quels outils ?", type: "texte" },
      { id: "D8", libelle: "Vos logiciels permettent-ils un export (CSV) ou une API ?", type: "ouinon" },
    ],
  },
  {
    id: "E", titre: "Données personnelles (RGPD)",
    questions: [
      { id: "E1", libelle: "Traitez-vous des données de santé, sociales ou bancaires ?", type: "ouinon", requis: true },
      { id: "E2", libelle: "Combien de personnes dans vos fichiers clients ?", type: "choix", options: ["< 100", "100–1 000", "1 000–10 000", "> 10 000"] },
      { id: "E3", libelle: "Avez-vous un registre des traitements ?", type: "ouinon" },
      { id: "E4", libelle: "Vos durées de conservation sont-elles définies ?", type: "ouinon" },
      { id: "E6", libelle: "Y a-t-il des données de mineurs ?", type: "ouinon", requis: true },
    ],
  },
  {
    id: "F", titre: "Objectifs",
    intro: "Un agent mal accompagné au démarrage déçoit : prévoyez au moins 2 heures par semaine le premier mois.",
    questions: [
      { id: "F1", libelle: "Vos 3 objectifs à 6 mois", type: "long", requis: true },
      { id: "F2", libelle: "Qu'est-ce qui vous ferait dire « ça a marché » ?", type: "long" },
      { id: "F3", libelle: "Budget mensuel maximum pour les outils et l'IA (€)", type: "montant" },
      { id: "F5", libelle: "Combien d'heures par semaine pouvez-vous y consacrer au début ?", type: "nombre", requis: true },
    ],
  },
  {
    id: "G", titre: "Accès et sécurité",
    intro: "Nous ne demandons jamais vos identifiants personnels : vous connecterez vous-même vos outils.",
    questions: [
      { id: "G1", libelle: "Qui créera les accès à vos outils ?", type: "texte" },
      { id: "G3", libelle: "La double authentification est-elle activée sur vos comptes ?", type: "ouinon" },
      { id: "H1", libelle: "Fréquence de compte rendu souhaitée", type: "choix", options: ["Quotidienne", "Hebdomadaire"] },
    ],
  },
];

const texte = (r: Reponses, id: string) => String((Array.isArray(r[id]) ? (r[id] as string[]).join(", ") : r[id]) ?? "").trim();
const nombre = (r: Reponses, id: string) => {
  const n = Number(String(r[id] ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const oui = (r: Reponses, id: string) => texte(r, id).toLowerCase() === "oui";

/** Contrôle des réponses : champs requis, valeurs de choix et longueurs. */
export function validerReponses(r: Reponses): string | null {
  for (const s of SECTIONS) for (const q of s.questions) {
    const v = r[q.id];
    const vide = Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
    if (q.requis && vide) return `Réponse manquante : ${q.libelle}`;
    if (vide) continue;
    if (q.type === "choix" && q.options && !q.options.includes(String(v))) return `Choix invalide : ${q.libelle}`;
    if (q.type === "multi" && (!Array.isArray(v) || v.some((x) => !q.options?.includes(x)))) return `Choix invalide : ${q.libelle}`;
    if (q.type === "ouinon" && !["oui", "non"].includes(String(v))) return `Réponse invalide : ${q.libelle}`;
    if (String(Array.isArray(v) ? v.join() : v).length > 4000) return `Réponse trop longue : ${q.libelle}`;
  }
  return null;
}

export type Score = { score: number; lecture: "diagnostic" | "pilote" | "démarrage"; drapeaux: string[]; detail: Record<string, number> };

/**
 * Score de maturité /100 (grille du paquet, socle/03) :
 * temps récupérable 25 · données accessibles 20 · décideur disponible 20 ·
 * process décrits 15 · hygiène RGPD 10 · budget 10.
 */
export function scorer(r: Reponses): Score {
  const h = nombre(r, "B7h"), dispo = nombre(r, "F5"), budget = nombre(r, "F3");
  const decrit = (id: string) => texte(r, id).length >= 20;
  const detail = {
    temps: h >= 10 ? 25 : h >= 5 ? 15 : h > 0 ? 8 : 0,
    donnees: oui(r, "D8") ? 20 : 0,
    decideur: texte(r, "A5") && dispo >= 3 ? 20 : dispo >= 2 ? 10 : 0,
    process: decrit("C1") && decrit("B3") ? 15 : decrit("C1") || decrit("B3") ? 8 : 0,
    rgpd: oui(r, "E3") && oui(r, "E4") ? 10 : oui(r, "E3") || oui(r, "E4") ? 5 : 0,
    budget: budget >= 300 ? 10 : budget >= 100 ? 5 : 0,
  };
  const score = Object.values(detail).reduce((a, b) => a + b, 0);
  const drapeaux: string[] = [];
  if (oui(r, "E1")) drapeaux.push("donnees_sensibles");
  if (oui(r, "E6")) drapeaux.push("mineurs");
  if (dispo < 2) drapeaux.push("disponibilite_insuffisante");
  if (texte(r, "G3").toLowerCase() === "non") drapeaux.push("sans_double_authentification");
  return { score, lecture: score < 40 ? "diagnostic" : score <= 70 ? "pilote" : "démarrage", drapeaux, detail };
}

/** Fiche entreprise lue par les agents, pré-remplie depuis le questionnaire (modifiable ensuite). */
export function ficheEntreprise(r: Reponses): string {
  const lignes: [string, string][] = [
    ["Entreprise", texte(r, "A1")],
    ["Forme juridique et SIRET", texte(r, "A1b")],
    ["Activité", texte(r, "A2")],
    ["Effectif", texte(r, "A3") && `${texte(r, "A3")} ETP`],
    ["Ce que nous vendons, et à qui", texte(r, "B1")],
    ["Offres principales", texte(r, "B2")],
    ["Comment arrivent nos clients", texte(r, "B3")],
    ["Pics saisonniers", texte(r, "B6")],
    ["Site web", texte(r, "D5")],
    ["Réseaux sociaux", texte(r, "D6")],
    ["Objectifs à 6 mois", texte(r, "F1")],
    ["Hors limites pour les agents", texte(r, "C3")],
  ];
  return lignes.filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`).join("\n");
}

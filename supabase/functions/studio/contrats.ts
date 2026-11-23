// Grille « contrat de travail » du Studio (choix de l'abonnement, maquette du 23/11/2026).
//
// Un contrat (Stage gratuit, Temps partiel, Temps plein, Équipe complète) fixe les heures de
// travail, les badges d'accès aux outils, les responsables et le casier ; des avenants
// s'ajoutent à tout moment. CDD = mensuel sans engagement ; CDI = annuel, 2 mois offerts
// (prix annuel = 10 × le mensuel). Le Stage remplace l'essai gratuit de 7 jours.
//
// Fichier PUR (aucune dépendance) : le navigateur l'importe aussi pour calculer le bulletin
// (src/studio/pages/Contrat.tsx). Changer un montant impose une nouvelle version de clé Stripe
// (VERSION) : un prix Stripe ne se modifie pas.

export const VERSION = "v4"; // v4 (23/11) : nouveaux prix des avenants ; v3 encore lue
/** 1 heure de travail = 20 actions d'agent (= 20 demandes au quota du mois). */
export const ACTIONS_PAR_HEURE = 20;
/** CDI : 12 mois pour le prix de 10. */
export const MOIS_PAYES_CDI = 10;
export const INTEGRATION_HT = 490;

export type ContratId = "stage" | "partiel" | "plein" | "equipe";
export type Contrat = {
  id: ContratId; nom: string; rythme: string; prix: number; heures: number; badges: number; responsables: number;
  go: number; expert: boolean; astreinte: boolean; sav: boolean; reco?: boolean; accroche: string; points: string[];
};

export const CONTRATS: Contrat[] = [
  {
    id: "stage", nom: "Stage", rythme: "Gratuit, sans limite de durée", prix: 0, heures: 10, badges: 0, responsables: 1, go: 1,
    expert: false, astreinte: false, sav: false, accroche: "Pour découvrir, sans accès à vos outils",
    points: ["Agents illimités, modèle standard", "10 h de travail par mois", "Aucun badge d'accès à vos outils", "1 responsable, casier de 1 Go"],
  },
  {
    id: "partiel", nom: "Temps partiel", rythme: "Mi-temps", prix: 59, heures: 75, badges: 3, responsables: 1, go: 25,
    expert: false, astreinte: false, sav: false, accroche: "Pour déléguer les tâches répétitives",
    points: ["75 h de travail par mois", "3 badges d'accès à vos outils", "Formation continue incluse", "1 responsable, casier de 25 Go"],
  },
  {
    id: "plein", nom: "Temps plein", rythme: "35 heures", prix: 149, heures: 151.67, badges: 6, responsables: 2, go: 25,
    expert: true, astreinte: true, sav: false, reco: true, accroche: "Pour piloter l'entreprise au quotidien",
    points: ["151,67 h de travail par mois", "6 badges d'accès à vos outils", "Qualification Expert et astreinte", "2 responsables, casier de 25 Go"],
  },
  {
    id: "equipe", nom: "Équipe complète", rythme: "Temps plein renforcé", prix: 287, heures: 201.67, badges: 12, responsables: 3, go: 100,
    expert: true, astreinte: true, sav: true, accroche: "Avec un interlocuteur SAV dédié",
    points: ["151,67 h + 50 h supplémentaires", "12 badges d'accès à vos outils", "Qualification Expert et astreinte", "Accès premium au SAV : un interlocuteur dédié, réponse sous 4 h ouvrée", "3 responsables, archives de 100 Go"],
  },
];

export type CompteurId = "heures" | "badges" | "responsables" | "archives";
export type InterrupteurId = "expert" | "astreinte";
export type Avenant = { id: CompteurId | InterrupteurId; nom: string; description: string; prix: number; unite: string; libelle: string };

/** Avenants à quantité. */
export const COMPTEURS: (Avenant & { id: CompteurId })[] = [
  { id: "heures", nom: "Heures supplémentaires", description: "Par lot de 20 h, quand vos agents dépassent leur temps de travail", prix: 19.9, unite: "/ lot de 20 h / mois", libelle: "lot d'heures supplémentaires" },
  { id: "badges", nom: "Badges d'accès supplémentaires", description: "Un outil de plus ouvert à vos agents : messagerie, agenda, logiciel de caisse…", prix: 9.9, unite: "/ badge / mois", libelle: "badge d'accès" },
  { id: "responsables", nom: "Responsables supplémentaires", description: "Un membre de votre équipe qui donne des consignes aux agents", prix: 14.9, unite: "/ responsable / mois", libelle: "responsable" },
  { id: "archives", nom: "Armoire d'archives", description: "100 Go de plus pour vos documents", prix: 9.9, unite: "/ 100 Go / mois", libelle: "armoire d'archives" },
];
export const HEURES_PAR_LOT = 20;
export const GO_PAR_ARMOIRE = 100;

/** Avenants oui / non (inclus d'office dans certains contrats). */
export const INTERRUPTEURS: (Avenant & { id: InterrupteurId })[] = [
  { id: "expert", nom: "Promotion : qualification Expert", description: "Vos agents passent sur le modèle d'IA supérieur pour les tâches délicates", prix: 29.9, unite: "/ mois", libelle: "qualification Expert" },
  { id: "astreinte", nom: "Astreinte", description: "Une personne d'Aissociate répond en priorité, sous 4 h ouvrées", prix: 29.9, unite: "/ mois", libelle: "astreinte" },
];

export type Choix = {
  contrat: ContratId; cdi: boolean;
  heures: number; badges: number; responsables: number; archives: number;
  expert: boolean; astreinte: boolean;
};

export const CHOIX_STAGE: Choix = { contrat: "stage", cdi: false, heures: 0, badges: 0, responsables: 0, archives: 0, expert: false, astreinte: false };

export const contrat = (id: string): Contrat => CONTRATS.find((c) => c.id === id) ?? CONTRATS[0];
const entier = (v: unknown, max = 50) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

/** Choix reçu du navigateur : bornes, avenants inclus au contrat retirés. */
export function normaliser(v: unknown): Choix {
  const o = (v ?? {}) as Record<string, unknown>;
  const c = contrat(String(o.contrat ?? ""));
  return {
    contrat: c.id, cdi: o.cdi === true,
    heures: entier(o.heures), badges: entier(o.badges), responsables: entier(o.responsables, 20), archives: entier(o.archives, 20),
    expert: !c.expert && o.expert === true, astreinte: !c.astreinte && o.astreinte === true,
  };
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

export type Ligne = { cle: string; libelle: string; detail: string; quantite: number; mensuel_ht: number; montant_ht: number };

/**
 * Bulletin mensuel : une ligne par élément facturé. `mensuel_ht` est le prix unitaire mensuel ;
 * `montant_ht` le total de la ligne. La remise CDI est une ligne à part (négative), lissée au mois.
 */
export function bulletin(ch: Choix) {
  const c = contrat(ch.contrat);
  const lignes: Ligne[] = [{ cle: `contrat_${c.id}`, libelle: "Salaire de base", detail: `Contrat ${c.nom.toLowerCase()}`, quantite: 1, mensuel_ht: c.prix, montant_ht: c.prix }];
  for (const a of COMPTEURS) {
    const q = ch[a.id];
    if (q > 0) lignes.push({ cle: `avenant_${a.id}`, libelle: a.nom, detail: `${q} × ${a.prix.toFixed(2).replace(".", ",")} €`, quantite: q, mensuel_ht: a.prix, montant_ht: arrondi(q * a.prix) });
  }
  for (const a of INTERRUPTEURS) {
    if (ch[a.id] && !c[a.id]) lignes.push({ cle: `avenant_${a.id}`, libelle: a.nom, detail: "Avenant", quantite: 1, mensuel_ht: a.prix, montant_ht: a.prix });
  }
  const brut = arrondi(lignes.reduce((t, l) => t + l.montant_ht, 0));
  const remise = ch.cdi && brut > 0 ? arrondi(brut * (12 - MOIS_PAYES_CDI) / 12) : 0;
  const mensuel = arrondi(brut - remise);
  return { lignes, brut_ht: brut, remise_cdi_ht: remise, mensuel_ht: mensuel, annuel_ht: ch.cdi ? arrondi(brut * MOIS_PAYES_CDI) : null, payant: brut > 0 };
}

/** Ce que le contrat ouvre réellement dans l'espace (appliqué par le Studio). */
export function droits(ch: Choix) {
  const c = contrat(ch.contrat);
  const heures = arrondi(c.heures + ch.heures * HEURES_PAR_LOT);
  return {
    heures,
    quota_messages_mois: Math.round(heures * ACTIONS_PAR_HEURE),
    connecteurs_max: c.badges + ch.badges,
    max_utilisateurs: c.responsables + ch.responsables,
    stockage_go: c.go + ch.archives * GO_PAR_ARMOIRE,
    expert: c.expert || ch.expert,
    astreinte: c.astreinte || ch.astreinte,
    sav: c.sav,
  };
}

// ─── Stripe ──────────────────────────────────────────────────────────────────

/** Clé de prix Stripe (lookup_key) d'un élément de la grille, mensuel ou annuel. */
export const clePrix = (element: string, cdi: boolean) => `studio_${VERSION}_${element}_${cdi ? "an" : "mois"}`;

/** Éléments payants à souscrire (le contrat à 0 € n'a pas de ligne Stripe). */
export function articles(ch: Choix): { element: string; nom: string; quantite: number; centimes: number }[] {
  const facteur = ch.cdi ? MOIS_PAYES_CDI : 1;
  return bulletin(ch).lignes.filter((l) => l.mensuel_ht > 0).map((l) => ({
    element: l.cle, nom: l.cle.startsWith("contrat_") ? `Studio IA — contrat ${contrat(ch.contrat).nom.toLowerCase()}` : `Studio IA — ${l.libelle.toLowerCase()}`,
    quantite: l.quantite, centimes: Math.round(l.mensuel_ht * facteur * 100),
  }));
}

/** Choix reconstitué depuis les articles d'un abonnement Stripe ; null si ce n'est pas un contrat de cette grille. */
export function choixDepuisArticles(items: { lookup_key?: string | null; quantite: number }[]): Choix | null {
  const re = new RegExp(`^studio_(?:v3|${VERSION})_(contrat_[a-z]+|avenant_[a-z]+)_(mois|an)$`);
  const ch: Choix = { ...CHOIX_STAGE };
  let trouve = false;
  for (const it of items) {
    const m = re.exec(String(it.lookup_key ?? ""));
    if (!m) continue;
    trouve = true;
    ch.cdi = m[2] === "an";
    const [genre, id] = m[1].split("_");
    if (genre === "contrat") ch.contrat = contrat(id).id;
    else if (id === "expert" || id === "astreinte") ch[id] = true;
    else if (id === "heures" || id === "badges" || id === "responsables" || id === "archives") ch[id] = it.quantite;
  }
  return trouve ? normaliser(ch) : null;
}

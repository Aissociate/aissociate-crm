// Navigation du Studio : 5 entrées, chacune regroupant d'anciennes pages devenues onglets.
// Les anciennes adresses répondent toujours, par redirection (paramètres et ancre conservés :
// le serveur renvoie vers /studio/connecteurs?… après une connexion de compte et vers
// /studio/perimetre?… après un paiement Stripe).

export type Onglet = { chemin: string; label: string };
export type Section = {
  id: 'aujourdhui' | 'equipe' | 'routines' | 'documents' | 'reglages';
  label: string;
  /** Adresse de l'entrée de menu. */
  to: string;
  /** Préfixes d'adresse pour lesquels l'entrée est « active ». */
  prefixes: string[];
  /** Onglets de la section (le premier est la page d'arrivée). */
  onglets: Onglet[];
};

export const BASE = '/studio';

export const SECTIONS: Section[] = [
  {
    id: 'aujourdhui', label: "Aujourd'hui", to: BASE, prefixes: [`${BASE}/aujourdhui`],
    onglets: [
      { chemin: BASE, label: 'Vos décisions' },
      { chemin: `${BASE}/aujourdhui/livrables`, label: 'Tous les livrables' },
      { chemin: `${BASE}/aujourdhui/journal`, label: 'Journal' },
    ],
  },
  {
    id: 'equipe', label: 'Mon équipe', to: `${BASE}/equipe`, prefixes: [`${BASE}/equipe`, `${BASE}/assistants`],
    onglets: [],
  },
  {
    id: 'routines', label: 'Routines', to: `${BASE}/routines`, prefixes: [`${BASE}/routines`],
    onglets: [
      { chemin: `${BASE}/routines`, label: 'Mes routines' },
      { chemin: `${BASE}/routines/veille`, label: 'Veille' },
      { chemin: `${BASE}/routines/par-email`, label: 'Par e-mail' },
    ],
  },
  {
    id: 'documents', label: 'Mes documents', to: `${BASE}/documents`, prefixes: [`${BASE}/documents`],
    onglets: [
      { chemin: `${BASE}/documents`, label: 'Ressources' },
      { chemin: `${BASE}/documents/contenus`, label: 'Contenus' },
      { chemin: `${BASE}/documents/contacts`, label: 'Contacts' },
    ],
  },
  {
    id: 'reglages', label: 'Réglages et connecteurs', to: `${BASE}/reglages`, prefixes: [`${BASE}/reglages`],
    onglets: [
      { chemin: `${BASE}/reglages`, label: 'Connecteurs' },
      { chemin: `${BASE}/reglages/entreprise`, label: 'Mon entreprise' },
      { chemin: `${BASE}/reglages/perimetre`, label: 'Mon périmètre' },
      { chemin: `${BASE}/reglages/responsables`, label: 'Responsables' },
      { chemin: `${BASE}/reglages/compte`, label: 'Mon compte' },
      { chemin: `${BASE}/reglages/rapport`, label: 'Rapport mensuel' },
    ],
  },
];

/** Ancienne adresse (segment après /studio/) → nouvelle adresse. */
export const REDIRECTIONS: Record<string, string> = {
  livrables: `${BASE}/aujourdhui/livrables`,
  journal: `${BASE}/aujourdhui/journal`,
  assistants: `${BASE}/equipe`,
  taches: `${BASE}/routines`,
  veille: `${BASE}/routines/veille`,
  'par-email': `${BASE}/routines/par-email`,
  ressources: `${BASE}/documents`,
  creations: `${BASE}/documents/contenus`,
  contacts: `${BASE}/documents/contacts`,
  connecteurs: `${BASE}/reglages`,
  entreprise: `${BASE}/reglages/entreprise`,
  perimetre: `${BASE}/reglages/perimetre`,
  compte: `${BASE}/reglages/compte`,
  rapport: `${BASE}/reglages/rapport`,
};

const sansBarre = (chemin: string) => (chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin);

/** Section à laquelle appartient une adresse (null hors des cinq sections). */
export function sectionDe(chemin: string): Section | null {
  const c = sansBarre(chemin);
  if (c === BASE) return SECTIONS[0];
  return SECTIONS.find((s) => s.prefixes.some((p) => c === p || c.startsWith(`${p}/`))) ?? null;
}

/** Onglet actif d'une section pour une adresse : le plus précis qui correspond. */
export function ongletActif(section: Section, chemin: string): Onglet | null {
  const c = sansBarre(chemin);
  return [...section.onglets].sort((a, b) => b.chemin.length - a.chemin.length)
    .find((o) => c === o.chemin || c.startsWith(`${o.chemin}/`)) ?? null;
}

/** Nouvelle adresse d'une ancienne page, paramètres et ancre conservés ; null si l'adresse n'a pas changé. */
export function nouvelleAdresse(chemin: string, recherche = '', ancre = ''): string | null {
  const c = sansBarre(chemin);
  if (!c.startsWith(`${BASE}/`)) return null;
  const cible = REDIRECTIONS[c.slice(BASE.length + 1)];
  return cible ? `${cible}${recherche}${ancre}` : null;
}

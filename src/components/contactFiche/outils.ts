// Fiche contact — constantes et dates partagées par les onglets.

export const STATUTS_PROSPECT = ['', 'non assigné', 'nouveau', 'qualifié', 'en relance', 'rdv', 'gagné', 'perdu', 'sans suite'];
// « note » n'a jamais servi ; « relance » est redondant (une relance est un appel
// ou un mail) — les deux ont été retirés des choix, ticket Benjamin
// « modifications des types d'action ».
export const ACTION_TYPES = ['appel', 'email', 'rdv', 'autre'];

// ── Helpers date/heure pour le suivi des actions ────────────────────────────
export const pad2 = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const hm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
// Heure « HH:MM:SS » → « HH:MM » pour l'affichage.
export const shortHeure = (h: string | null) => (h ? h.slice(0, 5) : '');
// Jour de la semaine abrégé, affiché devant chaque date d'action.
// Midi pour rester insensible au fuseau lors de la conversion.
export const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export const jourCourt = (d: string) => (d ? JOURS_COURTS[new Date(`${d}T12:00:00`).getDay()] ?? '' : '');
// Clé de tri chronologique (date + heure, heure vide triée en dernier).
export const actionSortKey = (a: { date_action: string; heure_action: string | null }) => `${a.date_action}T${a.heure_action ?? '99:99'}`;

// Colonnes déjà affichées dans les champs principaux — on les masque dans metadata
export const META_SKIP = new Set([
  'full_name', 'name', 'nom', 'prenom', 'email', 'phone', 'phone_number',
  'telephone', 'téléphone', 'company_name', 'entreprise', 'société', 'societe',
  'ville', 'city', '',
]);

/** Style des titres de section de la fiche. */
export const titreSection = 'text-xs font-semibold uppercase tracking-wider text-muted';

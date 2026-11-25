// Calendrier par défaut du Studio (Aujourd'hui › Calendrier) : regroupement par jour et dates, à l'heure de La Réunion.
export type EvenementCalendrier = {
  id: string; type: 'rappel' | 'routine' | 'publication'; quand: string; titre: string; agent_id: string | null;
  note?: string | null; statut?: string | null; fait?: boolean; ref_id?: string | null;
};
export type ReponseCalendrier = {
  du: string; au: string; evenements: EvenementCalendrier[];
  /** Agenda externe connecté (les rendez-vous des agents y vont) ; null : ce calendrier est le seul. */
  agenda: { nom: string; a_reconnecter: boolean } | null;
};

const FUSEAU = 'Indian/Reunion';
const DECALAGE_MS = 4 * 3_600_000;
const JOUR_MS = 86_400_000;
export const DUREE_JOURS = 30;

/** « AAAA-MM-JJ » à La Réunion. */
export const jourReunion = (d: Date | string) => new Date(new Date(d).getTime() + DECALAGE_MS).toISOString().slice(0, 10);
/** Décale une date « AAAA-MM-JJ » de n jours. */
export const decaler = (jour: string, n: number) => new Date(Date.parse(`${jour}T00:00:00Z`) + n * JOUR_MS).toISOString().slice(0, 10);

/** Événements regroupés par jour de La Réunion, dans l'ordre. */
export function parJour(evts: EvenementCalendrier[]): { jour: string; evenements: EvenementCalendrier[] }[] {
  const groupes = new Map<string, EvenementCalendrier[]>();
  for (const e of [...evts].sort((a, b) => a.quand.localeCompare(b.quand))) {
    const j = jourReunion(e.quand);
    groupes.set(j, [...(groupes.get(j) ?? []), e]);
  }
  return [...groupes].map(([jour, evenements]) => ({ jour, evenements }));
}

/** « Aujourd'hui », « Demain » ou « mercredi 3 décembre ». */
export function libelleJour(jour: string, maintenant = new Date()): string {
  const auj = jourReunion(maintenant);
  if (jour === auj) return "Aujourd'hui";
  if (jour === decaler(auj, 1)) return 'Demain';
  const l = new Date(`${jour}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/** « 09:30 » à La Réunion. */
export const heure = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' });

/** Période affichée : « du 25 novembre au 24 décembre ». */
export function libellePeriode(du: string, au: string): string {
  const f = (d: string) => new Date(d).toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long' });
  return `du ${f(du)} au ${f(au)}`;
}

/** Rappels encore à faire dont l'heure est passée. */
export const enRetard = (e: EvenementCalendrier, maintenant = new Date()) => e.type === 'rappel' && !e.fait && Date.parse(e.quand) < maintenant.getTime();

// Dates de l'agenda des agents (heure de La Réunion). Les appels passent par Zernio (bureau.ts).
//
// Lecture (lister les rendez-vous) : immédiate. Création d'un rendez-vous (et
// envoi des invitations) : uniquement au « VALIDÉ » du propriétaire.

export const FUSEAU = "Indian/Reunion";

/** « 2026-11-20T14:30 » (heure de La Réunion) : format accepté, secondes ajoutées ; sinon null. */
export function dateHeure(v: unknown): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v ?? "").trim());
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4] ?? "00"}` : null;
}

export type Rdv = { titre: string; debut: string; fin: string; lieu?: string | null; description?: string | null; participants?: string[] };

/** Bornes ISO (UTC) d'une période exprimée en dates locales « AAAA-MM-JJ » (La Réunion = UTC+4). */
export function periode(du?: string | null, au?: string | null, maintenant = new Date()): { min: string; max: string } {
  const jour = (d: string, h: string) => new Date(`${d}T${h}+04:00`).toISOString();
  const valide = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const debut = valide(du) ? jour(valide(du)!, "00:00:00") : maintenant.toISOString();
  const fin = valide(au) ? jour(valide(au)!, "23:59:59") : new Date(Date.parse(debut) + 14 * 86_400_000).toISOString();
  return { min: debut, max: fin };
}

/** Adresses e-mail valides d'une liste « a@x.fr, b@y.fr » (doublons retirés), ou null si l'une est invalide. */
export function adressesValides(liste: string | undefined | null): string[] | null {
  const items = String(liste ?? "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  const ok = items.every((x) => /^[^\s@<>()"]+@[^\s@<>()"]+\.[a-z]{2,}$/i.test(x));
  return ok ? [...new Set(items.map((x) => x.toLowerCase()))] : null;
}

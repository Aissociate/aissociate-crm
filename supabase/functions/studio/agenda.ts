// Google Agenda pour les agents du Studio, via la connexion Nango « google-calendar ».
//
// Lecture (lister les rendez-vous) : immédiate. Création d'un rendez-vous (et
// envoi des invitations) : uniquement au « VALIDÉ » du propriétaire.
import { appelGoogle } from "./google.ts";

const API = "https://www.googleapis.com/calendar/v3/calendars/primary";
export const FUSEAU = "Indian/Reunion";

// ─── Partie pure (testée) ────────────────────────────────────────────────────

/** « 2026-11-20T14:30 » (heure de La Réunion) : format accepté, secondes ajoutées ; sinon null. */
export function dateHeure(v: unknown): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(v ?? "").trim());
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4] ?? "00"}` : null;
}

export type Rdv = { titre: string; debut: string; fin: string; lieu?: string | null; description?: string | null; participants?: string[] };

export function corpsEvenement(r: Rdv) {
  return {
    summary: r.titre.slice(0, 300),
    start: { dateTime: r.debut, timeZone: FUSEAU },
    end: { dateTime: r.fin, timeZone: FUSEAU },
    ...(r.lieu ? { location: r.lieu.slice(0, 300) } : {}),
    ...(r.description ? { description: r.description.slice(0, 8000) } : {}),
    ...(r.participants?.length ? { attendees: r.participants.map((email) => ({ email })) } : {}),
  };
}

/** Bornes ISO (UTC) d'une période exprimée en dates locales « AAAA-MM-JJ » (La Réunion = UTC+4). */
export function periode(du?: string | null, au?: string | null, maintenant = new Date()): { min: string; max: string } {
  const jour = (d: string, h: string) => new Date(`${d}T${h}+04:00`).toISOString();
  const valide = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const debut = valide(du) ? jour(valide(du)!, "00:00:00") : maintenant.toISOString();
  const fin = valide(au) ? jour(valide(au)!, "23:59:59") : new Date(Date.parse(debut) + 14 * 86_400_000).toISOString();
  return { min: debut, max: fin };
}

// ─── Appels Google Agenda ────────────────────────────────────────────────────

export type ResumeRdv = { id: string; titre: string; debut: string; fin: string; lieu: string; participants: string[]; lien: string };

export async function lister(jeton: string, du?: string | null, au?: string | null): Promise<ResumeRdv[]> {
  const { min, max } = periode(du, au);
  const q = new URLSearchParams({ timeMin: min, timeMax: max, singleEvents: "true", orderBy: "startTime", maxResults: "50", timeZone: FUSEAU });
  const j = await (await appelGoogle(jeton, `${API}/events?${q}`, "Google Agenda")).json() as {
    items?: { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; location?: string; attendees?: { email: string }[]; htmlLink?: string }[];
  };
  return (j.items ?? []).map((e) => ({
    id: e.id, titre: e.summary ?? "(sans titre)", debut: e.start?.dateTime ?? e.start?.date ?? "", fin: e.end?.dateTime ?? e.end?.date ?? "",
    lieu: e.location ?? "", participants: (e.attendees ?? []).map((a) => a.email), lien: e.htmlLink ?? "",
  }));
}

/** Création (appelée uniquement après validation) ; les invités reçoivent l'invitation. */
export async function creer(jeton: string, r: Rdv): Promise<{ id: string; lien: string | null }> {
  const res = await appelGoogle(jeton, `${API}/events?sendUpdates=all`, "Google Agenda", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpsEvenement(r)),
  });
  const j = await res.json() as { id: string; htmlLink?: string };
  return { id: j.id, lien: j.htmlLink ?? null };
}

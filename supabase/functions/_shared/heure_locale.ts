// Date et heure à La Réunion pour les Edge Functions. Le serveur tourne en
// UTC : `getHours()` & co y donnent l'heure UTC, d'où des actions décalées de
// 4 h dans l'historique des fiches (et une date de la veille entre 0 h et 4 h).

const FORMAT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Indian/Reunion", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** « AAAA-MM-JJ », « HH:MM », heure (0-23) et jour de semaine (0 = dimanche) à La Réunion. */
export function partiesLocales(d: Date = new Date()): { date: string; heure: string; h: number; jourSemaine: number } {
  const p = Object.fromEntries(FORMAT.formatToParts(d).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return {
    date, heure: `${p.hour}:${p.minute}`, h: Number(p.hour),
    jourSemaine: new Date(`${date}T00:00:00Z`).getUTCDay(),
  };
}

/** Ajoute `n` jours à une date calendaire « AAAA-MM-JJ ». */
export function ajouterJours(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

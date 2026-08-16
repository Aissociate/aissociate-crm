// Jours fériés français, plus le 20 décembre (abolition de l'esclavage à La
// Réunion). Sert à signaler les échéances d'actions posées un jour chômé
// (ticket Benjamin « surligner et annoter les étrangetés temporelles »).

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Dimanche de Pâques (algorithme de Meeus/Butcher, calendrier grégorien). */
function paques(annee: number): Date {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(annee, mois - 1, jour);
}

const cache = new Map<number, Map<string, string>>();

/** Jours fériés de l'année, indexés par date « AAAA-MM-JJ » → libellé. */
function feriesDe(annee: number): Map<string, string> {
  const memo = cache.get(annee);
  if (memo) return memo;

  const map = new Map<string, string>([
    [`${annee}-01-01`, 'Jour de l’an'],
    [`${annee}-05-01`, 'Fête du Travail'],
    [`${annee}-05-08`, 'Victoire 1945'],
    [`${annee}-07-14`, 'Fête nationale'],
    [`${annee}-08-15`, 'Assomption'],
    [`${annee}-11-01`, 'Toussaint'],
    [`${annee}-11-11`, 'Armistice'],
    [`${annee}-12-25`, 'Noël'],
    // Abolition de l'esclavage à La Réunion.
    [`${annee}-12-20`, 'Abolition de l’esclavage'],
  ]);

  const p = paques(annee);
  const decale = (jours: number, libelle: string) => {
    const d = new Date(p);
    d.setDate(d.getDate() + jours);
    map.set(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, libelle);
  };
  decale(1, 'Lundi de Pâques');
  decale(39, 'Ascension');
  decale(50, 'Lundi de Pentecôte');

  cache.set(annee, map);
  return map;
}

/** Libellé du jour férié pour une date « AAAA-MM-JJ », sinon null. */
export function jourFerie(date: string): string | null {
  const annee = Number((date ?? '').slice(0, 4));
  if (!annee) return null;
  return feriesDe(annee).get(date) ?? null;
}

export type Anomalie = { code: 'week-end' | 'jour férié' | 'horaire' | 'si loin ?'; detail?: string };

/**
 * Repère les horodatages incohérents avec une activité de prospection :
 * week-end, jour férié, créneau hors 9 h – 18 h, échéance à plus de deux ans.
 */
export function anomaliesHoraires(date: string, heure: string | null): Anomalie[] {
  const out: Anomalie[] = [];
  if (!date) return out;
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return out;

  const jour = d.getDay();
  if (jour === 0 || jour === 6) out.push({ code: 'week-end' });

  const ferie = jourFerie(date);
  if (ferie) out.push({ code: 'jour férié', detail: ferie });

  if (heure) {
    const h = Number(heure.slice(0, 2));
    const m = Number(heure.slice(3, 5));
    if (h < 9 || h > 18 || (h === 18 && m > 0)) out.push({ code: 'horaire' });
  }

  const limite = new Date();
  limite.setFullYear(limite.getFullYear() + 2);
  if (d > limite) out.push({ code: 'si loin ?' });

  return out;
}

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(value: string | null | undefined, fmt = 'dd/MM/yyyy'): string {
  if (!value) return '—';
  try {
    return format(typeof value === 'string' ? parseISO(value) : value, fmt, { locale: fr });
  } catch {
    return '—';
  }
}

export function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function initials(nom?: string | null, prenom?: string | null): string {
  return `${(prenom?.[0] ?? '').toUpperCase()}${(nom?.[0] ?? '').toUpperCase()}` || '?';
}

export function fullName(prenom?: string | null, nom?: string | null): string {
  return [prenom, nom].filter(Boolean).join(' ') || '—';
}

/**
 * Un conseiller « sorti des effectifs » : compte désactivé, non approuvé, ou
 * statut RH « inactif » / « ancien ». Ses contacts ne doivent plus générer de
 * notification de mail non lu (ticket Benjamin « notifications messagerie »).
 */
export function isConseillerInactif(
  p: { actif?: boolean | null; approved?: boolean | null; statut_conseiller?: string | null } | null | undefined,
): boolean {
  if (!p) return false;
  if (p.actif === false || p.approved === false) return true;
  return p.statut_conseiller === 'inactif' || p.statut_conseiller === 'ancien';
}

const pad2 = (n: number) => String(n).padStart(2, '0');
/** Date locale « YYYY-MM-DD » (sans bascule UTC, contrairement à toISOString). */
export const ymdLocal = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Première heure ouvrable à venir : 9 h le prochain jour ouvré (lundi-vendredi).
 * Si l'on est un jour ouvré avant 9 h, c'est 9 h le jour même. Sert à planifier
 * les relances créées automatiquement à la réception / l'envoi d'un message.
 */
export function prochaineHeureOuvrable(from = new Date()): { date: string; heure: string } {
  const d = new Date(from);
  const ouvre = (x: Date) => x.getDay() >= 1 && x.getDay() <= 5;
  if (!ouvre(d) || d.getHours() >= 9) {
    do { d.setDate(d.getDate() + 1); } while (!ouvre(d));
  }
  return { date: ymdLocal(d), heure: '09:00' };
}

/** Reference dossier lisible, deterministe a partir de l'id. */
export function genReference(prefix = 'DOS'): string {
  const stamp = format(new Date(), 'yyMMdd-HHmmss');
  return `${prefix}-${stamp}`;
}

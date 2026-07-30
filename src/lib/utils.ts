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

/** Reference dossier lisible, deterministe a partir de l'id. */
export function genReference(prefix = 'DOS'): string {
  const stamp = format(new Date(), 'yyMMdd-HHmmss');
  return `${prefix}-${stamp}`;
}

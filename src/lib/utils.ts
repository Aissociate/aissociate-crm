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

/** Reference dossier lisible, deterministe a partir de l'id. */
export function genReference(prefix = 'DOS'): string {
  const stamp = format(new Date(), 'yyMMdd-HHmmss');
  return `${prefix}-${stamp}`;
}

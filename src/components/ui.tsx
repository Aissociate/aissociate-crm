import { type ReactNode, type ButtonHTMLAttributes, useEffect } from 'react';
import { X, Loader2, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

// ─── Tons sémantiques ────────────────────────────────────────────────────────
// Un seul vocabulaire de couleurs pour tout le CRM. Le MÊME concept = le MÊME ton
// partout (un statut « actif/résolu » est toujours `success`, etc.). Toutes les
// teintes sont dark-mode-safe (fond à faible opacité + texte avec variante dark).
export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONE_BADGE: Record<Tone, string> = {
  brand:   'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger:  'bg-red-500/10 text-red-600 dark:text-red-400',
  info:    'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  neutral: 'bg-surface-2 text-muted',
};

// Variante « pastille / tuile d'icône » (fond coloré + icône) — même palette.
export const TONE_TILE: Record<Tone, string> = {
  brand:   'bg-brand-500/10 text-brand-500',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-500',
  danger:  'bg-red-500/10 text-red-500',
  info:    'bg-sky-500/10 text-sky-500',
  neutral: 'bg-surface-2 text-muted',
};

export function Button({
  variant = 'primary', className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const map: Record<Variant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  };
  return (
    <button className={cn(map[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-500', className)} />;
}

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({
  children, className, tone,
}: { children: ReactNode; className?: string; tone?: Tone }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
      tone && TONE_BADGE[tone],
      className,
    )}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card p-5', className)}>{children}</div>;
}

export function StatCard({
  label, value, icon, hint,
}: { label: string; value: ReactNode; icon?: ReactNode; hint?: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      {icon && (
        <div className="rounded-xl bg-brand-500/10 p-3 text-brand-500">{icon}</div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold text-fg">{value}</p>
        {hint && <p className="text-xs text-muted/80">{hint}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface py-16 text-center">
      <Inbox className="mb-3 h-10 w-10 text-muted/50" />
      <p className="font-medium text-fg">{title}</p>
      {message && <p className="mt-1 text-sm text-muted">{message}</p>}
    </div>
  );
}

export function Modal({
  open, onClose, title, children, footer, wide,
}: {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm sm:p-8">
      <div className={cn('card w-full p-0 shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label, children, hint, required,
}: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {head}
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

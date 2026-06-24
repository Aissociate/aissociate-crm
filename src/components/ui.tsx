import { type ReactNode, type ButtonHTMLAttributes, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Inbox, Search, ChevronDown, Check } from 'lucide-react';
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

// Sélecteur avec recherche textuelle (combobox). Remplace un <select> quand la
// liste est longue (contacts, entreprises…). `emptyLabel` ajoute une option pour
// vider la sélection (champ facultatif) ; sans elle, le champ n'a pas de « vide ».
export type SearchOption = { value: string; label: string; sub?: string };

export function SearchSelect({
  value, onChange, options, placeholder = 'Rechercher…', emptyLabel, disabled, maxVisible = 50,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  maxVisible?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Positionne le menu en `fixed` (échappe à l'overflow de la modale), vers le
  // haut s'il manque de place dessous.
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < 300 && r.top > below;
    const maxH = Math.min(320, Math.max(150, (up ? r.top : below) - 16));
    setPos({ left: r.left, width: r.width, maxH, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  };
  const close = () => { setOpen(false); setQuery(''); };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    // Capture : passe AVANT le listener Escape de la modale (sur document) → ne ferme que le menu.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
    const reflow = () => place();
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', reflow);
      window.removeEventListener('scroll', reflow, true);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);
  const shown = filtered.slice(0, maxVisible);
  const choose = (v: string) => { onChange(v); close(); };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (open) { close(); } else { place(); setOpen(true); setQuery(''); } }}
        className="input flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn('truncate', !selected && 'text-muted')}>{selected ? selected.label : (emptyLabel ?? placeholder)}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, zIndex: 60 }}
          className="rounded-lg border border-line bg-surface shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
            />
          </div>
          <ul style={{ maxHeight: pos.maxH }} className="overflow-y-auto py-1 text-sm">
            {emptyLabel && (
              <li>
                <button type="button" onClick={() => choose('')} className="flex w-full items-center justify-between px-3 py-1.5 text-left text-muted hover:bg-surface-2">
                  {emptyLabel}{!value && <Check className="h-4 w-4 shrink-0 text-brand-500" />}
                </button>
              </li>
            )}
            {shown.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => choose(o.value)} className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-fg">{o.label}</span>
                    {o.sub && <span className="block truncate text-xs text-muted">{o.sub}</span>}
                  </span>
                  {o.value === value && <Check className="h-4 w-4 shrink-0 text-brand-500" />}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-2 text-muted">Aucun résultat</li>}
            {filtered.length > shown.length && (
              <li className="px-3 py-1.5 text-xs text-muted">+{filtered.length - shown.length} autres — affinez la recherche</li>
            )}
          </ul>
        </div>,
        document.body,
      )}
    </>
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

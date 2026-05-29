import { cn } from '@/lib/utils';

/** Marque (tuile dégradée + circuit + "AI") — utilisable seule (sidebar, favicon). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="A(I)ssociate">
      <defs>
        <linearGradient id="logo-mark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7a823" />
          <stop offset="1" stopColor="#ea3c2a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-mark-grad)" />
      <g stroke="#ffffff" strokeWidth="2" fill="#ffffff" opacity="0.55" strokeLinecap="round">
        <path d="M8 20 H20" fill="none" /><circle cx="8" cy="20" r="2.4" />
        <path d="M8 32 H16" fill="none" /><circle cx="8" cy="32" r="2.4" />
        <path d="M8 44 H22" fill="none" /><circle cx="8" cy="44" r="2.4" />
      </g>
      <text x="36" y="41" textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
        fontSize="24" fontWeight="700" fill="#ffffff">AI</text>
    </svg>
  );
}

/**
 * Lockup complet : marque + wordmark "A(I)ssociate" (+ tagline optionnelle).
 * Le wordmark utilise la couleur du thème (text-fg) ; le "(I)" est en dégradé de marque.
 */
export function Logo({
  size = 'md', tagline = false, className,
}: { size?: 'sm' | 'md' | 'lg'; tagline?: boolean; className?: string }) {
  const mark = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const word = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className={cn(mark, 'shrink-0 rounded-[28%]')} />
      <div className="leading-tight">
        <span className={cn('block font-mono font-bold tracking-tight text-fg', word)}>
          A<span className="brand-text-gradient">(I)</span>ssociate
        </span>
        {tagline && (
          <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Intelligences Artificielles
          </span>
        )}
      </div>
    </div>
  );
}

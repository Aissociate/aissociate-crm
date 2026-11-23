import { cn } from '@/lib/utils';

// Logo Aissociate (charte : docs/charte/README.md).
// « AI » en Archivo 900 orange, « ssociate » en Archivo 400 encre, approche −0,03 em,
// d'un seul tenant. Sur fond sombre (taupe, noir), l'orange passe au clair #F0823F.

// `fond` : 'auto' suit le thème de l'interface (CRM) ; 'clair' et 'sombre' sont fixes
// (site public et Studio IA ont leurs propres fonds, indépendants du thème du CRM).
export type FondLogo = 'auto' | 'clair' | 'sombre';
const COULEURS: Record<FondLogo, { encre: string; orange: string; orangeTexte: string }> = {
  auto: { encre: 'text-fg', orange: 'text-[#EA6A1E] dark:text-[#F0823F]', orangeTexte: 'text-[#B24A0C] dark:text-[#F4A26C]' },
  clair: { encre: 'text-[#17120E]', orange: 'text-[#EA6A1E]', orangeTexte: 'text-[#B24A0C]' },
  sombre: { encre: 'text-white', orange: 'text-[#F0823F]', orangeTexte: 'text-[#F4A26C]' },
};

/** Monogramme : « AI » seul en Archivo 900 orange clair sur un carré taupe (ou noir). */
export function LogoMark({ className, fond = 'taupe' }: { className?: string; fond?: 'taupe' | 'noir' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Aissociate">
      <rect width="64" height="64" fill={fond === 'noir' ? '#0E0C0A' : '#483C32'} />
      <text x="32" y="43.5" textAnchor="middle" fontFamily="Archivo, 'Arial Black', Arial, sans-serif"
        fontSize="30" fontWeight="900" letterSpacing="-1.2" fill="#F0823F">AI</text>
    </svg>
  );
}

/** Nom de branche : le « IA » de Studio IA reste orange, le reste en encre. */
function NomBranche({ nom, fond, petit }: { nom: string; fond: FondLogo; petit?: boolean }) {
  // En petit corps, l'orange lisible (orange-texte) remplace l'orange de marque.
  const orange = petit ? COULEURS[fond].orangeTexte : COULEURS[fond].orange;
  if (!nom.endsWith(' IA')) return <>{nom}</>;
  return <>{nom.slice(0, -2)}<span className={orange}>IA</span></>;
}

const TAILLES = {
  xs: { mot: 'text-base', base: 'text-[11px]' },
  sm: { mot: 'text-xl', base: 'text-xs' },
  md: { mot: 'text-2xl', base: 'text-[13px]' },
  lg: { mot: 'text-[34px]', base: 'text-base' },
} as const;

/**
 * Logo en texte.
 * - `branche` : version « En ligne » (logo + branche à 0,26 em, Archivo 800), pour les en-têtes.
 * - `tagline` : baseline « Des IA et des Hommes » sous le logo (marque mère seulement).
 * - `fond` : 'sombre' pour un fond taupe ou noir (blanc + orange clair).
 */
export function Logo({
  size = 'md', tagline = false, branche, fond = 'auto', className,
}: { size?: keyof typeof TAILLES; tagline?: boolean; branche?: string; fond?: FondLogo; className?: string }) {
  const t = TAILLES[size];
  const { encre, orange, orangeTexte } = COULEURS[fond];
  return (
    <div className={cn('inline-block font-display leading-none', className)}>
      <span className={cn('block whitespace-nowrap tracking-[-0.03em]', t.mot, encre)}>
        <span className={cn('font-black', orange)}>AI</span><span className="font-normal">ssociate</span>
        {branche && (
          <span className="ml-[0.26em] font-extrabold tracking-[-0.025em]">
            <NomBranche nom={branche} fond={fond} />
          </span>
        )}
      </span>
      {tagline && !branche && (
        <span className={cn('mt-[0.45em] block whitespace-nowrap tracking-[-0.01em]', t.base, encre)}>
          Des <span className={cn('font-extrabold', orangeTexte)}>IA</span> et des <span className="font-extrabold">Hommes</span>
        </span>
      )}
    </div>
  );
}

/** Version empilée (écrans de moins de 480 px) : la branche en petit au-dessus du logo. */
export function LogoEmpile({ branche, fond = 'auto', className }: { branche: string; fond?: FondLogo; className?: string }) {
  return (
    <div className={cn('inline-block font-display leading-none', className)}>
      <span className={cn('mb-1 block text-[13px] font-extrabold', COULEURS[fond].encre)}>
        <NomBranche nom={branche} fond={fond} petit />
      </span>
      <Logo size="xs" fond={fond} />
    </div>
  );
}

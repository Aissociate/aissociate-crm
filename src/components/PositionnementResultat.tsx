import { useState } from 'react';
import { Copy, Printer, Check } from 'lucide-react';
import { DOMAINES, niveauDe, type Score, type DomaineCle } from '@/lib/positionnement';

/**
 * Restitution d'un positionnement : niveau, jauges par domaine, synthèse.
 * Partagée par la page publique (l'apprenant voit son résultat immédiatement)
 * et par le CRM (le formateur relit un positionnement archivé) — les deux
 * doivent montrer exactement la même chose.
 */
export default function PositionnementResultat({
  score, synthese, compact,
}: { score: Score; synthese: string; compact?: boolean }) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(synthese);
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : la synthèse reste
      // sélectionnable à la main dans le champ ci-dessous.
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line bg-brand-500/10 px-5 py-6 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
          Votre positionnement
        </p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-fg">{score.niveau}</p>
        <p className="mt-1 text-sm tabular-nums text-muted">
          {score.pct} % de réussite — {score.got} points sur {score.max}
        </p>
        {!compact && (
          <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-fg">{niveauDe(score.pct).reco}</p>
        )}
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="space-y-3">
          {(Object.entries(DOMAINES) as [DomaineCle, string][]).map(([cle, label]) => {
            const d = score.domaines[cle];
            return (
              <div key={cle}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-fg">{label}</span>
                  <span className="text-xs tabular-nums text-muted">{d.got}/{d.max} · {d.pct} %</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700"
                    style={{ width: `${Math.max(d.pct, 1.5)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <label className="label" htmlFor="synthese-pos">Synthèse pour le formateur</label>
          <textarea
            id="synthese-pos" readOnly value={synthese}
            className="input min-h-[220px] font-mono text-xs leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button type="button" className="btn-secondary" onClick={() => void copier()}>
            {copie ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copie ? 'Copié' : 'Copier la synthèse'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimer / PDF
          </button>
        </div>
      </div>
    </div>
  );
}

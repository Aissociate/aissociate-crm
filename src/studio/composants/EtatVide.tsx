// « État vide » : bloc centré affiché quand une liste n'a rien à montrer.
// Utilisé sur Creations, Livrables, Journal, Par e-mail… Style aligné sur Studio
// (bordure pointillée, icône pâle, titre, description courte, action facultative).
import { type ReactNode } from 'react';
import { Bouton, cx } from '../composants';

export type EtatVideProps = {
  icone?: ReactNode;
  titre: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
};

export default function EtatVide({ icone, titre, description, action, className }: EtatVideProps) {
  return (
    <div
      role="status"
      className={cx(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center',
        className,
      )}
    >
      {icone && <div className="mb-3 text-neutral-300" aria-hidden>{icone}</div>}
      <h3 className="text-base font-semibold text-neutral-900">{titre}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-neutral-500">{description}</p>}
      {action && (
        <Bouton className="mt-4" onClick={action.onClick}>
          {action.label}
        </Bouton>
      )}
    </div>
  );
}

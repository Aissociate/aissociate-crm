// « Confirmation » : modale de confirmation pour les actions destructives
// (suspendre agents, refuser livrable, supprimer ressource ou connecteur).
// Overlay noir translucide, panneau centré, focus auto sur « Annuler »,
// ESC = annuler, clic sur l'overlay = annuler (sauf pendant l'envoi).
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '../composants';

export type ConfirmationProps = {
  ouvert: boolean;
  titre: string;
  message: ReactNode;
  confirmer: { label: string; onClick: () => void | Promise<void>; danger?: boolean };
  annuler: { label?: string; onClick: () => void };
  enCours?: boolean;
};

const CL_BASE = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed';
const CL_CLAIR = 'bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-50 disabled:text-neutral-400';
const CL_NOIR = 'bg-neutral-900 text-white hover:bg-neutral-700 disabled:bg-neutral-400';
const CL_DANGER = 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300';

export default function Confirmation({ ouvert, titre, message, confirmer, annuler, enCours }: ConfirmationProps) {
  const refAnnuler = useRef<HTMLButtonElement>(null);
  const refPrecedent = useRef<Element | null>(null);
  const titreId = useId();

  // Focus auto sur « Annuler » à l'ouverture, puis retour au focus précédent à la fermeture.
  useEffect(() => {
    if (!ouvert) return;
    refPrecedent.current = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => refAnnuler.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      if (refPrecedent.current instanceof HTMLElement) refPrecedent.current.focus();
    };
  }, [ouvert]);

  // ESC = annuler (sauf pendant l'envoi).
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !enCours) {
        e.stopPropagation();
        annuler.onClick();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ouvert, enCours, annuler]);

  if (!ouvert) return null;

  const surOverlay = () => { if (!enCours) annuler.onClick(); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={surOverlay}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titreId} className="text-lg font-semibold text-neutral-900">{titre}</h2>
        <div className="mt-2 text-sm text-neutral-600">{message}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            ref={refAnnuler}
            onClick={annuler.onClick}
            disabled={enCours}
            className={cx(CL_BASE, CL_CLAIR)}
          >
            {annuler.label ?? 'Annuler'}
          </button>
          <button
            type="button"
            onClick={() => { void confirmer.onClick(); }}
            disabled={enCours}
            className={cx(CL_BASE, confirmer.danger ? CL_DANGER : CL_NOIR)}
          >
            {enCours ? 'En cours…' : confirmer.label}
          </button>
        </div>
      </div>
    </div>
  );
}

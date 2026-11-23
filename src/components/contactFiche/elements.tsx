// Fiche contact — petits éléments d'affichage partagés par les onglets.
import type { ReactNode } from 'react';

export function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-muted">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm text-fg">{value}</p>
      </div>
    </div>
  );
}

/** Marque « enregistré ✓ » affichée à côté du champ qui vient d'être écrit. */
export function MarqueEnregistre() {
  return <span className="text-xs font-normal normal-case text-emerald-600">enregistré ✓</span>;
}

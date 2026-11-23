import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Table, EmptyState, Badge } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';
import type { TresorerieCharge } from '@/lib/database.types';
import { RECURRENCE_LABELS, STATUT_CHARGE_LABELS, STATUT_CHARGE_TONES } from './calculs';

/** Onglet « Charges » : liste des dépenses, ponctuelles ou récurrentes. */
export function OngletCharges({
  charges, ouvrirCharge, supprimerCharge,
}: {
  charges: TresorerieCharge[];
  ouvrirCharge: (c?: TresorerieCharge) => void;
  supprimerCharge: (id: string) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Saisie libre : loyer, salaires, URSSAF, abonnements, sous-traitance…
          Une charge récurrente se répète automatiquement dans le prévisionnel.
        </p>
        <Button onClick={() => ouvrirCharge()}>
          <Plus className="h-4 w-4" /> Nouvelle charge
        </Button>
      </div>
      {charges.length === 0 ? (
        <EmptyState title="Aucune charge" message="Ajoutez vos dépenses pour obtenir un solde projeté." />
      ) : (
        <Table
          head={(
            <tr>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3">Échéance</th>
              <th className="px-4 py-3">Récurrence</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3" />
            </tr>
          )}
        >
          {charges.map((c) => (
            <tr key={c.id} className="hover:bg-surface-2/50">
              <td className="px-4 py-3 font-medium text-fg">{c.libelle}</td>
              <td className="px-4 py-3 text-muted">{c.categorie ?? '—'}</td>
              <td className="px-4 py-3 text-muted">{c.fournisseur ?? '—'}</td>
              <td className="px-4 py-3 text-muted">{formatDate(c.date_echeance)}</td>
              <td className="px-4 py-3">
                <Badge tone={c.recurrence === 'ponctuelle' ? 'neutral' : 'info'}>
                  {RECURRENCE_LABELS[c.recurrence]}
                </Badge>
                {c.recurrence !== 'ponctuelle' && c.recurrence_fin && (
                  <span className="block text-xs text-muted">jusqu'au {formatDate(c.recurrence_fin)}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUT_CHARGE_TONES[c.statut]}>{STATUT_CHARGE_LABELS[c.statut]}</Badge>
              </td>
              <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400">
                − {formatMoney(Number(c.montant))}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button className="btn-ghost" onClick={() => ouvrirCharge(c)} aria-label="Modifier">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost" onClick={() => void supprimerCharge(c.id)} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

import { Pencil } from 'lucide-react';
import { Button, Table, Card } from '@/components/ui';
import { formatMoney, formatDate, cn } from '@/lib/utils';
import type { TresorerieConfig } from '@/lib/database.types';
import { moisLabel, type Projection } from './calculs';

/** Onglet « Prévisionnel » : point de départ du solde et tableau mois par mois. */
export function OngletPrevisionnel({
  conf, projection, inclureNonPlanifie, setInclureNonPlanifie, onModifierSolde,
}: {
  conf: TresorerieConfig | null;
  projection: Projection;
  inclureNonPlanifie: boolean;
  setInclureNonPlanifie: (v: boolean) => void;
  onModifierSolde: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Point de départ du solde cumulé</p>
          <p className="text-lg font-semibold text-fg">
            {formatMoney(Number(conf?.solde_initial ?? 0))}
            <span className="ml-2 text-sm font-normal text-muted">
              au {conf ? formatDate(conf.date_solde) : '—'}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Dernier solde bancaire connu. Les mouvements postérieurs à cette date et antérieurs
            au mois courant sont déjà intégrés au solde de départ ci-dessous.
          </p>
        </div>
        <Button variant="secondary" onClick={onModifierSolde}>
          <Pencil className="h-4 w-4" /> Modifier
        </Button>
      </Card>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={inclureNonPlanifie}
          onChange={(e) => setInclureNonPlanifie(e.target.checked)}
        />
        Inclure le gagné non planifié dans le solde (hypothèse : encaissé au mois de clôture)
      </label>

      <Table
        head={(
          <tr>
            <th className="px-4 py-3">Mois</th>
            <th className="px-4 py-3 text-right">Encaissements</th>
            <th className="px-4 py-3 text-right">Charges</th>
            <th className="px-4 py-3 text-right">Net</th>
            <th className="px-4 py-3 text-right">Solde cumulé</th>
            <th className="px-4 py-3 text-right">Gagné non planifié</th>
          </tr>
        )}
      >
        {projection.rows.map((r) => (
          <tr key={r.cle} className="hover:bg-surface-2/50">
            <td className="px-4 py-3 font-medium capitalize text-fg">{moisLabel(r.cle)}</td>
            <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
              {r.entrees ? formatMoney(r.entrees) : '—'}
              {r.entreesRealisees > 0 && (
                <span className="block text-xs text-muted">
                  dont {formatMoney(r.entreesRealisees)} encaissés
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
              {r.sorties ? `− ${formatMoney(r.sorties)}` : '—'}
            </td>
            <td className={cn('px-4 py-3 text-right font-medium', r.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-fg')}>
              {formatMoney(r.net)}
            </td>
            <td className={cn('px-4 py-3 text-right font-semibold', r.solde < 0 ? 'text-red-600 dark:text-red-400' : 'text-fg')}>
              {formatMoney(r.solde)}
            </td>
            <td className="px-4 py-3 text-right text-muted">
              {r.nonPlanifie ? formatMoney(r.nonPlanifie) : '—'}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

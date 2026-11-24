import { Plus, Pencil, Trash2, CalendarClock, Check } from 'lucide-react';
import { Button, Table, EmptyState, Badge } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/utils';
import type { Opportunite, TresorerieEncaissement } from '@/lib/database.types';
import { STATUT_ENC_LABELS, STATUT_ENC_TONES, type bilanOpportunite } from './calculs';

/** Onglet « Encaissements » : échéancier des affaires gagnées et encaissements hors pipeline. */
export function OngletEncaissements({
  gagnees, libres, bilanOpp, nomClient, ouvrirPlanif, ouvrirLibre, supprimerEncaissement,
}: {
  gagnees: Opportunite[];
  libres: TresorerieEncaissement[];
  bilanOpp: (o: Opportunite) => ReturnType<typeof bilanOpportunite>;
  nomClient: (o: Opportunite) => string;
  ouvrirPlanif: (o: Opportunite) => void;
  ouvrirLibre: (e?: TresorerieEncaissement) => void;
  supprimerEncaissement: (id: string) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Pipeline gagné — échéancier de versement
        </h2>
        {gagnees.length === 0 ? (
          <EmptyState
            title="Aucune affaire gagnée"
            message="Les opportunités passées en « Gagné » dans le pipeline apparaissent ici pour être échelonnées."
          />
        ) : (
          <Table
            head={(
              <tr>
                <th className="px-4 py-3">Affaire</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Gagnée le</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-right">Planifié</th>
                <th className="px-4 py-3 text-right">Encaissé</th>
                <th className="px-4 py-3 text-right">Reste à planifier</th>
                <th className="px-4 py-3" />
              </tr>
            )}
          >
            {gagnees.map((o) => {
              const b = bilanOpp(o);
              return (
                <tr key={o.id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3 font-medium text-fg">{o.titre}</td>
                  <td className="px-4 py-3 text-muted">{nomClient(o)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(o.date_cloture)}</td>
                  <td className="px-4 py-3 text-right font-medium text-fg">{formatMoney(b.montant)}</td>
                  <td className="px-4 py-3 text-right text-muted">
                    {formatMoney(b.planifie)}
                    {b.lignes.length > 0 && (
                      <span className="block text-xs text-muted">{b.lignes.length} versement(s)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                    {b.encaisse ? formatMoney(b.encaisse) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.reste > 0.5 ? (
                      <Badge tone="warning">{formatMoney(b.reste)}</Badge>
                    ) : b.reste < -0.5 ? (
                      <Badge tone="danger">{formatMoney(-b.reste)} en trop</Badge>
                    ) : (
                      <Badge tone="success"><Check className="h-3 w-3" /> Planifié</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-secondary" onClick={() => ouvrirPlanif(o)}>
                      <CalendarClock className="h-4 w-4" /> Échéancier
                    </button>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Encaissements hors pipeline
          </h2>
          <Button onClick={() => ouvrirLibre()}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
        {libres.length === 0 ? (
          <EmptyState
            title="Aucun encaissement libre"
            message="Subvention, remboursement, apport… tout ce qui entre sans passer par le pipeline."
          />
        ) : (
          <Table
            head={(
              <tr>
                <th className="px-4 py-3">Libellé</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3" />
              </tr>
            )}
          >
            {libres.map((e) => (
              <tr key={e.id} className="hover:bg-surface-2/50">
                <td className="px-4 py-3 font-medium text-fg">{e.libelle}</td>
                <td className="px-4 py-3 text-muted">{formatDate(e.date_encaissement ?? e.date_prevue)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUT_ENC_TONES[e.statut]}>{STATUT_ENC_LABELS[e.statut]}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{e.mode_reglement ?? '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-fg">{formatMoney(Number(e.montant))}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="btn-ghost" onClick={() => ouvrirLibre(e)} aria-label="Modifier">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost" onClick={() => void supprimerEncaissement(e.id)} aria-label="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}

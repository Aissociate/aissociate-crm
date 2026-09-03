import { useMemo, useState } from 'react';
import { Activity, RefreshCw, TriangleAlert, CircleCheck as CheckCircle2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { Card, Table, Spinner, Badge, Button, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { JobRun, ClientError } from '@/lib/database.types';

/**
 * Santé des automatisations (Administration) : dernier état de chaque Edge
 * Function planifiée (journal `job_runs`, alimenté par les fonctions
 * elles-mêmes) + dernières erreurs front capturées par l'ErrorBoundary.
 * Un job « silencieux » depuis trop longtemps est signalé — c'est le symptôme
 * d'un cron cassé même sans erreur enregistrée.
 */

// Fréquence attendue de chaque job : au-delà, il est considéré silencieux.
const ATTENDUS: Record<string, { label: string; maxHeures: number }> = {
  'notifications-cron': { label: 'Notifications quotidiennes', maxHeures: 30 },
  'rgpd-purge': { label: 'Purge RGPD (hebdomadaire)', maxHeures: 24 * 8 },
  'qonto-sync': { label: 'Rapprochement Qonto', maxHeures: 30 },
};

export default function SanteJobs() {
  const runs = useCollection<JobRun>('job_runs', { orderBy: { column: 'started_at', ascending: false } });
  const errors = useCollection<ClientError>('client_errors', { orderBy: { column: 'created_at', ascending: false } });
  const [detail, setDetail] = useState<string | null>(null);

  const parFonction = useMemo(() => {
    const m = new Map<string, JobRun[]>();
    for (const r of runs.data) {
      const arr = m.get(r.fonction) ?? [];
      if (arr.length < 15) arr.push(r);
      m.set(r.fonction, arr);
    }
    return m;
  }, [runs.data]);

  const fonctions = [...new Set([...Object.keys(ATTENDUS), ...parFonction.keys()])];

  if (runs.loading || errors.loading) {
    return <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Chaque fonction planifiée consigne ses exécutions dans <code>job_runs</code> (90 jours conservés).
        </p>
        <Button variant="secondary" onClick={() => { runs.refresh(); errors.refresh(); }}><RefreshCw className="h-4 w-4" /> Actualiser</Button>
      </div>

      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><Activity className="h-4 w-4 text-brand-500" /> Jobs planifiés</h3>
        {fonctions.length === 0 ? (
          <EmptyState title="Aucune exécution journalisée" message="Les jobs alimenteront ce tableau à leur prochaine exécution (crons pg_cron + Edge Functions)." />
        ) : (
          <Table head={<tr><th className="px-4 py-3">Fonction</th><th className="px-4 py-3">Dernière exécution</th><th className="px-4 py-3">État</th><th className="px-4 py-3">Résultat</th></tr>}>
            {fonctions.map((fn) => {
              const hist = parFonction.get(fn) ?? [];
              const dernier = hist[0];
              const attendu = ATTENDUS[fn];
              const silencieux = attendu && (!dernier ||
                Date.now() - new Date(dernier.started_at).getTime() > attendu.maxHeures * 3_600_000);
              return (
                <tr key={fn} className="cursor-pointer hover:bg-surface-2" onClick={() => setDetail(detail === fn ? null : fn)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-fg">{attendu?.label ?? fn}</p>
                    <p className="text-xs text-muted">{fn}</p>
                    {detail === fn && hist.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted">
                        {hist.map((h) => (
                          <li key={h.id} className="flex items-center gap-2">
                            {h.ok ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" /> : <TriangleAlert className="h-3 w-3 shrink-0 text-red-500" />}
                            {formatDate(h.started_at, 'dd/MM HH:mm')} — {h.message ?? '—'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-muted">{dernier ? formatDate(dernier.started_at, 'dd/MM/yyyy HH:mm') : 'Jamais'}</td>
                  <td className="px-4 py-3 align-top">
                    {silencieux ? <Badge tone="warning">Silencieux</Badge>
                      : !dernier ? <Badge tone="neutral">—</Badge>
                      : dernier.ok ? <Badge tone="success">OK</Badge>
                      : <Badge tone="danger">Erreur</Badge>}
                  </td>
                  <td className="max-w-md px-4 py-3 align-top text-xs text-muted">{dernier?.message ?? '—'}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><TriangleAlert className="h-4 w-4 text-amber-500" /> Erreurs front (ErrorBoundary)</h3>
        {errors.data.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Aucune erreur de rendu capturée. 🎉</p>
        ) : (
          <Table head={<tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Page</th><th className="px-4 py-3">Message</th></tr>}>
            {errors.data.slice(0, 30).map((e) => (
              <tr key={e.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 text-muted">{formatDate(e.created_at, 'dd/MM/yyyy HH:mm')}</td>
                <td className="px-4 py-3 text-muted">{e.url ?? '—'}</td>
                <td className="max-w-lg px-4 py-3 text-xs text-fg">{e.message}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

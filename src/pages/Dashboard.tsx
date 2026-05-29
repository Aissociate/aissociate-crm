import { Link } from 'react-router-dom';
import {
  FolderKanban, Users, TrendingUp, Euro, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, StatCard, Card, Spinner, Badge } from '@/components/ui';
import { DOSSIER_STATUT_COLORS, DOSSIER_STATUT_LABELS, OPP_STAGE_LABELS } from '@/lib/constants';
import { formatMoney, formatDate } from '@/lib/utils';
import type { Dossier, Opportunite, Contact } from '@/lib/database.types';

export default function Dashboard() {
  const { profile } = useAuth();
  const dossiers = useCollection<Dossier>('dossiers', { orderBy: { column: 'created_at', ascending: false } });
  const opps = useCollection<Opportunite>('opportunites');
  const contacts = useCollection<Contact>('contacts');

  if (dossiers.loading || opps.loading || contacts.loading) {
    return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  }

  const dossiersActifs = dossiers.data.filter((d) => !['cloture', 'refuse'].includes(d.statut));
  const pipelineMontant = opps.data
    .filter((o) => !['gagne', 'perdu'].includes(o.stage))
    .reduce((s, o) => s + Number(o.montant ?? 0), 0);
  const montantAccorde = dossiers.data.reduce((s, d) => s + Number(d.montant_accorde ?? 0), 0);

  // Alertes : dossiers en instruction depuis longtemps ou sans date de dépôt
  const aTraiter = dossiers.data.filter((d) => ['brouillon', 'montage'].includes(d.statut));

  return (
    <div>
      <PageHeader
        title={`Bonjour ${profile?.prenom || ''} 👋`}
        subtitle="Vue d'ensemble de votre activité de gestion des dossiers de formation"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dossiers actifs" value={dossiersActifs.length} icon={<FolderKanban className="h-6 w-6" />} hint={`${dossiers.data.length} au total`} />
        <StatCard label="Contacts" value={contacts.data.length} icon={<Users className="h-6 w-6" />} />
        <StatCard label="Pipeline en cours" value={formatMoney(pipelineMontant)} icon={<TrendingUp className="h-6 w-6" />} hint={`${opps.data.length} opportunités`} />
        <StatCard label="Financements accordés" value={formatMoney(montantAccorde)} icon={<Euro className="h-6 w-6" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-fg">Derniers dossiers</h2>
            <Link to="/dossiers" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
              Tout voir <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {dossiers.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Aucun dossier pour l'instant.</p>
          ) : (
            <ul className="divide-y divide-line">
              {dossiers.data.slice(0, 6).map((d) => (
                <li key={d.id}>
                  <Link to={`/dossiers/${d.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{d.intitule}</p>
                      <p className="text-xs text-muted">{d.reference} · {formatDate(d.created_at)}</p>
                    </div>
                    <Badge className={DOSSIER_STATUT_COLORS[d.statut]}>{DOSSIER_STATUT_LABELS[d.statut]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-fg">À traiter</h2>
          </div>
          {aTraiter.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Rien à traiter, bravo !</p>
          ) : (
            <ul className="space-y-2">
              {aTraiter.slice(0, 7).map((d) => (
                <li key={d.id}>
                  <Link to={`/dossiers/${d.id}`} className="block rounded-lg border border-line px-3 py-2 hover:bg-surface-2">
                    <p className="truncate text-sm font-medium text-fg">{d.intitule}</p>
                    <p className="text-xs text-muted">{DOSSIER_STATUT_LABELS[d.statut]}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Pipeline par étape</p>
            {Object.entries(
              opps.data.reduce<Record<string, number>>((acc, o) => {
                acc[o.stage] = (acc[o.stage] ?? 0) + 1;
                return acc;
              }, {}),
            ).map(([stage, n]) => (
              <div key={stage} className="flex items-center justify-between py-1 text-sm">
                <span className="text-muted">{OPP_STAGE_LABELS[stage as keyof typeof OPP_STAGE_LABELS]}</span>
                <span className="font-medium text-fg">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

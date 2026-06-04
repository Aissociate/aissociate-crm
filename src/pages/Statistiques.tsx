import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Card, Spinner, StatCard } from '@/components/ui';
import {
  DOSSIER_STATUT_LABELS, OPP_STAGE_LABELS, OPP_STAGE_ORDER,
} from '@/lib/constants';
import { formatMoney } from '@/lib/utils';
import type { Dossier, Opportunite, Financeur, DossierStatut } from '@/lib/database.types';

// Palette de graphiques : marque en tête, puis tons sémantiques (cf. Badge), nuances de marque, neutre.
const COLORS = ['#ea6a1e', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#fb9a3c', '#fdba74', '#64748b'];
const GRID = 'rgb(148 163 184 / 0.2)';

export default function Statistiques() {
  const { isManager } = useAuth();
  const dossiers = useCollection<Dossier>('dossiers');
  const opps = useCollection<Opportunite>('opportunites');
  const financeurs = useCollection<Financeur>('financeurs');

  if (dossiers.loading || opps.loading || financeurs.loading) {
    return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  }

  const parStatut = (Object.keys(DOSSIER_STATUT_LABELS) as DossierStatut[])
    .map((s) => ({ name: DOSSIER_STATUT_LABELS[s], value: dossiers.data.filter((d) => d.statut === s).length }))
    .filter((x) => x.value > 0);

  const parFinanceur = financeurs.data.map((f) => ({
    name: f.code,
    montant: dossiers.data.filter((d) => d.financeur_id === f.id).reduce((s, d) => s + Number(d.montant_accorde || d.montant_demande || 0), 0),
  })).filter((x) => x.montant > 0);

  const parStage = OPP_STAGE_ORDER.map((s) => ({
    name: OPP_STAGE_LABELS[s], value: opps.data.filter((o) => o.stage === s).length,
  }));

  const totalAccorde = dossiers.data.reduce((s, d) => s + Number(d.montant_accorde ?? 0), 0);
  const gagnees = opps.data.filter((o) => o.stage === 'gagne').length;
  const tauxConv = opps.data.length ? Math.round((gagnees / opps.data.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Statistiques & reporting"
        subtitle={isManager ? 'Indicateurs collectifs de l\'activité (4.8)' : 'Vos indicateurs individuels (4.8)'}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dossiers" value={dossiers.data.length} />
        <StatCard label="Financements accordés" value={formatMoney(totalAccorde)} />
        <StatCard label="Opportunités" value={opps.data.length} />
        <StatCard label="Taux de conversion" value={`${tauxConv}%`} hint={`${gagnees} gagnées`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-fg">Dossiers par statut</h2>
          {parStatut.length === 0 ? <p className="py-10 text-center text-sm text-muted">Aucune donnée</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={parStatut} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {parStatut.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-fg">Montants par financeur</h2>
          {parFinanceur.length === 0 ? <p className="py-10 text-center text-sm text-muted">Aucune donnée</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={parFinanceur}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Bar dataKey="montant" fill="#ea6a1e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-semibold text-fg">Pipeline commercial par étape</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={parStage}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

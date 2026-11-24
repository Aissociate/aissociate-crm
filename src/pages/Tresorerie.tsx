import { useMemo, useState } from 'react';
import { Wallet, TrendingDown, TrendingUp, AlertTriangle, Landmark, Download } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Spinner, StatCard } from '@/components/ui';
import { formatMoney, formatDate, fullName, cn } from '@/lib/utils';
import type {
  Opportunite, Contact, Entreprise, Profile,
  TresorerieEncaissement, TresorerieCharge, TresorerieConfig,
} from '@/lib/database.types';
import { aujourdhui, moisLabel, bilanOpportunite, calculerProjection } from './tresorerie/calculs';
import { OngletPrevisionnel } from './tresorerie/OngletPrevisionnel';
import { OngletEncaissements } from './tresorerie/OngletEncaissements';
import { OngletCharges } from './tresorerie/OngletCharges';
import { ModaleSolde } from './tresorerie/ModaleSolde';
import { ModaleEcheancier } from './tresorerie/ModaleEcheancier';
import { ModaleEncaissementLibre } from './tresorerie/ModaleEncaissementLibre';
import { ModaleCharge } from './tresorerie/ModaleCharge';

/**
 * Trésorerie prévisionnelle — réservée à la direction (route managerOnly, RLS
 * `is_manager()` sur les trois tables).
 *
 * Le pipeline dit COMBIEN on a gagné, jamais QUAND l'argent arrive. Une affaire
 * gagnée s'encaisse rarement au comptant : acompte + solde, mensualités OPCO,
 * subrogation CPF versée après la formation… D'où un échéancier par
 * opportunité gagnée : chaque ligne est un versement daté, décalable, partiel.
 * Le « reste à planifier » (gagné − somme des échéances) est affiché en
 * permanence : c'est de l'argent gagné dont la date d'arrivée est encore
 * inconnue, il ne doit jamais se fondre silencieusement dans le solde.
 *
 * Les charges sont en saisie libre (libellé, catégorie, fournisseur), avec une
 * récurrence optionnelle. Une charge récurrente est une PROJECTION : ses
 * occurrences sont recalculées à chaque affichage, jamais stockées.
 *
 * Découpage : calculs purs dans `tresorerie/calculs.ts`, un fichier par onglet et par modale
 * dans `tresorerie/`. Cette page charge les données et tient l'état d'ouverture.
 */

type Onglet = 'previsionnel' | 'encaissements' | 'charges';

export default function Tresorerie() {
  const { session } = useAuth();
  const opportunites = useCollection<Opportunite>('opportunites');
  const encaissements = useCollection<TresorerieEncaissement>('tresorerie_encaissements', {
    orderBy: { column: 'date_prevue', ascending: true },
  });
  const charges = useCollection<TresorerieCharge>('tresorerie_charges', {
    orderBy: { column: 'date_echeance', ascending: true },
  });
  const config = useCollection<TresorerieConfig>('tresorerie_config');
  const contacts = useCollection<Contact>('contacts');
  const entreprises = useCollection<Entreprise>('entreprises');
  const profiles = useCollection<Profile>('profiles');

  const [onglet, setOnglet] = useState<Onglet>('previsionnel');
  const [horizon, setHorizon] = useState(12);
  const [inclureNonPlanifie, setInclureNonPlanifie] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const loading = opportunites.loading || encaissements.loading || charges.loading || config.loading;

  const nomClient = (o: Opportunite): string => {
    const e = o.entreprise_id ? entreprises.data.find((x) => x.id === o.entreprise_id) : null;
    if (e) return e.raison_sociale;
    const c = o.contact_id ? contacts.data.find((x) => x.id === o.contact_id) : null;
    return c ? fullName(c.prenom, c.nom) : '—';
  };
  const nomProfil = (id: string | null) => {
    const p = id ? profiles.data.find((x) => x.id === id) : null;
    return p ? fullName(p.prenom, p.nom) : '—';
  };

  const userId = session?.user.id ?? null;

  // ── Solde de départ ────────────────────────────────────────────────────────
  const conf = config.data[0] ?? null;
  const [soldeOpen, setSoldeOpen] = useState(false);

  // ── Opportunités gagnées et leur échéancier ────────────────────────────────
  const gagnees = useMemo(
    () => opportunites.data
      .filter((o) => o.stage === 'gagne')
      .sort((a, b) => (b.date_cloture ?? b.updated_at).localeCompare(a.date_cloture ?? a.updated_at)),
    [opportunites.data],
  );

  const bilanOpp = (o: Opportunite) => bilanOpportunite(o, encaissements.data);

  const nonPlanifie = useMemo(() => {
    const rows = gagnees.map((o) => ({ opp: o, ...bilanOpp(o) })).filter((r) => r.reste > 0.5);
    return { rows, total: rows.reduce((s, r) => s + r.reste, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gagnees, encaissements.data]);

  // ── Projection mensuelle ───────────────────────────────────────────────────
  const projection = useMemo(
    () => calculerProjection({
      horizon, encaissements: encaissements.data, charges: charges.data, conf,
      nonPlanifie: nonPlanifie.rows, inclureNonPlanifie,
    }),
    [horizon, encaissements.data, charges.data, conf, nonPlanifie.rows, inclureNonPlanifie],
  );

  // ── Modales : la page ne tient que « laquelle est ouverte, sur quoi » ──────
  const [planifOpp, setPlanifOpp] = useState<Opportunite | null>(null);
  const [libre, setLibre] = useState<{ edit: TresorerieEncaissement | null } | null>(null);
  const [charge, setCharge] = useState<{ edit: TresorerieCharge | null } | null>(null);

  const ouvrirPlanif = (o: Opportunite) => { setErreur(null); setPlanifOpp(o); };
  const ouvrirLibre = (e?: TresorerieEncaissement) => { setErreur(null); setLibre({ edit: e ?? null }); };
  const ouvrirCharge = (c?: TresorerieCharge) => { setErreur(null); setCharge({ edit: c ?? null }); };

  const supprimerEncaissement = async (id: string) => {
    if (!confirm('Supprimer cet encaissement ?')) return;
    const { error } = await supabase.from('tresorerie_encaissements').delete().eq('id', id);
    if (error) { setErreur(error.message); return; }
    await encaissements.refresh();
  };

  const supprimerCharge = async (id: string) => {
    if (!confirm('Supprimer cette charge ?')) return;
    const { error } = await supabase.from('tresorerie_charges').delete().eq('id', id);
    if (error) { setErreur(error.message); return; }
    await charges.refresh();
  };

  // ── Export CSV du prévisionnel ─────────────────────────────────────────────
  const exportCsv = () => {
    const sep = ';';
    const nb = (n: number) => n.toFixed(2).replace('.', ',');
    const lignes: string[][] = [
      [`Trésorerie prévisionnelle — ${horizon} mois — export du ${formatDate(aujourdhui())}`],
      ['Solde de départ', nb(projection.soldeDepart)],
      [],
      ['Mois', 'Encaissements', 'dont réalisés', 'Charges', 'Net', 'Solde cumulé', 'Gagné non planifié'],
      ...projection.rows.map((r) => [
        moisLabel(r.cle), nb(r.entrees), nb(r.entreesRealisees), nb(r.sorties),
        nb(r.net), nb(r.solde), nb(r.nonPlanifie),
      ]),
    ];
    const csv = '﻿' + lignes.map((l) => l.join(sep)).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tresorerie-${horizon}mois-${aujourdhui()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const libres = encaissements.data.filter((e) => !e.opportunite_id);

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Trésorerie"
        subtitle="Direction — échéancier d'encaissement du pipeline gagné et charges prévisionnelles"
        actions={
          <>
            <select
              className="input w-auto"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              aria-label="Horizon de projection"
            >
              <option value={6}>6 mois</option>
              <option value={12}>12 mois</option>
              <option value={24}>24 mois</option>
            </select>
            <Button variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Exporter
            </Button>
          </>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {erreur}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Solde de départ"
          value={formatMoney(projection.soldeDepart)}
          icon={<Landmark className="h-5 w-5" />}
          hint={conf ? `Relevé du ${formatDate(conf.date_solde)}` : 'Non renseigné'}
        />
        <StatCard
          label={`Encaissements (${horizon} mois)`}
          value={formatMoney(projection.totalEntrees)}
          icon={<TrendingUp className="h-5 w-5" />}
          hint={`dont ${formatMoney(projection.totalRealisees)} déjà encaissés`}
        />
        <StatCard
          label={`Charges (${horizon} mois)`}
          value={formatMoney(projection.totalSorties)}
          icon={<TrendingDown className="h-5 w-5" />}
          hint={`${charges.data.filter((c) => c.statut !== 'annulee').length} charge(s) active(s)`}
        />
        <StatCard
          label="Solde projeté"
          value={(
            <span className={projection.soldeFinal < 0 ? 'text-red-600 dark:text-red-400' : undefined}>
              {formatMoney(projection.soldeFinal)}
            </span>
          )}
          icon={<Wallet className="h-5 w-5" />}
          hint={`à fin ${moisLabel(projection.rows[projection.rows.length - 1]?.cle ?? '')}`}
        />
      </div>

      {projection.moisNegatif && (
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Solde négatif projeté dès <strong className="capitalize">{moisLabel(projection.moisNegatif.cle)}</strong>
            {' '}({formatMoney(projection.moisNegatif.solde)}).
          </span>
        </div>
      )}

      {nonPlanifie.total > 0.5 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <strong>{formatMoney(nonPlanifie.total)}</strong> gagnés sans échéancier
            {' '}({nonPlanifie.rows.length} affaire{nonPlanifie.rows.length > 1 ? 's' : ''}) : la date
            d'encaissement n'est pas connue, ces montants ne comptent pas dans le solde projeté.
          </span>
          <button className="btn-secondary" onClick={() => setOnglet('encaissements')}>
            Planifier
          </button>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2 border-b border-line">
        {([
          ['previsionnel', 'Prévisionnel'],
          ['encaissements', `Encaissements (${encaissements.data.length})`],
          ['charges', `Charges (${charges.data.length})`],
        ] as [Onglet, string][]).map(([cle, label]) => (
          <button
            key={cle}
            onClick={() => setOnglet(cle)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              onglet === cle
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {label}
          </button>
        ))}
      </div>


      {onglet === 'previsionnel' && (
        <OngletPrevisionnel
          conf={conf}
          projection={projection}
          inclureNonPlanifie={inclureNonPlanifie}
          setInclureNonPlanifie={setInclureNonPlanifie}
          onModifierSolde={() => { setErreur(null); setSoldeOpen(true); }}
        />
      )}
      {onglet === 'encaissements' && (
        <OngletEncaissements
          gagnees={gagnees}
          libres={libres}
          bilanOpp={bilanOpp}
          nomClient={nomClient}
          ouvrirPlanif={ouvrirPlanif}
          ouvrirLibre={ouvrirLibre}
          supprimerEncaissement={supprimerEncaissement}
        />
      )}
      {onglet === 'charges' && (
        <OngletCharges charges={charges.data} ouvrirCharge={ouvrirCharge} supprimerCharge={supprimerCharge} />
      )}

      <ModaleSolde
        open={soldeOpen}
        conf={conf}
        nomProfil={nomProfil}
        userId={userId}
        onClose={() => setSoldeOpen(false)}
        setErreur={setErreur}
        onSaved={config.refresh}
      />
      {planifOpp && (
        <ModaleEcheancier
          key={planifOpp.id}
          planifOpp={planifOpp}
          encaissements={encaissements.data}
          userId={userId}
          onClose={() => setPlanifOpp(null)}
          setErreur={setErreur}
          onSaved={encaissements.refresh}
        />
      )}
      {libre && (
        <ModaleEncaissementLibre
          libreEdit={libre.edit}
          userId={userId}
          onClose={() => setLibre(null)}
          setErreur={setErreur}
          onSaved={encaissements.refresh}
        />
      )}
      {charge && (
        <ModaleCharge
          chargeEdit={charge.edit}
          userId={userId}
          onClose={() => setCharge(null)}
          setErreur={setErreur}
          onSaved={charges.refresh}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Wallet, Plus, Pencil, Trash2, CalendarClock, TrendingDown, TrendingUp,
  AlertTriangle, Landmark, Download, Check,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge, StatCard, Card, type Tone,
} from '@/components/ui';
import { formatMoney, formatDate, fullName, cn } from '@/lib/utils';
import type {
  Opportunite, Contact, Entreprise, Profile,
  TresorerieEncaissement, TresorerieCharge, TresorerieConfig,
  EncaissementStatut, ChargeRecurrence, ChargeStatut,
} from '@/lib/database.types';

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
 */

const STATUT_ENC_LABELS: Record<EncaissementStatut, string> = {
  prevu: 'Prévu', encaisse: 'Encaissé', annule: 'Annulé',
};
const STATUT_ENC_TONES: Record<EncaissementStatut, Tone> = {
  prevu: 'info', encaisse: 'success', annule: 'neutral',
};
const RECURRENCE_LABELS: Record<ChargeRecurrence, string> = {
  ponctuelle: 'Ponctuelle', mensuelle: 'Mensuelle', trimestrielle: 'Trimestrielle', annuelle: 'Annuelle',
};
const STATUT_CHARGE_LABELS: Record<ChargeStatut, string> = {
  prevue: 'Prévue', payee: 'Payée', annulee: 'Annulée',
};
const STATUT_CHARGE_TONES: Record<ChargeStatut, Tone> = {
  prevue: 'warning', payee: 'success', annulee: 'neutral',
};

// ── Dates ───────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aujourdhui = () => ymd(new Date());
/** « 2026-09-15 » → « 2026-09 ». */
const moisDe = (iso: string) => iso.slice(0, 7);
/** Décale une date de n mois en bornant le quantième (31 janv. +1 mois → 28 févr.). */
function ajouterMois(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dernierJour = new Date(y, m - 1 + n + 1, 0).getDate();
  return ymd(new Date(y, m - 1 + n, Math.min(d, dernierJour)));
}
const moisLabel = (cle: string) => {
  if (!cle) return '—';
  const [y, m] = cle.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};

/** Occurrences d'une charge jusqu'à `finHorizon` (récurrence dépliée). */
function occurrencesCharge(c: TresorerieCharge, finHorizon: string): string[] {
  if (c.statut === 'annulee') return [];
  if (c.recurrence === 'ponctuelle') return [c.date_echeance];
  const pas = c.recurrence === 'mensuelle' ? 1 : c.recurrence === 'trimestrielle' ? 3 : 12;
  const fin = c.recurrence_fin && c.recurrence_fin < finHorizon ? c.recurrence_fin : finHorizon;
  const dates: string[] = [];
  for (let i = 0; i < 400; i++) {
    const d = ajouterMois(c.date_echeance, i * pas);
    if (d > fin) break;
    dates.push(d);
  }
  return dates;
}

type Onglet = 'previsionnel' | 'encaissements' | 'charges';
type LigneEcheance = {
  id?: string; libelle: string; date_prevue: string; montant: string;
  statut: EncaissementStatut; date_encaissement: string; mode_reglement: string;
};

const ligneVide = (libelle = ''): LigneEcheance => ({
  libelle, date_prevue: aujourdhui(), montant: '', statut: 'prevu',
  date_encaissement: '', mode_reglement: '',
});

const chargeVide = () => ({
  libelle: '', categorie: '', fournisseur: '', montant: '',
  date_echeance: aujourdhui(), recurrence: 'ponctuelle' as ChargeRecurrence,
  recurrence_fin: '', statut: 'prevue' as ChargeStatut, date_paiement: '', notes: '',
});

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

  // ── Solde de départ ────────────────────────────────────────────────────────
  const conf = config.data[0] ?? null;
  const [soldeForm, setSoldeForm] = useState({ solde_initial: '', date_solde: aujourdhui() });
  const [soldeOpen, setSoldeOpen] = useState(false);
  useEffect(() => {
    if (conf) setSoldeForm({ solde_initial: String(conf.solde_initial ?? 0), date_solde: conf.date_solde });
  }, [conf?.solde_initial, conf?.date_solde]);

  const enregistrerSolde = async () => {
    const { error } = await supabase.from('tresorerie_config').upsert({
      id: true,
      solde_initial: Number(soldeForm.solde_initial) || 0,
      date_solde: soldeForm.date_solde,
      updated_by: session?.user.id ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) { setErreur(error.message); return; }
    setSoldeOpen(false);
    await config.refresh();
  };

  // ── Opportunités gagnées et leur échéancier ────────────────────────────────
  const gagnees = useMemo(
    () => opportunites.data
      .filter((o) => o.stage === 'gagne')
      .sort((a, b) => (b.date_cloture ?? b.updated_at).localeCompare(a.date_cloture ?? a.updated_at)),
    [opportunites.data],
  );

  /** Échéancier d'une opportunité : total planifié, déjà encaissé, reste. */
  const bilanOpp = (o: Opportunite) => {
    const lignes = encaissements.data.filter((e) => e.opportunite_id === o.id && e.statut !== 'annule');
    const planifie = lignes.reduce((s, e) => s + Number(e.montant || 0), 0);
    const encaisse = lignes.filter((e) => e.statut === 'encaisse').reduce((s, e) => s + Number(e.montant || 0), 0);
    const montant = Number(o.montant || 0);
    return { lignes, planifie, encaisse, montant, reste: Math.round((montant - planifie) * 100) / 100 };
  };

  const nonPlanifie = useMemo(() => {
    const rows = gagnees.map((o) => ({ opp: o, ...bilanOpp(o) })).filter((r) => r.reste > 0.5);
    return { rows, total: rows.reduce((s, r) => s + r.reste, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gagnees, encaissements.data]);

  // ── Projection mensuelle ───────────────────────────────────────────────────
  const projection = useMemo(() => {
    const debut = new Date();
    const premierMois = `${debut.getFullYear()}-${pad(debut.getMonth() + 1)}`;
    const cles = Array.from({ length: horizon }, (_, i) => {
      const d = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    });
    const finHorizon = ymd(new Date(debut.getFullYear(), debut.getMonth() + horizon, 0));
    const debutFenetre = `${premierMois}-01`;

    const lignes = new Map<string, {
      cle: string; entrees: number; entreesRealisees: number; sorties: number; nonPlanifie: number;
    }>();
    for (const cle of cles) lignes.set(cle, { cle, entrees: 0, entreesRealisees: 0, sorties: 0, nonPlanifie: 0 });

    // Mouvements ANTÉRIEURS à la fenêtre mais postérieurs au relevé de solde :
    // ils ont déjà bougé le compte sans figurer dans le tableau → on les intègre
    // au solde de départ, sinon la première ligne repartirait d'un solde faux.
    const dateSolde = conf?.date_solde ?? debutFenetre;
    let avant = 0;

    for (const e of encaissements.data) {
      if (e.statut === 'annule') continue;
      const date = e.date_encaissement ?? e.date_prevue;
      if (date > dateSolde && date < debutFenetre) { avant += Number(e.montant || 0); continue; }
      const l = lignes.get(moisDe(date));
      if (!l) continue;
      l.entrees += Number(e.montant || 0);
      if (e.statut === 'encaisse') l.entreesRealisees += Number(e.montant || 0);
    }

    for (const c of charges.data) {
      for (const date of occurrencesCharge(c, finHorizon)) {
        if (date > dateSolde && date < debutFenetre) { avant -= Number(c.montant || 0); continue; }
        const l = lignes.get(moisDe(date));
        if (!l) continue;
        l.sorties += Number(c.montant || 0);
      }
    }

    // Reste à planifier : rattaché au mois de clôture de l'affaire, ramené au
    // mois courant quand la clôture est déjà passée (l'argent n'est pas arrivé).
    for (const r of nonPlanifie.rows) {
      const cloture = (r.opp.date_cloture ?? r.opp.updated_at).slice(0, 7);
      const cle = cloture < premierMois ? premierMois : cloture;
      const l = lignes.get(cle);
      if (l) l.nonPlanifie += r.reste;
    }

    const soldeDepart = Number(conf?.solde_initial ?? 0) + avant;
    let cumul = soldeDepart;
    const rows = cles.map((cle) => {
      const l = lignes.get(cle)!;
      const net = l.entrees - l.sorties + (inclureNonPlanifie ? l.nonPlanifie : 0);
      cumul += net;
      return { ...l, net, solde: cumul };
    });

    return {
      rows, soldeDepart, debutFenetre, finHorizon,
      totalEntrees: rows.reduce((s, r) => s + r.entrees, 0),
      totalRealisees: rows.reduce((s, r) => s + r.entreesRealisees, 0),
      totalSorties: rows.reduce((s, r) => s + r.sorties, 0),
      soldeFinal: cumul,
      moisNegatif: rows.find((r) => r.solde < 0) ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon, encaissements.data, charges.data, conf?.solde_initial, conf?.date_solde, nonPlanifie.rows, inclureNonPlanifie]);

  // ── Échéancier (modale) ────────────────────────────────────────────────────
  const [planifOpp, setPlanifOpp] = useState<Opportunite | null>(null);
  const [lignesEch, setLignesEch] = useState<LigneEcheance[]>([]);
  const [nbVersements, setNbVersements] = useState('3');
  const [savingEch, setSavingEch] = useState(false);

  const ouvrirPlanif = (o: Opportunite) => {
    const toutes = encaissements.data.filter((e) => e.opportunite_id === o.id);
    setLignesEch(toutes.length
      ? toutes.map((e) => ({
          id: e.id, libelle: e.libelle, date_prevue: e.date_prevue,
          montant: String(e.montant), statut: e.statut,
          date_encaissement: e.date_encaissement ?? '', mode_reglement: e.mode_reglement ?? '',
        }))
      : [{ ...ligneVide(o.titre), montant: String(o.montant ?? 0) }]);
    setNbVersements('3');
    setErreur(null);
    setPlanifOpp(o);
  };

  const majLigne = (i: number, k: keyof LigneEcheance, v: string) =>
    setLignesEch((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));

  const totalLignes = lignesEch
    .filter((l) => l.statut !== 'annule')
    .reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const resteLignes = planifOpp
    ? Math.round((Number(planifOpp.montant || 0) - totalLignes) * 100) / 100
    : 0;

  /** Étale le reste (ou le montant total si l'échéancier est vide) en N mensualités. */
  const repartir = () => {
    if (!planifOpp) return;
    const n = Math.max(1, Math.min(60, Number(nbVersements) || 1));
    const complete = resteLignes > 0.5;
    const base = complete ? resteLignes : Number(planifOpp.montant || 0);
    if (base <= 0) return;
    const part = Math.floor((base / n) * 100) / 100;
    const depart = complete && lignesEch.length
      ? ajouterMois(lignesEch[lignesEch.length - 1].date_prevue, 1)
      : aujourdhui();
    const nouvelles: LigneEcheance[] = Array.from({ length: n }, (_, i) => ({
      ...ligneVide(`${planifOpp.titre} — versement ${i + 1}/${n}`),
      date_prevue: ajouterMois(depart, i),
      // Le dernier versement absorbe l'arrondi : la somme retombe au centime.
      montant: String(i === n - 1 ? Math.round((base - part * (n - 1)) * 100) / 100 : part),
    }));
    // Il reste à planifier → on complète l'échéancier ; sinon on le remplace.
    setLignesEch((ls) => (complete ? [...ls, ...nouvelles] : nouvelles));
  };

  const enregistrerEcheancier = async () => {
    if (!planifOpp) return;
    setSavingEch(true);
    setErreur(null);
    const existantes = encaissements.data.filter((e) => e.opportunite_id === planifOpp.id);
    const gardes = new Set(lignesEch.map((l) => l.id).filter(Boolean) as string[]);
    const aSupprimer = existantes.filter((e) => !gardes.has(e.id)).map((e) => e.id);

    let msg: string | null = null;
    if (aSupprimer.length) {
      const { error } = await supabase.from('tresorerie_encaissements').delete().in('id', aSupprimer);
      msg = msg ?? error?.message ?? null;
    }
    for (const l of lignesEch) {
      const payload = {
        opportunite_id: planifOpp.id,
        libelle: l.libelle.trim() || planifOpp.titre,
        montant: Number(l.montant) || 0,
        date_prevue: l.date_prevue,
        statut: l.statut,
        date_encaissement: l.statut === 'encaisse' ? (l.date_encaissement || l.date_prevue) : null,
        mode_reglement: l.mode_reglement.trim() || null,
      };
      const { error } = l.id
        ? await supabase.from('tresorerie_encaissements').update(payload).eq('id', l.id)
        : await supabase.from('tresorerie_encaissements').insert({ ...payload, created_by: session?.user.id ?? null });
      msg = msg ?? error?.message ?? null;
    }
    setSavingEch(false);
    if (msg) { setErreur(msg); return; }
    setPlanifOpp(null);
    await encaissements.refresh();
  };

  // ── Encaissement libre (modale) ────────────────────────────────────────────
  const [libreOpen, setLibreOpen] = useState(false);
  const [libreEdit, setLibreEdit] = useState<TresorerieEncaissement | null>(null);
  const [libreForm, setLibreForm] = useState<LigneEcheance>(ligneVide());

  const ouvrirLibre = (e?: TresorerieEncaissement) => {
    setLibreEdit(e ?? null);
    setLibreForm(e
      ? {
          id: e.id, libelle: e.libelle, date_prevue: e.date_prevue, montant: String(e.montant),
          statut: e.statut, date_encaissement: e.date_encaissement ?? '', mode_reglement: e.mode_reglement ?? '',
        }
      : ligneVide());
    setErreur(null);
    setLibreOpen(true);
  };

  const enregistrerLibre = async () => {
    const payload = {
      opportunite_id: null,
      libelle: libreForm.libelle.trim() || 'Encaissement',
      montant: Number(libreForm.montant) || 0,
      date_prevue: libreForm.date_prevue,
      statut: libreForm.statut,
      date_encaissement: libreForm.statut === 'encaisse'
        ? (libreForm.date_encaissement || libreForm.date_prevue) : null,
      mode_reglement: libreForm.mode_reglement.trim() || null,
    };
    const { error } = libreEdit
      ? await supabase.from('tresorerie_encaissements').update(payload).eq('id', libreEdit.id)
      : await supabase.from('tresorerie_encaissements').insert({ ...payload, created_by: session?.user.id ?? null });
    if (error) { setErreur(error.message); return; }
    setLibreOpen(false);
    await encaissements.refresh();
  };

  const supprimerEncaissement = async (id: string) => {
    if (!confirm('Supprimer cet encaissement ?')) return;
    const { error } = await supabase.from('tresorerie_encaissements').delete().eq('id', id);
    if (error) { setErreur(error.message); return; }
    await encaissements.refresh();
  };

  // ── Charges (modale) ───────────────────────────────────────────────────────
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeEdit, setChargeEdit] = useState<TresorerieCharge | null>(null);
  const [chargeForm, setChargeForm] = useState(chargeVide());
  const setC = (k: keyof ReturnType<typeof chargeVide>, v: string) =>
    setChargeForm((f) => ({ ...f, [k]: v }));

  const ouvrirCharge = (c?: TresorerieCharge) => {
    setChargeEdit(c ?? null);
    setChargeForm(c
      ? {
          libelle: c.libelle, categorie: c.categorie ?? '', fournisseur: c.fournisseur ?? '',
          montant: String(c.montant), date_echeance: c.date_echeance, recurrence: c.recurrence,
          recurrence_fin: c.recurrence_fin ?? '', statut: c.statut,
          date_paiement: c.date_paiement ?? '', notes: c.notes ?? '',
        }
      : chargeVide());
    setErreur(null);
    setChargeOpen(true);
  };

  const enregistrerCharge = async () => {
    if (!chargeForm.libelle.trim()) { setErreur('Le libellé de la charge est obligatoire.'); return; }
    const ponctuelle = chargeForm.recurrence === 'ponctuelle';
    const payload = {
      libelle: chargeForm.libelle.trim(),
      categorie: chargeForm.categorie.trim() || null,
      fournisseur: chargeForm.fournisseur.trim() || null,
      montant: Number(chargeForm.montant) || 0,
      date_echeance: chargeForm.date_echeance,
      recurrence: chargeForm.recurrence,
      recurrence_fin: ponctuelle ? null : (chargeForm.recurrence_fin || null),
      // « Payée » et sa date n'ont de sens que pour une charge ponctuelle : une
      // charge récurrente est une projection, pas une facture unique.
      statut: ponctuelle ? chargeForm.statut : (chargeForm.statut === 'annulee' ? 'annulee' : 'prevue'),
      date_paiement: ponctuelle && chargeForm.statut === 'payee'
        ? (chargeForm.date_paiement || chargeForm.date_echeance) : null,
      notes: chargeForm.notes.trim() || null,
    };
    const { error } = chargeEdit
      ? await supabase.from('tresorerie_charges').update(payload).eq('id', chargeEdit.id)
      : await supabase.from('tresorerie_charges').insert({ ...payload, created_by: session?.user.id ?? null });
    if (error) { setErreur(error.message); return; }
    setChargeOpen(false);
    await charges.refresh();
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

      {/* ── Prévisionnel ─────────────────────────────────────────────────── */}
      {onglet === 'previsionnel' && (
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
            <Button variant="secondary" onClick={() => { setErreur(null); setSoldeOpen(true); }}>
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
      )}

      {/* ── Encaissements ────────────────────────────────────────────────── */}
      {onglet === 'encaissements' && (
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
      )}

      {/* ── Charges ──────────────────────────────────────────────────────── */}
      {onglet === 'charges' && (
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
          {charges.data.length === 0 ? (
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
              {charges.data.map((c) => (
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
      )}

      {/* ── Modale : solde de départ ─────────────────────────────────────── */}
      <Modal
        open={soldeOpen}
        onClose={() => setSoldeOpen(false)}
        title="Point de départ du solde"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setSoldeOpen(false)}>Annuler</Button>
            <Button onClick={() => void enregistrerSolde()}>Enregistrer</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Solde bancaire" hint="Montant disponible sur le compte à la date du relevé.">
            <input
              type="number" step="0.01" className="input"
              value={soldeForm.solde_initial}
              onChange={(e) => setSoldeForm((f) => ({ ...f, solde_initial: e.target.value }))}
            />
          </Field>
          <Field label="Date du relevé">
            <input
              type="date" className="input"
              value={soldeForm.date_solde}
              onChange={(e) => setSoldeForm((f) => ({ ...f, date_solde: e.target.value }))}
            />
          </Field>
          {conf?.updated_by && (
            <p className="text-xs text-muted">
              Dernière mise à jour par {nomProfil(conf.updated_by)} le {formatDate(conf.updated_at)}.
            </p>
          )}
        </div>
      </Modal>

      {/* ── Modale : échéancier d'une affaire gagnée ─────────────────────── */}
      <Modal
        open={!!planifOpp}
        onClose={() => setPlanifOpp(null)}
        wide
        title={planifOpp ? `Échéancier — ${planifOpp.titre}` : 'Échéancier'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setPlanifOpp(null)}>Annuler</Button>
            <Button onClick={() => void enregistrerEcheancier()} disabled={savingEch}>
              {savingEch && <Spinner className="h-4 w-4" />} Enregistrer
            </Button>
          </>
        )}
      >
        {planifOpp && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Montant gagné</p>
                <p className="font-semibold text-fg">{formatMoney(Number(planifOpp.montant || 0))}</p>
              </div>
              <div className="rounded-lg bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Total échéancier</p>
                <p className="font-semibold text-fg">{formatMoney(totalLignes)}</p>
              </div>
              <div className="rounded-lg bg-surface-2 px-3 py-2">
                <p className="text-xs text-muted">Reste à planifier</p>
                <p className={cn(
                  'font-semibold',
                  Math.abs(resteLignes) < 0.5
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400',
                )}>
                  {formatMoney(resteLignes)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3">
              <div>
                <label className="label">Étaler en</label>
                <input
                  type="number" min={1} max={60} className="input w-24"
                  value={nbVersements}
                  onChange={(e) => setNbVersements(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={repartir}>versements mensuels</Button>
              <p className="min-w-[14rem] flex-1 text-xs text-muted">
                Répartit le reste à planifier — ou le montant total quand tout est déjà planifié —
                en mensualités consécutives. Chaque ligne reste modifiable ensuite.
              </p>
            </div>

            <div className="space-y-2">
              {lignesEch.map((l, i) => (
                <div key={l.id ?? `n${i}`} className="grid items-end gap-2 rounded-lg border border-line p-3 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <label className="label">Libellé</label>
                    <input
                      className="input" value={l.libelle} placeholder={planifOpp.titre}
                      onChange={(e) => majLigne(i, 'libelle', e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Date prévue</label>
                    <input
                      type="date" className="input" value={l.date_prevue}
                      onChange={(e) => majLigne(i, 'date_prevue', e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Montant</label>
                    <input
                      type="number" step="0.01" className="input" value={l.montant}
                      onChange={(e) => majLigne(i, 'montant', e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Statut</label>
                    <select
                      className="input" value={l.statut}
                      onChange={(e) => majLigne(i, 'statut', e.target.value)}
                    >
                      {(Object.keys(STATUT_ENC_LABELS) as EncaissementStatut[]).map((s) => (
                        <option key={s} value={s}>{STATUT_ENC_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Encaissé le</label>
                    <input
                      type="date" className="input" value={l.date_encaissement}
                      disabled={l.statut !== 'encaisse'}
                      onChange={(e) => majLigne(i, 'date_encaissement', e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end sm:col-span-1">
                    <button
                      className="btn-ghost"
                      onClick={() => setLignesEch((ls) => ls.filter((_, idx) => idx !== i))}
                      aria-label="Supprimer le versement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => setLignesEch((ls) => [
                  ...ls,
                  {
                    ...ligneVide(planifOpp.titre),
                    date_prevue: ls.length ? ajouterMois(ls[ls.length - 1].date_prevue, 1) : aujourdhui(),
                    montant: resteLignes > 0.5 ? String(resteLignes) : '',
                  },
                ])}
              >
                <Plus className="h-4 w-4" /> Ajouter un versement
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modale : encaissement libre ──────────────────────────────────── */}
      <Modal
        open={libreOpen}
        onClose={() => setLibreOpen(false)}
        title={libreEdit ? "Modifier l'encaissement" : 'Nouvel encaissement'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setLibreOpen(false)}>Annuler</Button>
            <Button onClick={() => void enregistrerLibre()}>Enregistrer</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Libellé" required>
            <input
              className="input" value={libreForm.libelle}
              onChange={(e) => setLibreForm((f) => ({ ...f, libelle: e.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Montant">
              <input
                type="number" step="0.01" className="input" value={libreForm.montant}
                onChange={(e) => setLibreForm((f) => ({ ...f, montant: e.target.value }))}
              />
            </Field>
            <Field label="Date prévue">
              <input
                type="date" className="input" value={libreForm.date_prevue}
                onChange={(e) => setLibreForm((f) => ({ ...f, date_prevue: e.target.value }))}
              />
            </Field>
            <Field label="Statut">
              <select
                className="input" value={libreForm.statut}
                onChange={(e) => setLibreForm((f) => ({ ...f, statut: e.target.value as EncaissementStatut }))}
              >
                {(Object.keys(STATUT_ENC_LABELS) as EncaissementStatut[]).map((s) => (
                  <option key={s} value={s}>{STATUT_ENC_LABELS[s]}</option>
                ))}
              </select>
            </Field>
            <Field label="Encaissé le">
              <input
                type="date" className="input" value={libreForm.date_encaissement}
                disabled={libreForm.statut !== 'encaisse'}
                onChange={(e) => setLibreForm((f) => ({ ...f, date_encaissement: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Mode de règlement" hint="Virement, prélèvement, chèque…">
            <input
              className="input" value={libreForm.mode_reglement}
              onChange={(e) => setLibreForm((f) => ({ ...f, mode_reglement: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      {/* ── Modale : charge ──────────────────────────────────────────────── */}
      <Modal
        open={chargeOpen}
        onClose={() => setChargeOpen(false)}
        title={chargeEdit ? 'Modifier la charge' : 'Nouvelle charge'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setChargeOpen(false)}>Annuler</Button>
            <Button onClick={() => void enregistrerCharge()}>Enregistrer</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Libellé" required>
            <input className="input" value={chargeForm.libelle} onChange={(e) => setC('libelle', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Catégorie" hint="Texte libre : loyer, salaires, URSSAF…">
              <input className="input" value={chargeForm.categorie} onChange={(e) => setC('categorie', e.target.value)} />
            </Field>
            <Field label="Fournisseur">
              <input className="input" value={chargeForm.fournisseur} onChange={(e) => setC('fournisseur', e.target.value)} />
            </Field>
            <Field label="Montant">
              <input
                type="number" step="0.01" className="input"
                value={chargeForm.montant} onChange={(e) => setC('montant', e.target.value)}
              />
            </Field>
            <Field label="Échéance" hint="Première échéance si la charge est récurrente.">
              <input
                type="date" className="input"
                value={chargeForm.date_echeance} onChange={(e) => setC('date_echeance', e.target.value)}
              />
            </Field>
            <Field label="Récurrence">
              <select className="input" value={chargeForm.recurrence} onChange={(e) => setC('recurrence', e.target.value)}>
                {(Object.keys(RECURRENCE_LABELS) as ChargeRecurrence[]).map((r) => (
                  <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
                ))}
              </select>
            </Field>
            {chargeForm.recurrence === 'ponctuelle' ? (
              <Field label="Statut">
                <select className="input" value={chargeForm.statut} onChange={(e) => setC('statut', e.target.value)}>
                  {(Object.keys(STATUT_CHARGE_LABELS) as ChargeStatut[]).map((s) => (
                    <option key={s} value={s}>{STATUT_CHARGE_LABELS[s]}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Jusqu'au" hint="Vide = sans fin (bornée à l'horizon affiché).">
                <input
                  type="date" className="input"
                  value={chargeForm.recurrence_fin} onChange={(e) => setC('recurrence_fin', e.target.value)}
                />
              </Field>
            )}
          </div>
          {chargeForm.recurrence === 'ponctuelle' && chargeForm.statut === 'payee' && (
            <Field label="Payée le">
              <input
                type="date" className="input"
                value={chargeForm.date_paiement} onChange={(e) => setC('date_paiement', e.target.value)}
              />
            </Field>
          )}
          {chargeForm.recurrence !== 'ponctuelle' && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
              Une charge récurrente est une projection : elle se répète dans le prévisionnel sans
              être « payée » ligne à ligne. Pour un suivi au réel, créez des charges ponctuelles.
            </p>
          )}
          <Field label="Notes">
            <textarea className="input" rows={2} value={chargeForm.notes} onChange={(e) => setC('notes', e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

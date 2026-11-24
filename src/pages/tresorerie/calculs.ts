// Trésorerie — libellés, dates et calculs purs (aucun accès réseau, aucun état React).
import type { Tone } from '@/components/ui';
import type {
  Opportunite, TresorerieEncaissement, TresorerieCharge, TresorerieConfig,
  EncaissementStatut, ChargeRecurrence, ChargeStatut,
} from '@/lib/database.types';

export const STATUT_ENC_LABELS: Record<EncaissementStatut, string> = {
  prevu: 'Prévu', encaisse: 'Encaissé', annule: 'Annulé',
};
export const STATUT_ENC_TONES: Record<EncaissementStatut, Tone> = {
  prevu: 'info', encaisse: 'success', annule: 'neutral',
};
export const RECURRENCE_LABELS: Record<ChargeRecurrence, string> = {
  ponctuelle: 'Ponctuelle', mensuelle: 'Mensuelle', trimestrielle: 'Trimestrielle', annuelle: 'Annuelle',
};
export const STATUT_CHARGE_LABELS: Record<ChargeStatut, string> = {
  prevue: 'Prévue', payee: 'Payée', annulee: 'Annulée',
};
export const STATUT_CHARGE_TONES: Record<ChargeStatut, Tone> = {
  prevue: 'warning', payee: 'success', annulee: 'neutral',
};

// ── Dates ───────────────────────────────────────────────────────────────────
export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const aujourdhui = () => ymd(new Date());
/** « 2026-09-15 » → « 2026-09 ». */
export const moisDe = (iso: string) => iso.slice(0, 7);
/** Décale une date de n mois en bornant le quantième (31 janv. +1 mois → 28 févr.). */
export function ajouterMois(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dernierJour = new Date(y, m - 1 + n + 1, 0).getDate();
  return ymd(new Date(y, m - 1 + n, Math.min(d, dernierJour)));
}
export const moisLabel = (cle: string) => {
  if (!cle) return '—';
  const [y, m] = cle.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};

/** Occurrences d'une charge jusqu'à `finHorizon` (récurrence dépliée). */
export function occurrencesCharge(c: TresorerieCharge, finHorizon: string): string[] {
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

export type Onglet = 'previsionnel' | 'encaissements' | 'charges';
export type LigneEcheance = {
  id?: string; libelle: string; date_prevue: string; montant: string;
  statut: EncaissementStatut; date_encaissement: string; mode_reglement: string;
};

export const ligneVide = (libelle = ''): LigneEcheance => ({
  libelle, date_prevue: aujourdhui(), montant: '', statut: 'prevu',
  date_encaissement: '', mode_reglement: '',
});

export const chargeVide = () => ({
  libelle: '', categorie: '', fournisseur: '', montant: '',
  date_echeance: aujourdhui(), recurrence: 'ponctuelle' as ChargeRecurrence,
  recurrence_fin: '', statut: 'prevue' as ChargeStatut, date_paiement: '', notes: '',
});

/** Échéancier d'une opportunité : total planifié, déjà encaissé, reste. */
export function bilanOpportunite(o: Opportunite, encaissements: TresorerieEncaissement[]) {
  const lignes = encaissements.filter((e) => e.opportunite_id === o.id && e.statut !== 'annule');
  const planifie = lignes.reduce((s, e) => s + Number(e.montant || 0), 0);
  const encaisse = lignes.filter((e) => e.statut === 'encaisse').reduce((s, e) => s + Number(e.montant || 0), 0);
  const montant = Number(o.montant || 0);
  return { lignes, planifie, encaisse, montant, reste: Math.round((montant - planifie) * 100) / 100 };
}

/** Affaire gagnée dont une partie du montant n'a pas encore de date d'encaissement. */
export type ResteAPlanifier = { opp: Opportunite; reste: number };

/** Projection mensuelle du solde sur `horizon` mois à partir du mois courant. */
export function calculerProjection({
  horizon, encaissements, charges, conf, nonPlanifie, inclureNonPlanifie,
}: {
  horizon: number;
  encaissements: TresorerieEncaissement[];
  charges: TresorerieCharge[];
  conf: TresorerieConfig | null;
  nonPlanifie: ResteAPlanifier[];
  inclureNonPlanifie: boolean;
}) {
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

  for (const e of encaissements) {
    if (e.statut === 'annule') continue;
    const date = e.date_encaissement ?? e.date_prevue;
    if (date > dateSolde && date < debutFenetre) { avant += Number(e.montant || 0); continue; }
    const l = lignes.get(moisDe(date));
    if (!l) continue;
    l.entrees += Number(e.montant || 0);
    if (e.statut === 'encaisse') l.entreesRealisees += Number(e.montant || 0);
  }

  for (const c of charges) {
    for (const date of occurrencesCharge(c, finHorizon)) {
      if (date > dateSolde && date < debutFenetre) { avant -= Number(c.montant || 0); continue; }
      const l = lignes.get(moisDe(date));
      if (!l) continue;
      l.sorties += Number(c.montant || 0);
    }
  }

  // Reste à planifier : rattaché au mois de clôture de l'affaire, ramené au
  // mois courant quand la clôture est déjà passée (l'argent n'est pas arrivé).
  for (const r of nonPlanifie) {
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
}
export type Projection = ReturnType<typeof calculerProjection>;

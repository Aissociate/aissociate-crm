import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Opportunite, TresorerieCharge, TresorerieConfig, TresorerieEncaissement } from '@/lib/database.types';
import { ajouterMois, bilanOpportunite, calculerProjection, occurrencesCharge } from './calculs';

const charge = (c: Partial<TresorerieCharge>) => ({
  id: 'c', libelle: 'Loyer', montant: 100, date_echeance: '2026-01-31',
  recurrence: 'ponctuelle', recurrence_fin: null, statut: 'prevue', ...c,
}) as TresorerieCharge;
const enc = (e: Partial<TresorerieEncaissement>) => ({
  id: 'e', opportunite_id: null, libelle: 'Versement', montant: 0,
  date_prevue: '2026-11-10', date_encaissement: null, statut: 'prevu', ...e,
}) as TresorerieEncaissement;

describe('ajouterMois', () => {
  it('borne le quantième au dernier jour du mois', () => {
    expect(ajouterMois('2026-01-31', 1)).toBe('2026-02-28');
    expect(ajouterMois('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('occurrencesCharge', () => {
  it('déplie une charge mensuelle jusqu\'à l\'horizon', () => {
    expect(occurrencesCharge(charge({ recurrence: 'mensuelle' }), '2026-04-30'))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('s\'arrête à la fin de récurrence et ignore les charges annulées', () => {
    expect(occurrencesCharge(charge({ recurrence: 'trimestrielle', recurrence_fin: '2026-05-01' }), '2026-12-31'))
      .toEqual(['2026-01-31', '2026-04-30']);
    expect(occurrencesCharge(charge({ statut: 'annulee' }), '2026-12-31')).toEqual([]);
  });
});

describe('bilanOpportunite', () => {
  it('calcule le planifié, l\'encaissé et le reste, sans les échéances annulées', () => {
    const o = { id: 'o1', montant: 1000 } as Opportunite;
    const b = bilanOpportunite(o, [
      enc({ id: '1', opportunite_id: 'o1', montant: 300, statut: 'encaisse' }),
      enc({ id: '2', opportunite_id: 'o1', montant: 200 }),
      enc({ id: '3', opportunite_id: 'o1', montant: 500, statut: 'annule' }),
      enc({ id: '4', opportunite_id: 'autre', montant: 999 }),
    ]);
    expect(b).toMatchObject({ planifie: 500, encaisse: 300, montant: 1000, reste: 500 });
  });
});

describe('calculerProjection', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 24)); });
  afterEach(() => { vi.useRealTimers(); });

  const conf = { solde_initial: 1000, date_solde: '2026-10-15' } as TresorerieConfig;
  const base = {
    horizon: 3, conf, inclureNonPlanifie: false, nonPlanifie: [],
    encaissements: [
      enc({ id: 'avant', montant: 200, date_prevue: '2026-10-20' }),          // après le relevé, avant la fenêtre
      enc({ id: 'nov', montant: 500, date_prevue: '2026-11-10', statut: 'encaisse', date_encaissement: '2026-11-12' }),
      enc({ id: 'annule', montant: 9999, statut: 'annule' }),
    ],
    charges: [charge({ montant: 300, date_echeance: '2026-10-05', recurrence: 'mensuelle' })],
  };

  it('intègre au solde de départ les mouvements entre le relevé et le mois courant', () => {
    // + 200 (encaissement du 20/10) ; la charge du 05/10 est antérieure au relevé.
    expect(calculerProjection(base).soldeDepart).toBe(1200);
  });

  it('cumule entrées et sorties mois par mois', () => {
    const p = calculerProjection(base);
    expect(p.rows.map((r) => r.cle)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(p.rows.map((r) => r.solde)).toEqual([1400, 1100, 800]);
    expect(p.totalRealisees).toBe(500);
    expect(p.totalSorties).toBe(900);
    expect(p.moisNegatif).toBeNull();
  });

  it('ne compte le gagné non planifié que sur demande, ramené au mois courant', () => {
    const nonPlanifie = [{ opp: { date_cloture: '2026-09-01', updated_at: '2026-09-01' } as Opportunite, reste: 400 }];
    expect(calculerProjection({ ...base, nonPlanifie }).soldeFinal).toBe(800);
    const avec = calculerProjection({ ...base, nonPlanifie, inclureNonPlanifie: true });
    expect(avec.rows[0].nonPlanifie).toBe(400);
    expect(avec.soldeFinal).toBe(1200);
  });
});

import { describe, expect, it } from 'vitest';
import { ACTIONS_APRES_ESSAI, enEssai, essaiTermine, joursRestants } from './essai';
import { parametresTaxe, tvaReunion } from './stripe';
import { titreCgv } from './cgv';

const maintenant = new Date('2026-11-20T10:00:00Z');

describe('essai gratuit', () => {
  it('ne concerne que les espaces d\'essai sans abonnement payé', () => {
    expect(enEssai({ essai_fin: null })).toBe(false);
    expect(enEssai({ essai_fin: '2026-11-25T10:00:00Z', abonnement_statut: null })).toBe(true);
    expect(enEssai({ essai_fin: '2026-11-25T10:00:00Z', abonnement_statut: 'active' })).toBe(false);
    expect(enEssai({ essai_fin: '2026-11-15T10:00:00Z', abonnement_statut: 'canceled' })).toBe(true);
  });
  it('se termine à la date prévue et compte les jours restants', () => {
    expect(essaiTermine({ essai_fin: '2026-11-20T09:59:00Z' }, maintenant)).toBe(true);
    expect(essaiTermine({ essai_fin: '2026-11-21T10:00:00Z' }, maintenant)).toBe(false);
    expect(joursRestants({ essai_fin: '2026-11-27T09:00:00Z' }, maintenant)).toBe(7);
    expect(joursRestants({ essai_fin: '2026-11-19T09:00:00Z' }, maintenant)).toBe(0);
    expect(joursRestants({ essai_fin: null }, maintenant)).toBeNull();
  });
  it('laisse ouvert l\'abonnement mais pas les agents une fois terminé', () => {
    expect(ACTIONS_APRES_ESSAI.has('abonnement_souscrire')).toBe(true);
    expect(ACTIONS_APRES_ESSAI.has('chat')).toBe(false);
  });
});

describe('TVA et conditions générales', () => {
  it('sait appliquer 8,5 % fixe ou Stripe Tax selon le réglage', () => {
    expect(tvaReunion('97417')).toBe(true);
    expect(tvaReunion('974 00')).toBe(true);
    expect(tvaReunion('75011')).toBe(false);
    expect(tvaReunion(undefined)).toBe(false);
    expect(parametresTaxe(true, 'txr_1')).toEqual({ lignes: { tax_rates: ['txr_1'] }, session: {} });
    expect(parametresTaxe(false, null).session).toMatchObject({ automatic_tax: { enabled: true }, billing_address_collection: 'required' });
  });
  it('affiche un titre de document propre', () => {
    expect(titreCgv('Drive — CGV — Agents virtuels IA — Aissociate SARL (modèle Word)')).toBe('CGV — Agents virtuels IA — Aissociate SARL');
  });
});

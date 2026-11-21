import { describe, expect, it } from 'vitest';
import { cleConnecteur, formulaire, lireAbonnement, montantAbonnement, montantAgents, periodeDe, verifierSignature } from './stripe';

const hmac = async (secret: string, texte: string) => {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texte)))].map((x) => x.toString(16).padStart(2, '0')).join('');
};

describe('paiement Stripe du Studio', () => {
  it('aplatit les paramètres à la manière de Stripe', () => {
    const f = decodeURIComponent(formulaire({ mode: 'payment', line_items: [{ quantity: 1, tax_rates: ['txr_1'] }], metadata: { app: 'studio' }, vide: undefined }));
    expect(f).toBe('mode=payment&line_items[0][quantity]=1&line_items[0][tax_rates][0]=txr_1&metadata[app]=studio');
  });
  it('calcule l\'abonnement dégressif des agents', () => {
    expect(montantAgents(0)).toBe(0);
    expect(montantAgents(1)).toBe(149);
    expect(montantAgents(3)).toBe(149 + 131 + 112);
    expect(montantAgents(6)).toBe(149 + 131 + 112 + 93 + 74.5 + 74.5);
  });
  it('n\'accepte que les webhooks signés et récents', async () => {
    const corps = '{"id":"evt_1"}', t = 1_800_000_000;
    const sig = await hmac('whsec_x', `${t}.${corps}`);
    expect(await verifierSignature('whsec_x', `t=${t},v1=${sig}`, corps, t + 10)).toBe(true);
    expect(await verifierSignature('whsec_x', `t=${t},v1=${sig}`, corps + ' ', t + 10)).toBe(false);
    expect(await verifierSignature('whsec_y', `t=${t},v1=${sig}`, corps, t + 10)).toBe(false);
    expect(await verifierSignature('whsec_x', `t=${t},v1=${sig}`, corps, t + 1000)).toBe(false);
    expect(await verifierSignature('whsec_x', null, corps, t)).toBe(false);
  });
  it('lit les quantités et le montant d\'un abonnement', () => {
    const a = lireAbonnement({
      id: 'sub_1', status: 'active', customer: 'cus_1',
      items: { data: [
        { id: 'si_a', quantity: 2, price: { lookup_key: 'studio_agents_v2', unit_amount: null }, current_period_end: 1_800_000_000 },
        { id: 'si_c', quantity: 3, price: { lookup_key: 'studio_connecteur_999', unit_amount: 999 } },
      ] },
    });
    expect(a).toMatchObject({ agents: 2, connecteurs: 3, articleAgents: 'si_a', articleConnecteurs: 'si_c', montant_ht: 309.97 });
    expect(a.fin).toBe(new Date(1_800_000_000_000).toISOString());
    expect(a).toMatchObject({ periode: 'mois', mensuel_ht: 309.97 });
  });
  it('facture l\'année dix mois, agents et connecteurs', () => {
    expect(montantAgents(1, 'an')).toBe(1490);
    expect(montantAgents(3, 'an')).toBe((149 + 131 + 112) * 10);
    expect(montantAbonnement(2, 3, 9.99)).toBe(309.97);
    expect(montantAbonnement(2, 3, 9.99, 'an')).toBe(3099.7);
    expect(cleConnecteur(999)).toBe('studio_connecteur_999');
    expect(cleConnecteur(999, 'an')).toBe('studio_connecteur_999_an');
    expect(periodeDe('an')).toBe('an');
    expect(periodeDe('year')).toBe('mois');
    expect(periodeDe(undefined)).toBe('mois');
  });
  it('lit un abonnement annuel : montant de l\'année et équivalent par mois', () => {
    const a = lireAbonnement({
      id: 'sub_2', status: 'active', customer: 'cus_1',
      items: { data: [
        { id: 'si_a', quantity: 2, price: { lookup_key: 'studio_agents_v2_an', unit_amount: null }, current_period_end: 1_800_000_000 },
        { id: 'si_c', quantity: 1, price: { lookup_key: 'studio_connecteur_999_an', unit_amount: 9990 } },
      ] },
    });
    expect(a).toMatchObject({ agents: 2, connecteurs: 1, periode: 'an', articleAgents: 'si_a', articleConnecteurs: 'si_c', montant_ht: 2899.9, mensuel_ht: 241.66 });
  });
});

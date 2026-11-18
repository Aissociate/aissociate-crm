import { describe, expect, it } from 'vitest';
import { APPLICATIONS, applicationsDepuis, boutiqueShopify, estApplication } from './applications';
import { RESEAUX } from './zernio';
import { actifsDepuis } from './facturation';
import { APPLICATIONS_UN_CLIC, RESEAUX_PUBLICATION } from '../../../src/lib/tarifConnecteurs';

describe('applications en un clic', () => {
  it('garde la même liste côté serveur et côté site', () => {
    const site = APPLICATIONS_UN_CLIC.flatMap((g) => g.apps.map((a) => a.slug));
    expect(new Set(site).size).toBe(site.length);
    expect(site.filter((s) => !RESEAUX_PUBLICATION.includes(s)).sort()).toEqual(Object.keys(APPLICATIONS).sort());
    for (const r of RESEAUX_PUBLICATION) expect(RESEAUX).toContain(r);
    for (const a of Object.keys(APPLICATIONS)) expect(RESEAUX).not.toContain(a);
  });
  it('ne retient que les applications de la liste', () => {
    const c = applicationsDepuis([
      { _id: '1', platform: 'hubspot', displayName: 'Ma société' }, { _id: '2', platform: 'facebook' },
      { _id: '3', platform: 'stripe', needsReconnection: true }, { _id: '4', platform: 'constructor' },
    ]);
    expect(c).toEqual([{ id: '1', app: 'hubspot', nom: 'Ma société', a_reconnecter: false }, { id: '3', app: 'stripe', nom: 'Stripe', a_reconnecter: true }]);
    expect(estApplication('toString')).toBe(false);
  });
  it('normalise l\'adresse d\'une boutique Shopify', () => {
    expect(boutiqueShopify('Ma-Boutique')).toBe('ma-boutique.myshopify.com');
    expect(boutiqueShopify('https://ma-boutique.myshopify.com/admin')).toBe('ma-boutique.myshopify.com');
    expect(boutiqueShopify('evil.com?x=')).toBeNull();
    expect(boutiqueShopify('')).toBeNull();
  });
  it('facture une application connectée comme une application, sauf si elle est à reconnecter', () => {
    const a = actifsDepuis([
      { _id: '1', platform: 'hubspot', displayName: 'Ma société' }, { _id: '2', platform: 'stripe', needsReconnection: true },
      { _id: '3', platform: 'twitter', username: 'moi' },
    ], []);
    expect(a).toEqual([{ type: 'app', libelle: 'HubSpot', detail: 'Ma société' }, { type: 'twitter', libelle: 'X', detail: 'moi' }]);
  });
});

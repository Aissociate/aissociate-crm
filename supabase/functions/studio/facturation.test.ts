import { describe, expect, it } from 'vitest';
import { actifsDepuis, facturer, INCLUS_DEFAUT, lireTarif, PRIX_DEFAUT, typeManuel } from './facturation';

describe('facturation des connecteurs', () => {
  it('lit le tarif, avec repli sur les valeurs par défaut', () => {
    expect(lireTarif([])).toEqual({ prix: PRIX_DEFAUT, inclus: INCLUS_DEFAUT });
    expect(lireTarif([{ cle: 'prix_connecteur_supplementaire_ht', valeur: '12,5' }, { cle: 'connecteurs_inclus', valeur: 'google, LinkedIn,inconnu,google' }]))
      .toEqual({ prix: 12.5, inclus: ['google', 'linkedin'] });
    expect(lireTarif([{ cle: 'prix_connecteur_supplementaire_ht', valeur: 'abc' }, { cle: 'connecteurs_inclus', valeur: '' }]))
      .toEqual({ prix: PRIX_DEFAUT, inclus: [] });
  });

  it('ramène les connecteurs manuels à un type facturable', () => {
    expect(typeManuel('outlook')).toBe('microsoft');
    expect(typeManuel('smtp')).toBe('imap');
    expect(typeManuel('app:pennylane')).toBe('app');
    expect(typeManuel('mcp')).toBe('mcp');
    expect(typeManuel('fax')).toBeNull();
  });

  it('liste les connecteurs actifs sans doublon ni compte à reconnecter', () => {
    const actifs = actifsDepuis(
      [
        { _id: 'g1', platform: 'google', email: 'a@x.fr' },
        { _id: 'g2', platform: 'google', email: 'b@x.fr' },
        { _id: 'i1', platform: 'imap', email: 'c@ovh.fr', isActive: false },
        { _id: 'f1', platform: 'facebook', displayName: 'Page' },
        { _id: 'l1', platform: 'linkedin', needsReconnection: true },
      ],
      [{ type: 'google', infos: { adresse: 'a@x.fr' } }, { type: 'mcp', infos: { nom: 'ERP' } }, { type: 'app:pennylane' }],
    );
    expect(actifs.map((a) => `${a.type}:${a.detail}`)).toEqual(['google:a@x.fr', 'google:b@x.fr', 'facebook:Page', 'mcp:ERP', 'app:pennylane']);
  });

  it('offre un compte de chaque type inclus et facture le reste', () => {
    const r = facturer(
      [{ type: 'google', libelle: '', detail: '' }, { type: 'google', libelle: '', detail: '' }, { type: 'facebook', libelle: '', detail: '' },
        { type: 'imap', libelle: '', detail: '' }, { type: 'mcp', libelle: '', detail: '' }],
      { prix: 9.99, inclus: INCLUS_DEFAUT },
    );
    expect(r.lignes.map((l) => l.facture)).toEqual([false, true, false, true, true]);
    expect(r.nb_factures).toBe(3);
    expect(r.montant_ht).toBe(29.97);
  });
});

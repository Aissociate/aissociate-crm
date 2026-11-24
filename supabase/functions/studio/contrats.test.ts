import { describe, expect, it } from 'vitest';
import { articles, bulletin, CHOIX_STAGE, choixDepuisArticles, clePrix, droits, enTrop, normaliser, type Responsable } from './contrats';

describe('grille des contrats', () => {
  it('Temps plein CDD sans avenant : 149 € HT, expert et astreinte inclus', () => {
    const ch = normaliser({ contrat: 'plein', expert: true, astreinte: true });
    expect(ch.expert).toBe(false); // inclus au contrat : pas d'avenant facturé
    const b = bulletin(ch);
    expect(b.mensuel_ht).toBe(149);
    expect(b.lignes).toHaveLength(1);
    expect(droits(ch)).toMatchObject({ quota_messages_mois: 3033, connecteurs_max: 6, max_utilisateurs: 2, stockage_go: 25, expert: true, astreinte: true });
  });

  it('avenants et remise CDI lissée (2 mois offerts)', () => {
    const ch = normaliser({ contrat: 'partiel', cdi: true, heures: 2, badges: 1, expert: true });
    const b = bulletin(ch);
    expect(b.brut_ht).toBe(59 + 39.8 + 9.9 + 29.9);
    expect(b.remise_cdi_ht).toBe(23.1);
    expect(b.mensuel_ht).toBe(115.5);
    expect(b.annuel_ht).toBe(1386);
    expect(droits(ch)).toMatchObject({ heures: 115, quota_messages_mois: 2300, connecteurs_max: 4, expert: true });
  });

  it('Stage : gratuit, rien à payer chez Stripe', () => {
    expect(bulletin(CHOIX_STAGE).payant).toBe(false);
    expect(articles(CHOIX_STAGE)).toEqual([]);
    expect(droits(CHOIX_STAGE)).toMatchObject({ quota_messages_mois: 200, connecteurs_max: 0, max_utilisateurs: 1 });
  });

  it('bornes : quantités négatives ou absurdes ramenées', () => {
    expect(normaliser({ contrat: 'inconnu', heures: -3, badges: 999 })).toMatchObject({ contrat: 'stage', heures: 0, badges: 50 });
  });

  it('aller-retour Stripe : articles → choix', () => {
    const ch = normaliser({ contrat: 'equipe', cdi: true, responsables: 2, archives: 1 });
    const a = articles(ch);
    expect(a.find((x) => x.element === 'contrat_equipe')?.centimes).toBe(287000);
    const relu = choixDepuisArticles(a.map((x) => ({ lookup_key: clePrix(x.element, ch.cdi), quantite: x.quantite })));
    expect(relu).toEqual(ch);
    expect(choixDepuisArticles([{ lookup_key: 'studio_agents_v2', quantite: 2 }])).toBeNull();
    expect(choixDepuisArticles([{ lookup_key: 'studio_v3_contrat_plein_mois', quantite: 1 }])?.contrat).toBe('plein');
  });
});

describe('responsables en trop après un contrat inférieur', () => {
  const c = (id: string, role: string, jour: number, actif = true): Responsable =>
    ({ id, email: `${id}@x.re`, prenom: null, nom: null, role, actif, created_at: `2026-11-${String(jour).padStart(2, '0')}T00:00:00Z` });
  const equipe = [c('m2', 'membre', 5), c('p', 'proprietaire', 9), c('m1', 'membre', 3), c('m3', 'membre', 7)];

  it('garde le propriétaire puis les plus anciens, retire les plus récents', () => {
    expect(enTrop(equipe, 2)).toEqual(['m3', 'm2']);
    expect(enTrop(equipe, 1)).toEqual(['m3', 'm2', 'm1']);
  });
  it('rien à retirer sous la limite, comptes inactifs ignorés', () => {
    expect(enTrop(equipe, 4)).toEqual([]);
    expect(enTrop([...equipe, c('m4', 'membre', 10, false)], 4)).toEqual([]);
  });
  it('ne retire jamais le propriétaire, même avec une limite à 0', () => {
    expect(enTrop(equipe, 0)).not.toContain('p');
  });
});

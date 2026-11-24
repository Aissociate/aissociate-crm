// Packs métier : lecture tolérante d'une ligne de studio_packs_metier et place du bloc
// « Ton contexte métier » dans le prompt (entre les savoirs de l'agent et la fiche entreprise).
import { describe, expect, it } from 'vitest';
import { blocMetier, lirePack } from './metier';
import { construirePrompt, type AgentPrompt } from './contexte';

const ligne = {
  code: 'boulangerie', nom: 'Boulangerie-pâtisserie', version: 2,
  regles: [{ texte: 'Ne jamais affirmer « sans allergène » sans information.', source: 'Règlement (UE) n° 1169/2011' }, { texte: '' }, 'n’importe quoi'],
  relais: [{ situation: 'Malaise après consommation', consigne: 'Conseiller le 15 et transmettre.' }, { situation: 'sans consigne' }],
  fiche_type: [{ nom: 'horaires', libelle: "Horaires d'ouverture", requis: true }],
  vocabulaire: ['levain', '', 42, 'fournée'],
};

const agent: AgentPrompt = {
  id: 'ines', prenom: 'Inès', metier: 'chargée de communication', description: 'réseaux sociaux',
  prompt_systeme: '', consignes: '', super_pouvoirs: [], modele_effectif: null,
};

describe('lirePack', () => {
  it('garde les éléments valides et écarte le reste', () => {
    const p = lirePack(ligne)!;
    expect(p.version).toBe(2);
    expect(p.regles).toEqual([{ texte: 'Ne jamais affirmer « sans allergène » sans information.', source: 'Règlement (UE) n° 1169/2011' }]);
    expect(p.relais).toHaveLength(1);
    expect(p.vocabulaire).toEqual(['levain', 'fournée']);
  });

  it('renvoie null sans code ou sans contenu', () => {
    expect(lirePack(null)).toBeNull();
    expect(lirePack({ nom: 'x' })).toBeNull();
    expect(lirePack({ code: 'vide', regles: 'pas une liste' })).toBeNull();
  });
});

describe('blocMetier', () => {
  it('rend règles sourcées, relais, informations à connaître et documents', () => {
    const b = blocMetier(lirePack(ligne, [{ titre: 'Les 14 allergènes', source: 'INCO', extrait: 'gluten, lait…' }]));
    expect(b).toContain('## Ton contexte métier : Boulangerie-pâtisserie (référence Aissociate, version 2)');
    expect(b).toContain('(source : Règlement (UE) n° 1169/2011)');
    expect(b).toContain('- Malaise après consommation : Conseiller le 15 et transmettre.');
    expect(b).toContain("- Horaires d'ouverture");
    expect(b).toContain('levain, fournée.');
    expect(b).toContain('#### [M1] Les 14 allergènes — référence : INCO');
  });

  it('est vide sans pack', () => {
    expect(blocMetier(null)).toBe('');
  });
});

describe('construirePrompt avec un pack', () => {
  const base = { agent, equipe: [agent], ws: { nom: 'Les Délices', contexte_entreprise: 'Boulangerie à Saint-Pierre.' }, ressources: [] };

  it('place le contexte métier après les savoirs et avant la fiche entreprise', () => {
    const p = construirePrompt({ ...base, savoirs: [{ titre: 'SEO local', source: 'guide', extrait: '…' }], pack: lirePack(ligne) });
    const savoirs = p.indexOf('## Ta base de connaissances');
    const metier = p.indexOf('## Ton contexte métier');
    const fiche = p.indexOf('## Entreprise cliente');
    expect(savoirs).toBeGreaterThan(-1);
    expect(metier).toBeGreaterThan(savoirs);
    expect(fiche).toBeGreaterThan(metier);
  });

  it("ne change rien à un espace sans pack", () => {
    expect(construirePrompt({ ...base, pack: null })).toBe(construirePrompt(base));
    expect(construirePrompt(base)).not.toContain('Ton contexte métier');
  });
});

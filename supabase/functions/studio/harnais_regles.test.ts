// Harnais généré par l'IA : contrôle de la réponse du modèle avant enregistrement.
import { describe, expect, it } from 'vitest';
import { codeHarnais, consigneGeneration, demandeGeneration, nettoyerHarnais, SOURCE_PRUDENTE } from './harnais_regles';
import { blocMetier, lirePack } from './metier';

const reponse = {
  nom: 'Courtage en assurance',
  codes_naf: ['66.22Z', 'pas un code'],
  regles: [
    { texte: 'Ne jamais annoncer un tarif ou une garantie engageante.', source: 'Code des assurances' },
    { texte: 'Rappeler le devoir de conseil avant toute recommandation.' },
    { texte: 'Toute réclamation suit la procédure écrite du cabinet.', source: SOURCE_PRUDENTE },
    { texte: '' },
  ],
  relais: [{ situation: 'Déclaration de sinistre', consigne: 'Recueillir les faits et transmettre au conseiller.' }],
  fiche_type: [{ libelle: 'Numéro ORIAS', requis: true }, { nom: 'Compagnies partenaires', libelle: 'Compagnies partenaires' }],
  vocabulaire: ['franchise', 'souscripteur'],
  savoirs: [{ titre: 'Trop court', contenu: 'x' }, { titre: 'Le devoir de conseil', source: 'Directive (UE) 2016/97', contenu: 'a'.repeat(300) }],
  cadres: [
    { agent_id: 'ines', cadre: 'Publications pédagogiques, jamais de promesse de prix.' },
    { agent_id: 'ines', cadre: 'doublon' },
    { agent_id: 'inconnu', cadre: 'agent absent de l’équipe' },
  ],
  evaluation: [{ question: 'Combien coûte une assurance habitation ?', attendus: ['propose un devis'], interdits: ['un chiffre'] }],
};

describe('nettoyerHarnais', () => {
  it('garde ce qui est valide, complète les sources et écarte le reste', () => {
    const h = nettoyerHarnais(reponse, ['ines', 'mael']);
    expect(h.codes_naf).toEqual(['66.22Z']);
    expect(h.regles).toHaveLength(3);
    expect(h.regles[1].source).toBe(SOURCE_PRUDENTE);
    expect(h.fiche_type.map((c) => c.nom)).toEqual(['numero_orias', 'compagnies_partenaires']);
    expect(h.savoirs.map((s) => s.titre)).toEqual(['Le devoir de conseil']);
    expect(h.cadres).toEqual([{ agent_id: 'ines', cadre: 'Publications pédagogiques, jamais de promesse de prix.' }]);
  });

  it('refuse un harnais inutilisable', () => {
    expect(() => nettoyerHarnais(null, ['ines'])).toThrow(/sans nom/);
    expect(() => nettoyerHarnais({ ...reponse, regles: reponse.regles.slice(0, 1) }, ['ines'])).toThrow(/trop pauvre/);
    expect(() => nettoyerHarnais({ ...reponse, cadres: [] }, ['ines'])).toThrow(/aucun cadre/);
  });

  it('produit un pack lisible par le prompt, avec le cadre du bon agent seulement', () => {
    const h = nettoyerHarnais(reponse, ['ines', 'mael']);
    const pack = lirePack({ code: codeHarnais('abc'), version: 1, ...h })!;
    expect(pack.code).toBe('ws-abc');
    expect(blocMetier(pack, 'ines')).toContain("### Ton cadre d'exercice chez ce client\nPublications pédagogiques");
    expect(blocMetier(pack, 'mael')).not.toContain("Ton cadre d'exercice");
  });
});

describe('consignes', () => {
  it('liste chaque agent avec son id exact et exige le JSON', () => {
    const d = demandeGeneration({ entreprise: 'Cabinet X', secteur: 'courtier en assurance', fiche: '', agents: [
      { id: 'ines', prenom: 'Inès', metier: 'communication', description: 'réseaux sociaux', missions: ['Publication'] },
    ] });
    expect(d).toContain('id « ines »');
    expect(d).toContain('(vide)');
    expect(consigneGeneration()).toContain('UNIQUEMENT par un objet JSON');
  });
});

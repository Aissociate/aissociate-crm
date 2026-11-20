import { describe, expect, it } from 'vitest';
import { compteActives, dateCourte, etatRoutine, sousTitre, surtitre, titrePanneau, valeurCompteur, type EtapeVue, type Routine } from './routinesVue';

// Lundi 23 novembre 2026, 10 h à La Réunion.
const maintenant = new Date('2026-11-23T10:00:00+04:00');
const base: Routine = {
  id: 'r1', titre: 'Relancer les factures impayées', agent_id: 'theo', actif: true, modele: 'impayes', reglages: {},
  heures: [8], jours: [1], planning: 'Le lundi à 8 h', prochaine_execution: '2026-11-30T08:00:00+04:00', derniere_execution: null,
  cree_le: '2026-11-03T09:00:00+04:00', essai_jusqu_au: null, essai_termine: false, en_cours: false,
  etapes: [], en_clair: '', historique: [], bilan: "n'a pas encore tourné", consigne_origine: null, conversation_id: null,
};
const prenom = (id: string) => ({ theo: 'Théo' } as Record<string, string>)[id] ?? id;
const etape = (x: Partial<EtapeVue>): EtapeVue => ({ id: 'e0', type: 'agent', agent: 'theo', texte: '', puces: [], verrouillee: false, reglages: [], ...x });

describe('routines — présentation', () => {
  it("dit l'état utile, dans l'ordre : en cours, essai terminé, pause, essai, prochain passage", () => {
    expect(etatRoutine({ ...base, en_cours: true }, maintenant).texte).toBe('En cours…');
    expect(etatRoutine({ ...base, essai_jusqu_au: '2026-11-20T08:00:00+04:00', essai_termine: true }, maintenant).ton).toBe('attente');
    expect(etatRoutine({ ...base, actif: false }, maintenant).texte).toBe('En pause');
    expect(etatRoutine({ ...base, essai_jusqu_au: '2026-11-25T08:00:00+04:00' }, maintenant).texte).toBe("À l'essai jusqu'à mercredi : rien n'est envoyé");
    expect(etatRoutine(base, maintenant).texte).toBe('Prochain passage le 30 novembre à 8 h');
  });
  it('en-tête et dates courtes', () => {
    expect(sousTitre({ cree_le: base.cree_le, bilan: 'a tourné 3 fois, sans erreur bloquante' })).toBe('Mise en place le 3 novembre · a tourné 3 fois, sans erreur bloquante');
    expect(dateCourte('2026-11-23T08:00:00+04:00')).toBe('Lun. 23 nov.');
  });
  it('surtitres et titres du panneau', () => {
    expect(surtitre(etape({ type: 'depart', agent: null }), 0, prenom)).toBe('Départ');
    expect(surtitre(etape({}), 1, prenom)).toBe('Étape 1 · Théo');
    expect(surtitre(etape({ type: 'validation', agent: null, verrouillee: true }), 3, prenom)).toBe('Étape 3 · Vous · obligatoire');
    expect(titrePanneau(etape({ type: 'validation', verrouillee: true }), prenom)).toBe('Votre feu vert avant tout envoi');
    expect(titrePanneau(etape({}), prenom)).toBe('Ce que fait Théo');
  });
  it('compte les routines actives (ni à l’essai, ni en pause) et accorde les unités', () => {
    expect(compteActives([base, { ...base, actif: false }, { ...base, essai_jusqu_au: '2026-11-25T08:00:00+04:00' }])).toBe('Routines · 1 active');
    expect(compteActives([base, base])).toBe('Routines · 2 actives');
    const c = { id: 'jours', type: 'compteur' as const, etape: 0, libelle: '', min: 1, max: 4, pas: 1, unite: 'publications', defaut: 2 };
    expect(valeurCompteur(c, 1)).toBe('1 publication');
    expect(valeurCompteur(c, undefined)).toBe('2 publications');
  });
});

import { describe, expect, it } from 'vitest';
import {
  consigne, consigneMission, definition, definitionMission, estOrchestrateur, MAX_MISSIONS, MAX_PAR_COLLEGUE, mentionAide,
  nbFactures, nettoyer, NOM_MISSION, NOM_OUTIL, ORCHESTRATEUR, perimetreOrchestrateur, refusMission,
} from './equipe';

const C = [{ id: 'seo', prenom: 'Léa', metier: 'Référencement' }, { id: 'compta', prenom: 'Marc', metier: 'Comptabilité' }];

describe('missions d\'équipe', () => {
  it('limite la consultation aux collègues ouverts dans l\'espace', () => {
    const d = definition(C);
    expect(d.function.name).toBe(NOM_OUTIL);
    expect((d.function.parameters.properties as Record<string, { enum?: string[] }>).agent_id.enum).toEqual(['seo', 'compta']);
    expect(consigne(C)).toContain('Léa (Référencement) — id seo');
  });
  it('retire la balise de relais de la réponse du collègue', () => {
    expect(nettoyer('Voici les mots-clés.\n[[RELAIS:compta]]')).toBe('Voici les mots-clés.');
  });
  it('mentionne les collègues consultés, sans doublon', () => {
    expect(mentionAide([])).toBe('');
    expect(mentionAide(['Léa (SEO)', 'Léa (SEO)'])).toBe("_Avec l'aide de Léa (SEO)._");
    expect(mentionAide(['Léa (SEO)', 'Marc (Compta)', 'Zoé (RH)'])).toBe("_Avec l'aide de Léa (SEO), Marc (Compta) et Zoé (RH)._");
  });
});

describe('orchestration par Léa', () => {
  it('ne facture pas l\'orchestratrice', () => {
    expect(estOrchestrateur(ORCHESTRATEUR)).toBe(true);
    expect(nbFactures([{ id: 'lea' }, { id: 'hugo' }, { id: 'theo' }])).toBe(2);
    expect(nbFactures([{ id: 'lea' }])).toBe(0);
  });
  it('ne confie une mission qu\'aux spécialistes ouverts', () => {
    const d = definitionMission(C);
    expect(d.function.name).toBe(NOM_MISSION);
    expect((d.function.parameters.properties as Record<string, { enum?: string[] }>).agent_id.enum).toEqual(['seo', 'compta']);
    const p = perimetreOrchestrateur(C);
    expect(p).toContain('Marc (Comptabilité) — id compta');
    expect(p).toContain(NOM_MISSION);
  });
  it('sans spécialiste, Léa traite seule et ne parle pas de mission', () => {
    expect(perimetreOrchestrateur([])).not.toContain(NOM_MISSION);
  });
  it('borne les allers-retours', () => {
    expect(refusMission(0, 0)).toBeNull();
    expect(refusMission(MAX_MISSIONS - 1, MAX_PAR_COLLEGUE - 1)).toBeNull();
    expect(refusMission(MAX_MISSIONS, 0)).toContain('Limite');
    expect(refusMission(1, MAX_PAR_COLLEGUE)).toContain('déjà été sollicité');
  });
  it('le spécialiste rend son travail à Léa, sans relais ni question', () => {
    const c = consigneMission({ prenom: 'Léa' });
    expect(c).toContain('Mission confiée par Léa');
    expect(c).toContain('Points à confirmer');
  });
});

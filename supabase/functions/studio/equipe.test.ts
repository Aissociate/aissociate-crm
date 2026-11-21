import { describe, expect, it } from 'vitest';
import {
  consigne, consigneMission, definition, definitionMission, estOrchestrateur, MAX_MISSIONS, MAX_PAR_COLLEGUE, mentionAide,
  nbFactures, nettoyer, NOM_MISSION, NOM_OUTIL, ORCHESTRATEUR, perimetreOrchestrateur, PLAFOND_MISSION, refusMission,
  relancerSansRaisonnement, valeursMission,
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
  it('relance sans raisonnement, une seule fois, quand le plafond a été consommé sans texte', () => {
    expect(relancerSansRaisonnement('length', false)).toBe(true);
    expect(relancerSansRaisonnement('length', true)).toBe(false);
    expect(relancerSansRaisonnement('stop', false)).toBe(false);
    expect(PLAFOND_MISSION).toBeGreaterThan(8000);
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

describe('Léa active les super-pouvoirs des spécialistes', () => {
  const VISUEL = {
    id: 'visuel_ia', titre: 'Créer un visuel', media: 'image' as const,
    champs: [
      { nom: 'sujet', label: 'Sujet', type: 'long' as const, requis: true },
      { nom: 'format', label: 'Format', type: 'choix' as const, requis: true, options: ['1:1', '4:5'] },
      { nom: 'style', label: 'Style', type: 'choix' as const, options: ['Photo réaliste'] },
    ],
  };
  it('propose pouvoir et valeurs, la consigne seule n\'étant plus requise', () => {
    const p = definitionMission(C).function.parameters as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(p.properties)).toEqual(expect.arrayContaining(['pouvoir', 'valeurs']));
    expect(p.required).toEqual(['agent_id']);
  });
  it('liste les super-pouvoirs de chaque spécialiste dans son rôle', () => {
    const t = perimetreOrchestrateur([{ id: 'hugo', prenom: 'Hugo', metier: 'Marketing', pouvoirs: [VISUEL] }]);
    expect(t).toContain('Super-pouvoirs : visuel_ia (Créer un visuel, visuel créé directement');
    expect(t).toContain('active-le avec confier_mission');
  });
  it('complète les champs requis : la consigne pour le texte, la première option pour un choix', () => {
    expect(valeursMission(VISUEL, { style: 'Photo réaliste' }, 'Une boulangerie au lever du jour'))
      .toEqual({ style: 'Photo réaliste', sujet: 'Une boulangerie au lever du jour', format: '1:1' });
    expect(valeursMission(VISUEL, { sujet: 'Vitrine', format: '4:5' }, 'ignorée')).toEqual({ sujet: 'Vitrine', format: '4:5' });
    expect(valeursMission(VISUEL, 'pas un objet', '')).toEqual({ format: '1:1' });
  });
});

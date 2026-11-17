import { describe, expect, it } from 'vitest';
import { consigne, definition, mentionAide, nettoyer, NOM_OUTIL } from './equipe';

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

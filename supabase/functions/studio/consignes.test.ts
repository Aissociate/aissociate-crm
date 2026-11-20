import { describe, expect, it } from 'vitest';
import { estConsigne, libellePrise, pourAgent, pourSpecialiste, PREFIXE, texteConsigne } from './consignes';

describe('consignes en cours de route', () => {
  it('reconnaît un message-consigne et en extrait le texte', () => {
    expect(estConsigne(`${PREFIXE}Ton plus direct`)).toBe(true);
    expect(texteConsigne(`${PREFIXE}  Ton plus direct `)).toBe('Ton plus direct');
    expect(texteConsigne('Rédige les posts du jour')).toBe('');
  });
  it("formule la consigne pour l'agent et pour le spécialiste", () => {
    expect(pourAgent('pas de hashtags')).toContain('pas de hashtags');
    expect(pourSpecialiste('pas de hashtags', 'Léa')).toContain('transmise par Léa');
  });
  it("libelle l'étape ; le libellé du spécialiste garde son prénom en tête", () => {
    expect(libellePrise(1)).toBe('Consigne prise en compte');
    expect(libellePrise(2, 'Hugo')).toBe('Hugo : 2 consignes prises en compte');
  });
});

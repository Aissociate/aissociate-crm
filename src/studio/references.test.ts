import { describe, expect, it } from 'vitest';
import { decouperReferences, refDe, trouverParRef } from './references';

describe('références de documents dans le chat', () => {
  it('calcule la même référence que le serveur', () => {
    expect(refDe('88e7c4db-dfeb-4dc7-9d5b-d3b24ba113a9')).toBe('L-88e7c4db');
  });
  it('isole chaque référence dans le texte, sans toucher au reste', () => {
    expect(decouperReferences('Les 12 textes sont prêts : document L-88e7c4db (à droite).')).toEqual([
      'Les 12 textes sont prêts : document ', { ref: 'L-88e7c4db' }, ' (à droite).',
    ]);
    expect(decouperReferences('L-1A2B3C4D et L-99aa00bb')).toEqual([{ ref: 'L-1a2b3c4d' }, ' et ', { ref: 'L-99aa00bb' }]);
    expect(decouperReferences('Aucune ici, ni XL-12345678, ni L-123.')).toEqual(['Aucune ici, ni XL-12345678, ni L-123.']);
  });
  it('retrouve le livrable désigné', () => {
    const liste = [{ id: '11111111-0000-0000-0000-000000000000' }, { id: '88e7c4db-dfeb-4dc7-9d5b-d3b24ba113a9' }];
    expect(trouverParRef(liste, 'L-88E7C4DB')?.id).toBe(liste[1].id);
    expect(trouverParRef(liste, 'L-00000000')).toBeUndefined();
  });
});

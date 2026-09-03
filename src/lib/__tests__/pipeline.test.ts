import { describe, it, expect } from 'vitest';
import { cleDepuisLibelle, COLONNES_DEFAUT } from '@/lib/pipeline';

describe('cleDepuisLibelle', () => {
  it('normalise accents et caractères spéciaux', () => {
    expect(cleDepuisLibelle('Relance N+1', [])).toBe('relance-n-1');
    expect(cleDepuisLibelle('Négociation', [])).toBe('negociation');
  });
  it('suffixe en cas de collision', () => {
    expect(cleDepuisLibelle('Qualifié', ['qualifie'])).toBe('qualifie-2');
    expect(cleDepuisLibelle('Qualifié', ['qualifie', 'qualifie-2'])).toBe('qualifie-3');
  });
  it('libellé vide → « colonne »', () => {
    expect(cleDepuisLibelle('!!!', [])).toBe('colonne');
  });
});

describe('COLONNES_DEFAUT', () => {
  it('contient les colonnes système nouveau / gagne / perdu', () => {
    const systemes = COLONNES_DEFAUT.filter((c) => c.systeme).map((c) => c.cle);
    expect(systemes).toEqual(['nouveau', 'gagne', 'perdu']);
  });
});

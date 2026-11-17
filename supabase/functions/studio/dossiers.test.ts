import { describe, expect, it } from 'vitest';
import { arbreTexte, cheminDe, descendants, segments, trouver, type Dossier } from './dossiers';

const D: Dossier[] = [
  { id: 'c', parent_id: null, nom: 'Clients' },
  { id: 'd', parent_id: 'c', nom: 'Dupont' },
  { id: 'm', parent_id: 'c', nom: 'Martin' },
  { id: 'k', parent_id: null, nom: 'Marketing' },
  { id: 'j', parent_id: 'k', nom: 'Janvier' },
];

describe('dossiers', () => {
  it('découpe et nettoie un chemin', () => {
    expect(segments(' /Clients//  Dupont  SARL / ')).toEqual(['Clients', 'Dupont SARL']);
    expect(segments('')).toEqual([]);
    expect(segments('a/b/c/d/e/f')).toBeNull();
    expect(segments('x'.repeat(81))).toBeNull();
  });
  it('donne le chemin complet et retrouve un dossier sans tenir compte de la casse', () => {
    expect(cheminDe(D, 'd')).toBe('Clients/Dupont');
    expect(cheminDe(D, null)).toBe('');
    expect(trouver(D, ['clients', 'DUPONT'])?.id).toBe('d');
    expect(trouver(D, ['Clients', 'Durand'])).toBeNull();
  });
  it('liste les descendants et l\'arborescence avec les nombres', () => {
    expect(descendants(D, 'c').sort()).toEqual(['c', 'd', 'm']);
    expect(arbreTexte(D, new Map([['d', 3]]))).toEqual(['Clients', 'Clients/Dupont (3)', 'Clients/Martin', 'Marketing', 'Marketing/Janvier']);
  });
});

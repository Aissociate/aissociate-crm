import { describe, expect, it } from 'vitest';
import { collegueAuTravail } from './travail';

const P = ['Léa', 'Hugo', 'Théo'];

describe('collègue au travail', () => {
  it('reconnaît un collègue sollicité tant que sa mission est en cours', () => {
    expect(collegueAuTravail(['Recherche web', 'Hugo (Marketing & réseaux sociaux) travaille…'], P)).toBe('Hugo');
    expect(collegueAuTravail(['Hugo : Recherche web : IA Réunion'], P)).toBe('Hugo');
    expect(collegueAuTravail(['Théo est consulté…'], P)).toBe('Théo');
    expect(collegueAuTravail(['Hugo reprend son travail…'], P)).toBe('Hugo');
  });
  it("s'arrête dès que le collègue a rendu son travail ou échoué", () => {
    expect(collegueAuTravail(['Hugo (Marketing) travaille…', 'Hugo a rendu son travail, Léa relit'], P)).toBeNull();
    expect(collegueAuTravail(['Hugo (Marketing) travaille…', "Hugo n'a pas pu répondre"], P)).toBeNull();
    expect(collegueAuTravail(['Recherche web'], P)).toBeNull();
    expect(collegueAuTravail(undefined, P)).toBeNull();
  });
});

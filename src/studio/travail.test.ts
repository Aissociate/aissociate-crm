import { describe, expect, it } from 'vitest';
import { collegueAuTravail, estConsigne, PREFIXE_CONSIGNE } from './travail';
import { PREFIXE } from '../../supabase/functions/studio/consignes';

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
  it('garde le collègue au travail quand il reçoit une consigne, et partage le préfixe avec le serveur', () => {
    expect(collegueAuTravail(['Hugo (Marketing) travaille…', 'Hugo : Consigne prise en compte'], P)).toBe('Hugo');
    expect(PREFIXE_CONSIGNE).toBe(PREFIXE);
    expect(estConsigne(`${PREFIXE_CONSIGNE}Plus court`)).toBe(true);
  });
});

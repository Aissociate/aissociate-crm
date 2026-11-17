// Tests du mapping action → libellé du journal d'audit Studio.
import { describe, expect, it } from 'vitest';
import { libelleAction } from './journal';

describe('libelleAction', () => {
  it('retourne le libellé officiel pour une action connue', () => {
    expect(libelleAction('mission')).toBe('Mission traitée');
    expect(libelleAction('livrable_valide')).toBe('Livrable validé');
    expect(libelleAction('drive_recherche')).toBe('Recherche dans le Google Drive');
    expect(libelleAction('mail_quarantaine')).toBe('E-mail bloqué (quarantaine)');
  });
  it('se replie sur la chaîne, _ remplacé par espace, pour une action inconnue', () => {
    expect(libelleAction('foo_bar_baz')).toBe('foo bar baz');
    expect(libelleAction('inconnu')).toBe('inconnu');
  });
  it('ne mute pas les actions connues', () => {
    // garde-fou contre un refactor qui passerait par la branche fallback
    expect(libelleAction('espace_cree')).toBe('Espace créé');
    expect(libelleAction('connecteur_enregistre')).toBe('Connecteur enregistré');
  });
});

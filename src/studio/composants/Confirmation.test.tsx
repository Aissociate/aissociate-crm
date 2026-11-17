// Tests « smoke » de Confirmation. On ne peut pas exécuter le composant hors d'un
// renderer React (useEffect/useRef/useId), et jsdom + testing-library ne sont pas
// installés — donc on se limite à : l'import fonctionne, la fonction est bien
// exportée par défaut, et un élément React est créable sans planter.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import Confirmation from './Confirmation';

describe('Confirmation (smoke)', () => {
  it('est exportée en défaut comme fonction', () => {
    expect(typeof Confirmation).toBe('function');
  });

  it('a le nom attendu', () => {
    expect(Confirmation.name).toBe('Confirmation');
  });

  it('createElement produit un élément React valide avec des props cohérentes', () => {
    const el = createElement(Confirmation, {
      ouvert: false,
      titre: 'Supprimer ?',
      message: 'Action irréversible.',
      confirmer: { label: 'Supprimer', onClick: () => {}, danger: true },
      annuler: { onClick: () => {} },
    });
    expect(el.type).toBe(Confirmation);
    expect((el.props as { ouvert: boolean }).ouvert).toBe(false);
    expect((el.props as { confirmer: { danger: boolean } }).confirmer.danger).toBe(true);
  });
});

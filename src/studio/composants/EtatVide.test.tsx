// Tests « légers » d'EtatVide. Vitest tourne en environnement Node (pas de jsdom
// ni @testing-library/react), donc on inspecte l'arbre React brut rendu par la
// fonction, sans monter dans un DOM.
import { describe, expect, it } from 'vitest';
import EtatVide from './EtatVide';

type Noeud = { type: unknown; props: Record<string, unknown> };
function* parcourir(n: unknown): Generator<Noeud> {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) { for (const x of n) yield* parcourir(x); return; }
  const noeud = n as Noeud;
  if ('type' in noeud && 'props' in noeud) {
    yield noeud;
    yield* parcourir((noeud.props as { children?: unknown }).children);
  }
}
const trouver = (n: unknown, pred: (x: Noeud) => boolean) => [...parcourir(n)].find(pred);

describe('EtatVide', () => {
  it('rend un conteneur avec role="status"', () => {
    const el = EtatVide({ titre: 'Rien pour l\'instant' });
    const racine = el as unknown as Noeud;
    expect(racine.props.role).toBe('status');
  });

  it('rend le titre dans un h3 et la description dans un p', () => {
    const el = EtatVide({ titre: 'Rien', description: 'Importez un fichier pour commencer.' });
    const h3 = trouver(el, (x) => x.type === 'h3');
    const p = trouver(el, (x) => x.type === 'p');
    expect(h3?.props.children).toBe('Rien');
    expect(p?.props.children).toBe('Importez un fichier pour commencer.');
  });

  it('n\'inclut pas le bloc action quand action est absent', () => {
    const el = EtatVide({ titre: 'x' });
    // Bouton est une fonction importée — on cherche n'importe quel type de fonction
    const boutons = [...parcourir(el)].filter((x) => typeof x.type === 'function');
    expect(boutons).toHaveLength(0);
  });

  it('inclut un bouton quand action est fourni', () => {
    const el = EtatVide({ titre: 'x', action: { label: 'Importer', onClick: () => {} } });
    const bouton = [...parcourir(el)].find((x) => typeof x.type === 'function');
    expect(bouton).toBeDefined();
    expect((bouton?.props as { children?: unknown }).children).toBe('Importer');
  });

  it('propage une classe supplémentaire sur le conteneur', () => {
    const el = EtatVide({ titre: 'x', className: 'mb-10' });
    const racine = el as unknown as Noeud;
    expect(String(racine.props.className)).toContain('mb-10');
  });
});

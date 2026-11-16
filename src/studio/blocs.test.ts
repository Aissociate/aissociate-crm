import { describe, expect, it } from 'vitest';
import { cellules, decouper, serialiser, tableauEnMarkdown } from './blocs';

const md = `# Devis

Voici le détail :

| Poste | Qté | Prix |
|---|:---:|---:|
| Mise en place | 1 | 499 € |
| Abonnement \\| mensuel | 12 | 99 € |

Total à confirmer.`;

describe('blocs', () => {
  it('lit les cellules, y compris un | échappé', () => {
    expect(cellules('| a | b \\| c | d |')).toEqual(['a', 'b | c', 'd']);
  });
  it('sépare texte et tableaux', () => {
    const b = decouper(md);
    expect(b.map((x) => x.type)).toEqual(['texte', 'tableau', 'texte']);
    const t = b[1];
    if (t.type !== 'tableau') throw new Error();
    expect(t.entetes).toEqual(['Poste', 'Qté', 'Prix']);
    expect(t.alignements).toEqual(['', 'centre', 'droite']);
    expect(t.lignes[1]).toEqual(['Abonnement | mensuel', '12', '99 €']);
  });
  it('fait un aller-retour fidèle', () => {
    expect(decouper(serialiser(decouper(md)))).toEqual(decouper(md));
    expect(serialiser(decouper(md))).toContain('| Abonnement \\| mensuel | 12 | 99 € |');
    expect(serialiser(decouper(md))).toContain('Voici le détail :\n\n| Poste');
  });
  it('complète les lignes courtes et garde un texte sans tableau intact', () => {
    const b = decouper('| a | b |\n|---|---|\n| 1 |');
    expect(b[0].type === 'tableau' && b[0].lignes[0]).toEqual(['1', '']);
    expect(serialiser(decouper('Bonjour\n\nÀ bientôt'))).toBe('Bonjour\n\nÀ bientôt');
    expect(tableauEnMarkdown({ type: 'tableau', entetes: ['x'], lignes: [['a\nb']], alignements: [''] })).toBe('| x |\n| --- |\n| a b |');
  });
});

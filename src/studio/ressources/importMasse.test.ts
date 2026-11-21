import { describe, expect, it } from 'vitest';
import { IMPORT_MAX, parPaquets, phraseBilan, trierFichiers } from './importMasse';

const f = (nom: string, taille = 10) => new File(['x'.repeat(taille)], nom);

describe('import en masse des ressources', () => {
  it('écarte les fichiers système, les formats inconnus et les doublons', () => {
    const tri = trierFichiers(
      [f('offre.pdf'), f('.DS_Store'), f('~$brouillon.docx'), f('photo.heic'), f('tarifs.xlsx', 20), f('offre.pdf'), f('charte.docx')],
      [{ titre: 'tarifs.xlsx', taille: 20 }],
    );
    expect(tri.aLire.map((x) => x.name)).toEqual(['offre.pdf', 'charte.docx']);
    expect(tri.refuses).toEqual(['photo.heic']);
    expect(tri.doublons).toEqual(['tarifs.xlsx', 'offre.pdf']);
  });

  it(`n'en lit que ${IMPORT_MAX} à la fois et compte le reste`, () => {
    const tri = trierFichiers(Array.from({ length: IMPORT_MAX + 3 }, (_, i) => f(`doc-${i}.txt`)), []);
    expect(tri.aLire).toHaveLength(IMPORT_MAX);
    expect(tri.enTrop).toBe(3);
  });

  it('dit le bilan en une phrase', () => {
    expect(phraseBilan({ importes: 24, sensibles: ['rib.pdf — RIB'], echecs: ['gros.pdf — trop volumineux'], refuses: [], doublons: ['a.pdf', 'b.pdf'], enTrop: 0 }))
      .toBe('24 fichiers importés · 1 sensible, rangé désactivé · 2 déjà présents, ignorés · 1 en échec.');
    expect(phraseBilan({ importes: 1, sensibles: [], echecs: [], refuses: [], doublons: [], enTrop: 0 })).toBe('1 fichier importé.');
  });

  it('traite chaque élément une fois, sans dépasser le parallélisme', async () => {
    let enCours = 0, pic = 0;
    const vus: number[] = [];
    await parPaquets([1, 2, 3, 4, 5], 2, async (x) => {
      enCours++; pic = Math.max(pic, enCours);
      await new Promise((r) => setTimeout(r, 5));
      vus.push(x); enCours--;
    });
    expect(vus.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(pic).toBe(2);
  });
});

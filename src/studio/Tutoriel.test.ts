import { describe, expect, it } from 'vitest';
import { ETAPES_TUTORIEL, placerCarte } from './Tutoriel';

describe('guide de prise en main', () => {
  it('commence et finit par une étape sans surprise', () => {
    expect(ETAPES_TUTORIEL[0].cible).toBeUndefined();
    expect(ETAPES_TUTORIEL[ETAPES_TUTORIEL.length - 1].cible).toBe('guide');
    expect(new Set(ETAPES_TUTORIEL.map((e) => e.titre)).size).toBe(ETAPES_TUTORIEL.length);
  });
  it('place la carte à droite de la cible, sinon dessous, sinon dessus, sans sortir de l\'écran', () => {
    expect(placerCarte(null, 1200, 800)).toBeNull();
    // Lien du menu (colonne de gauche) sur grand écran : carte à droite.
    expect(placerCarte({ top: 100, left: 16, width: 200, height: 36 }, 1200, 800)).toEqual({ left: 232, top: 100 });
    // Zone large : pas de place à droite, carte dessous.
    expect(placerCarte({ top: 100, left: 300, width: 800, height: 120 }, 1200, 800)).toEqual({ left: 300, top: 232 });
    // Cible en bas d'un petit écran : carte au-dessus, dans l'écran.
    const p = placerCarte({ top: 700, left: 10, width: 350, height: 60 }, 375, 800)!;
    expect(p.top).toBeLessThan(700);
    expect(p.left).toBeGreaterThanOrEqual(12);
    expect(p.left + 340).toBeLessThanOrEqual(375 + 12);
  });
});

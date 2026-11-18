import { describe, expect, it, vi } from 'vitest';
import { estErreurDeVersion, rechargerUneFois } from '../versionPerimee';

function memoire(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}

describe('estErreurDeVersion', () => {
  it('reconnaît les messages des trois navigateurs', () => {
    expect(estErreurDeVersion(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Login-D6_AIqt1.js'))).toBe(true);
    expect(estErreurDeVersion(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(estErreurDeVersion(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(estErreurDeVersion(new Error('Unable to preload CSS for /assets/Dashboard-abc.css'))).toBe(true);
  });

  it('ignore les autres erreurs', () => {
    expect(estErreurDeVersion(new Error("Cannot read properties of undefined (reading 'nom')"))).toBe(false);
    expect(estErreurDeVersion(new TypeError('Failed to fetch'))).toBe(false);
    expect(estErreurDeVersion(null)).toBe(false);
    expect(estErreurDeVersion('texte quelconque')).toBe(false);
  });
});

describe('rechargerUneFois', () => {
  it('recharge la première fois', () => {
    const recharger = vi.fn();
    expect(rechargerUneFois(memoire(), recharger, 1_000_000)).toBe(true);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('ne recharge pas deux fois dans la même minute (pas de boucle)', () => {
    const stockage = memoire();
    const recharger = vi.fn();
    rechargerUneFois(stockage, recharger, 1_000_000);
    expect(rechargerUneFois(stockage, recharger, 1_030_000)).toBe(false);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('recharge de nouveau après une minute (déploiement suivant)', () => {
    const stockage = memoire();
    const recharger = vi.fn();
    rechargerUneFois(stockage, recharger, 1_000_000);
    expect(rechargerUneFois(stockage, recharger, 1_061_000)).toBe(true);
    expect(recharger).toHaveBeenCalledTimes(2);
  });

  it('ne recharge pas sans stockage de session', () => {
    const recharger = vi.fn();
    expect(rechargerUneFois(null, recharger)).toBe(false);
    const casse = { getItem: () => { throw new Error('interdit'); }, setItem: () => {} };
    expect(rechargerUneFois(casse, recharger)).toBe(false);
    expect(recharger).not.toHaveBeenCalled();
  });
});

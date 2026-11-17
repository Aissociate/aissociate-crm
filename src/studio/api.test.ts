// Tests de la logique pure exportée par api.ts : gestion du jeton,
// formatage des minutes, extraction de la balise de relais entre agents.
// On ne teste PAS `appel` / `discuter` (I/O réseau).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extraireRelais, jeton, minutesEnTexte, SessionExpiree } from './api';

// Stub de localStorage pour l'environnement node par défaut de Vitest.
function stubStockage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  vi.stubGlobal('localStorage', ls);
  return ls;
}

describe('minutesEnTexte', () => {
  it('rend les minutes seules sous 60 min', () => {
    expect(minutesEnTexte(0)).toBe('0 min');
    expect(minutesEnTexte(1)).toBe('1 min');
    expect(minutesEnTexte(59)).toBe('59 min');
  });
  it('rend les heures pleines sans minutes', () => {
    expect(minutesEnTexte(60)).toBe('1 h');
    expect(minutesEnTexte(120)).toBe('2 h');
  });
  it('rend heures + minutes paddées sur 2 chiffres', () => {
    expect(minutesEnTexte(65)).toBe('1 h 05');
    expect(minutesEnTexte(90)).toBe('1 h 30');
    expect(minutesEnTexte(125)).toBe('2 h 05');
  });
});

describe('extraireRelais', () => {
  it('retourne null et texte intact sans balise', () => {
    const r = extraireRelais('Bonjour, voici ma réponse.');
    expect(r.relais).toBeNull();
    expect(r.texte).toBe('Bonjour, voici ma réponse.');
  });
  it('détecte la balise complète et retire la balise du texte', () => {
    const r = extraireRelais('Cette demande relève de Zoé.[[RELAIS:zoe-marketing_01]]');
    expect(r.relais).toBe('zoe-marketing_01');
    expect(r.texte).toBe('Cette demande relève de Zoé.');
  });
  it('est insensible à la casse pour la balise mais normalise en minuscules', () => {
    expect(extraireRelais('x[[relais:AGENT-42]]').relais).toBe('agent-42');
    expect(extraireRelais('x[[RELAIS:Bob]]').relais).toBe('bob');
  });
  it('masque une balise partielle en fin de flux (streaming)', () => {
    expect(extraireRelais('Je redirige vers [[RELAIS:ab').texte).toBe('Je redirige vers');
    expect(extraireRelais('Je redirige vers [[RELAIS').texte).toBe('Je redirige vers');
    expect(extraireRelais('Je redirige vers [[').texte).toBe('Je redirige vers');
  });
  it('ne confond pas « [[relais:… » avec du contenu réel', () => {
    // pas de crochet ouvrant → pas de masque
    const r = extraireRelais('Parlons de RELAIS:x en général.');
    expect(r.texte).toBe('Parlons de RELAIS:x en général.');
    expect(r.relais).toBeNull();
  });
  it('supprime toutes les occurrences de la balise', () => {
    const r = extraireRelais('[[RELAIS:a]]début[[RELAIS:a]]fin');
    expect(r.texte).toBe('débutfin');
    expect(r.relais).toBe('a');
  });
});

describe('jeton (localStorage)', () => {
  beforeEach(() => { stubStockage(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("retourne null quand rien n'est stocké", () => {
    expect(jeton.lire()).toBeNull();
  });
  it('écrit puis relit un jeton', () => {
    jeton.ecrire('abc.def');
    expect(jeton.lire()).toBe('abc.def');
  });
  it('efface quand on écrit null', () => {
    jeton.ecrire('xx');
    jeton.ecrire(null);
    expect(jeton.lire()).toBeNull();
  });
  it('encaisse une erreur de stockage sans planter', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('bloqué'); },
      setItem() { throw new Error('bloqué'); },
      removeItem() { throw new Error('bloqué'); },
    });
    expect(() => jeton.lire()).not.toThrow();
    expect(jeton.lire()).toBeNull();
    expect(() => jeton.ecrire('x')).not.toThrow();
    expect(() => jeton.ecrire(null)).not.toThrow();
  });
});

describe('SessionExpiree', () => {
  it('est une Error identifiable par instanceof', () => {
    const e = new SessionExpiree('fini');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(SessionExpiree);
    expect(e.message).toBe('fini');
  });
});

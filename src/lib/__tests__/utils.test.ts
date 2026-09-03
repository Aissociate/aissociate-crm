import { describe, it, expect } from 'vitest';
import { cn, fullName, initials, ymdLocal, prochaineHeureOuvrable, isConseillerInactif, formatMoney } from '@/lib/utils';

describe('cn', () => {
  it('concatène en ignorant les valeurs falsy', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});

describe('fullName / initials', () => {
  it('assemble prénom + nom', () => {
    expect(fullName('Jean', 'Payet')).toBe('Jean Payet');
    expect(fullName(null, 'Payet')).toBe('Payet');
    expect(fullName(null, null)).toBe('—');
  });
  it('initiales prénom puis nom', () => {
    expect(initials('Payet', 'Jean')).toBe('JP');
    expect(initials(null, null)).toBe('?');
  });
});

describe('formatMoney', () => {
  it('formate en euros sans décimales', () => {
    // Espace insécable selon l'ICU : on compare sans les espaces.
    expect(formatMoney(1500).replace(/\s/g, '')).toBe('1500€');
    expect(formatMoney(null).replace(/\s/g, '')).toBe('0€');
  });
});

describe('ymdLocal', () => {
  it('formate en local sans bascule UTC', () => {
    expect(ymdLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('prochaineHeureOuvrable', () => {
  it('avant 9 h un jour ouvré → 9 h le jour même', () => {
    const lundi8h = new Date(2026, 7, 24, 8, 0); // lundi 24/08/2026
    expect(prochaineHeureOuvrable(lundi8h)).toEqual({ date: '2026-08-24', heure: '09:00' });
  });
  it('après 9 h → 9 h le prochain jour ouvré', () => {
    const vendredi14h = new Date(2026, 7, 28, 14, 0); // vendredi
    expect(prochaineHeureOuvrable(vendredi14h)).toEqual({ date: '2026-08-31', heure: '09:00' }); // lundi
  });
  it('samedi → lundi 9 h', () => {
    const samedi = new Date(2026, 7, 29, 10, 0);
    expect(prochaineHeureOuvrable(samedi)).toEqual({ date: '2026-08-31', heure: '09:00' });
  });
});

describe('isConseillerInactif', () => {
  it('inactif si désactivé, non approuvé ou statut RH sorti', () => {
    expect(isConseillerInactif({ actif: false })).toBe(true);
    expect(isConseillerInactif({ approved: false })).toBe(true);
    expect(isConseillerInactif({ statut_conseiller: 'ancien' })).toBe(true);
    expect(isConseillerInactif({ statut_conseiller: 'inactif' })).toBe(true);
  });
  it('actif sinon', () => {
    expect(isConseillerInactif({ actif: true, approved: true, statut_conseiller: 'actif' })).toBe(false);
    expect(isConseillerInactif(null)).toBe(false);
  });
});

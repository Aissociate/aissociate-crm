import { describe, it, expect } from 'vitest';
import { jourFerie, anomaliesHoraires } from '@/lib/joursFeries';

describe('jourFerie', () => {
  it('fériés fixes, dont le 20 décembre (La Réunion)', () => {
    expect(jourFerie('2026-01-01')).toBe('Jour de l’an');
    expect(jourFerie('2026-12-20')).toBe('Abolition de l’esclavage');
    expect(jourFerie('2026-12-25')).toBe('Noël');
    expect(jourFerie('2026-03-03')).toBeNull();
  });
  it('fériés mobiles calculés depuis Pâques', () => {
    // Pâques 2026 : dimanche 5 avril.
    expect(jourFerie('2026-04-06')).toBe('Lundi de Pâques');
    expect(jourFerie('2026-05-14')).toBe('Ascension');
    expect(jourFerie('2026-05-25')).toBe('Lundi de Pentecôte');
    // Pâques 2025 : 20 avril.
    expect(jourFerie('2025-04-21')).toBe('Lundi de Pâques');
  });
  it('date invalide → null', () => {
    expect(jourFerie('')).toBeNull();
  });
});

describe('anomaliesHoraires', () => {
  it('week-end et jour férié signalés', () => {
    expect(anomaliesHoraires('2026-08-29', null).map((a) => a.code)).toContain('week-end'); // samedi
    expect(anomaliesHoraires('2026-12-25', null).map((a) => a.code)).toContain('jour férié');
  });
  it('horaire hors 9 h – 18 h signalé', () => {
    expect(anomaliesHoraires('2026-08-26', '07:30').map((a) => a.code)).toContain('horaire');
    expect(anomaliesHoraires('2026-08-26', '18:30').map((a) => a.code)).toContain('horaire');
    expect(anomaliesHoraires('2026-08-26', '10:00')).toEqual([]);
  });
});

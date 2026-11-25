import { describe, expect, it } from 'vitest';
import { decaler, enRetard, heure, jourReunion, libelleJour, libellePeriode, parJour, type EvenementCalendrier } from './calendrierVue';

const MAINTENANT = new Date('2026-11-25T06:00:00Z'); // mercredi 25/11, 10 h à La Réunion
const evt = (id: string, quand: string, extra: Partial<EvenementCalendrier> = {}): EvenementCalendrier =>
  ({ id, type: 'rappel', quand, titre: id, agent_id: null, ...extra });

describe('vue du calendrier', () => {
  it('range les événements par jour de La Réunion', () => {
    const g = parJour([evt('b', '2026-11-25T21:00:00Z'), evt('a', '2026-11-25T19:30:00Z'), evt('c', '2026-11-26T05:00:00Z')]);
    expect(g.map((x) => [x.jour, x.evenements.map((e) => e.id)])).toEqual([
      ['2026-11-25', ['a']], // 23:30 le 25 à La Réunion
      ['2026-11-26', ['b', 'c']], // 01:00 et 09:00 le 26
    ]);
  });

  it('nomme les jours et les heures', () => {
    expect(jourReunion('2026-11-25T20:00:00Z')).toBe('2026-11-26');
    expect(decaler('2026-11-30', 2)).toBe('2026-12-02');
    expect(libelleJour('2026-11-25', MAINTENANT)).toBe("Aujourd'hui");
    expect(libelleJour('2026-11-26', MAINTENANT)).toBe('Demain');
    expect(libelleJour('2026-12-03', MAINTENANT)).toBe('Jeudi 3 décembre');
    expect(heure('2026-12-03T05:30:00Z')).toBe('09:30');
    expect(libellePeriode('2026-11-24T20:00:00Z', '2026-12-24T19:59:59Z')).toBe('du 25 novembre au 24 décembre');
  });

  it('repère les rappels en retard', () => {
    expect(enRetard(evt('x', '2026-11-25T05:00:00Z'), MAINTENANT)).toBe(true);
    expect(enRetard(evt('x', '2026-11-25T05:00:00Z', { fait: true }), MAINTENANT)).toBe(false);
    expect(enRetard(evt('x', '2026-11-25T07:00:00Z'), MAINTENANT)).toBe(false);
    expect(enRetard(evt('x', '2026-11-25T05:00:00Z', { type: 'routine' }), MAINTENANT)).toBe(false);
  });
});

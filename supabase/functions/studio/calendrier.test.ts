import { describe, expect, it } from 'vitest';
import { assembler, bornes, instantReunion, passages, rappelValide, texteCalendrier } from './calendrier.ts';

// Mardi 25 novembre 2026, 10 h à La Réunion (06:00 UTC).
const MAINTENANT = new Date('2026-11-25T06:00:00Z');

describe('calendrier par défaut', () => {
  it('borne la période en jours de La Réunion (30 jours par défaut, 92 au plus)', () => {
    const p = bornes(undefined, undefined, MAINTENANT);
    expect(p.debut.toISOString()).toBe('2026-11-24T20:00:00.000Z'); // 25/11 00:00 à La Réunion
    expect(p.fin.toISOString()).toBe('2026-12-24T19:59:59.999Z');
    const q = bornes('2026-12-01', '2026-12-07', MAINTENANT);
    expect(q.debut.toISOString()).toBe('2026-11-30T20:00:00.000Z');
    expect(q.fin.toISOString()).toBe('2026-12-07T19:59:59.999Z');
    const long = bornes('2026-01-01', '2027-12-31', MAINTENANT);
    expect((long.fin.getTime() - long.debut.getTime() + 1) / 86_400_000).toBe(92);
    expect(bornes('2026-12-10', '2026-12-01', MAINTENANT).fin.getTime()).toBe(bornes('2026-12-10', '2026-12-01', MAINTENANT).debut.getTime());
  });

  it('lit une date-heure de La Réunion', () => {
    expect(instantReunion('2026-12-03T09:30')?.toISOString()).toBe('2026-12-03T05:30:00.000Z');
    expect(instantReunion('2026-12-03 09:30:00')?.toISOString()).toBe('2026-12-03T05:30:00.000Z');
    expect(instantReunion('03/12/2026 09:30')).toBeNull();
    expect(instantReunion('2026-12-03T25:00')).toBeNull();
  });

  it('énumère les passages d\'une routine (lundi et jeudi à 8 h)', () => {
    const { debut, fin } = bornes('2026-11-30', '2026-12-06', MAINTENANT); // lundi → dimanche
    const d = passages({ jours: [1, 4], heures: [8] }, debut, fin);
    expect(d.map((x) => x.toISOString())).toEqual(['2026-11-30T04:00:00.000Z', '2026-12-03T04:00:00.000Z']);
    expect(passages({ jours: [], heures: [8] }, debut, fin)).toEqual([]);
  });

  it('compte un passage à minuit pile en début de période', () => {
    const { debut, fin } = bornes('2026-11-30', '2026-11-30', MAINTENANT);
    expect(passages({ jours: [1], heures: [0, 23] }, debut, fin).map((x) => x.toISOString()))
      .toEqual(['2026-11-29T20:00:00.000Z', '2026-11-30T19:00:00.000Z']);
  });

  it('vérifie un rappel', () => {
    expect(rappelValide({ titre: ' Relancer Dupont ', quand: '2026-11-26T09:00', note: '' }, MAINTENANT))
      .toEqual({ titre: 'Relancer Dupont', quand: new Date('2026-11-26T05:00:00Z'), note: null });
    expect(rappelValide({ titre: '', quand: '2026-11-26T09:00' }, MAINTENANT)).toHaveProperty('erreur');
    expect(rappelValide({ titre: 'x', quand: 'demain' }, MAINTENANT)).toHaveProperty('erreur');
    expect(rappelValide({ titre: 'x', quand: '2026-11-24T09:00' }, MAINTENANT)).toHaveProperty('erreur');
    expect(rappelValide({ titre: 'x', quand: '2029-01-01T09:00' }, MAINTENANT)).toHaveProperty('erreur');
  });

  it('assemble rappels, routines et publications programmées, triés par date', () => {
    const { debut, fin } = bornes('2026-11-30', '2026-12-01', MAINTENANT);
    const evts = assembler({
      rappels: [{ id: 'r1', titre: 'Relancer Dupont', agent_id: 'theo', note: 'Facture F-12', quand: '2026-12-01T06:00:00Z', fait_le: null }],
      routines: [{ id: 't1', titre: 'Point du lundi', agent_id: 'lea', heures: [8], jours: [1] }],
      publications: [
        { id: 'l1', titre: 'Post promo', agent_id: 'mael', statut: 'a_valider', action: { type: 'reseaux_publier', programme: '2026-11-30T18:00' } },
        { id: 'l2', titre: 'Hors période', agent_id: 'mael', statut: 'valide', action: { type: 'reseaux_publier', programme: '2026-12-20T18:00' } },
        { id: 'l3', titre: 'Sans date', agent_id: 'mael', statut: 'valide', action: { type: 'reseaux_publier', programme: null } },
      ],
    }, debut, fin);
    expect(evts.map((e) => [e.type, e.titre, e.quand])).toEqual([
      ['routine', 'Point du lundi', '2026-11-30T04:00:00.000Z'],
      ['publication', 'Post promo', '2026-11-30T14:00:00.000Z'],
      ['rappel', 'Relancer Dupont', '2026-12-01T06:00:00.000Z'],
    ]);
    expect(evts[2]).toMatchObject({ ref_id: 'r1', fait: false, note: 'Facture F-12' });
  });

  it('résume le calendrier pour un agent', () => {
    expect(texteCalendrier([], new Map())).toBe('Rien de prévu sur cette période.');
    const t = texteCalendrier([
      { id: 'rappel:r1', type: 'rappel', quand: '2026-12-01T06:00:00.000Z', titre: 'Relancer Dupont', agent_id: 'theo', fait: true },
      { id: 'publication:l1', type: 'publication', quand: '2026-12-01T14:00:00.000Z', titre: 'Post promo', agent_id: null, statut: 'a_valider' },
    ], new Map([['theo', 'Théo']]));
    expect(t).toContain('Rappel (Théo) : Relancer Dupont [fait]');
    expect(t).toContain('Publication programmée : Post promo [à valider]');
    expect(t).toContain('10:00');
  });
});

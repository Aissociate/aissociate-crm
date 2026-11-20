import { describe, expect, it } from 'vitest';
import { aVenir, dateProgramme, faitsSemaine } from './faits';

const lignes = (agent: string | null, action: string, n: number) => Array.from({ length: n }, () => ({ agent_id: agent, action }));

describe('« fait sans vous cette semaine »', () => {
  it('met le journal en phrases, une par agent, les plus actifs d\'abord', () => {
    const f = faitsSemaine([
      ...lignes('theo', 'mail_lecture', 12), ...lignes('theo', 'gmail_lecture', 2), ...lignes('theo', 'livrable_soumis', 3),
      ...lignes('hugo', 'livrable_soumis', 1), ...lignes('hugo', 'media', 2),
      ...lignes('lea', 'mission', 4),
    ]);
    expect(f).toEqual([
      { agent_id: 'theo', texte: 'a préparé 3 propositions à valider et lu 14 e-mails.', total: 17 },
      { agent_id: 'lea', texte: 'a traité 4 demandes.', total: 4 },
      { agent_id: 'hugo', texte: 'a préparé 1 proposition à valider et créé 2 visuels.', total: 3 },
    ]);
  });

  it('garde les deux faits les plus parlants par agent', () => {
    const [f] = faitsSemaine([...lignes('sam', 'element_range', 30), ...lignes('sam', 'action_executee', 1), ...lignes('sam', 'mission', 2), ...lignes('sam', 'mail_lecture', 9)]);
    expect(f.texte).toBe('a mené à bien 1 action validée par vous et traité 2 demandes.');
    expect(f.total).toBe(42);
  });

  it("ignore ce qui n'est pas un travail d'agent", () => {
    expect(faitsSemaine([
      ...lignes(null, 'mission', 3), ...lignes('lea', 'livrable_valide', 2), ...lignes('lea', 'suspension', 1), ...lignes('lea', 'action_inconnue', 5),
    ])).toEqual([]);
  });

  it('se limite à cinq agents', () => {
    const tous = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].flatMap((id, i) => lignes(id, 'mission', i + 1));
    expect(faitsSemaine(tous).map((f) => f.agent_id)).toEqual(['g', 'f', 'e', 'd', 'c']);
  });
});

describe('« à venir »', () => {
  const maintenant = new Date('2026-11-24T08:00:00Z');

  it('lit une date programmée à l\'heure de La Réunion quand le fuseau manque', () => {
    expect(dateProgramme('2026-11-27 18:00')?.toISOString()).toBe('2026-11-27T14:00:00.000Z');
    expect(dateProgramme('2026-11-27T18:00:00+04:00')?.toISOString()).toBe('2026-11-27T14:00:00.000Z');
    expect(dateProgramme('2026-11-27T14:00:00Z')?.toISOString()).toBe('2026-11-27T14:00:00.000Z');
    expect(dateProgramme('vendredi')).toBeNull();
    expect(dateProgramme(null)).toBeNull();
  });

  it('mêle routines et publications programmées, les plus proches d\'abord, sans le passé', () => {
    const r = aVenir(
      [
        { titre: 'Point comptable', agent_id: 'theo', prochaine_execution: '2026-11-25T05:00:00Z' },
        { titre: 'Routine en retard', agent_id: 'lea', prochaine_execution: '2026-11-23T05:00:00Z' },
        { titre: 'En pause', agent_id: 'lea', prochaine_execution: null },
      ],
      [
        { titre: 'Publication Facebook — Fin d\'année', agent_id: 'hugo', statut: 'a_valider', action: { type: 'reseaux_publier', programme: '2026-11-27 18:00' } },
        { titre: 'Publication LinkedIn — Chantier', agent_id: 'hugo', statut: 'publie', action: { type: 'reseaux_publier', programme: '2026-11-24 20:00' } },
        { titre: 'Refusée', agent_id: 'hugo', statut: 'refuse', action: { programme: '2026-11-28 10:00' } },
        { titre: 'E-mail sans date', agent_id: 'sam', statut: 'a_valider', action: { type: 'gmail_envoyer' } },
      ],
      maintenant,
    );
    expect(r.map((e) => [e.titre, e.etat])).toEqual([
      ['Publication LinkedIn — Chantier', 'programmee'],
      ['Point comptable', 'routine'],
      ['Publication Facebook — Fin d\'année', 'attend'],
    ]);
  });
});

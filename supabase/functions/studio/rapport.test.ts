import { describe, expect, it } from 'vitest';
import { bornesMois, calculerRapport, moisValide, type MessageRapport } from './rapport';
import { rapportEnMarkdown, evolution } from '../../../src/studio/rapport';

const agents = [
  { id: 'hugo', prenom: 'Hugo', metier: 'Marketing', minutes_par_tache: 30 },
  { id: 'mael', prenom: 'Maël', metier: 'Juridique', minutes_par_tache: 40 },
];
const m = (role: 'user' | 'assistant', agent_id: string, created_at: string, extra: Partial<MessageRapport> = {}): MessageRapport =>
  ({ role, agent_id, created_at, retour: null, content: 'ok', epingle: false, ...extra });

describe('rapport mensuel de valeur', () => {
  const messages: MessageRapport[] = [
    // Novembre 2026
    m('user', 'hugo', '2026-11-03T08:00:00Z'), m('assistant', 'hugo', '2026-11-03T08:01:00Z', { epingle: true }),
    m('user', 'hugo', '2026-11-05T08:00:00Z'), m('assistant', 'hugo', '2026-11-05T08:01:00Z', { retour: 1 }),
    m('user', 'mael', '2026-11-09T08:00:00Z'), m('assistant', 'mael', '2026-11-09T08:01:00Z', { retour: -1 }), // à revoir : 0 min
    m('user', 'hugo', '2026-11-10T08:00:00Z'), m('assistant', 'hugo', '2026-11-10T08:01:00Z', { content: 'Pas mon domaine [[RELAIS:sam]]' }), // relais : 0 min
    // Octobre 2026 (mois précédent)
    m('user', 'mael', '2026-10-20T08:00:00Z'), m('assistant', 'mael', '2026-10-20T08:01:00Z'),
    // Décembre : hors période
    m('user', 'hugo', '2026-12-01T00:00:00Z'), m('assistant', 'hugo', '2026-12-01T00:01:00Z'),
  ];
  const r = calculerRapport({
    mois: '2026-11', messages, agents,
    conversations: [
      { titre: 'Posts de novembre', agent_id: 'hugo', updated_at: '2026-11-05T09:00:00Z' },
      { titre: 'Ancienne', agent_id: 'mael', updated_at: '2026-10-20T09:00:00Z' },
    ],
    medias: [
      { type: 'image', statut: 'pret', created_at: '2026-11-04T00:00:00Z' },
      { type: 'video', statut: 'echec', created_at: '2026-11-04T00:00:00Z' },
    ],
  });

  it('compte les missions et le temps gagné du seul mois demandé', () => {
    expect(r.libelle).toBe('novembre 2026');
    expect(r.missions).toBe(4);
    expect(r.reponses_utiles).toBe(2);       // ni la réponse « à revoir », ni le relais
    expect(r.minutes).toBe(60);              // 2 réponses utiles de Hugo × 30 min
    expect(r.contenus_gardes).toBe(1);
    expect(r.images).toBe(1);
    expect(r.videos).toBe(0);                // vidéo en échec ignorée
  });

  it('détaille par agent, du plus utile au moins utile', () => {
    expect(r.par_agent.map((a) => [a.prenom, a.missions, a.minutes])).toEqual([['Hugo', 3, 60], ['Maël', 1, 0]]);
  });

  it('compare au mois précédent et liste les missions du mois', () => {
    expect(r.precedent).toEqual({ missions: 1, minutes: 40 });
    expect(r.exemples).toEqual([{ titre: 'Posts de novembre', agent: 'Hugo' }]);
  });

  it('gère les bornes de mois et les mois invalides', () => {
    expect(bornesMois('2026-01').debutPrecedent).toBe('2025-12-01T00:00:00.000Z');
    expect(moisValide('2026-13')).toMatch(/^\d{4}-\d{2}$/);
    expect(moisValide('2026-02')).toBe('2026-02');
  });

  it('produit un document lisible, sans aucun coût', () => {
    const md = rapportEnMarkdown(r, 'Les Délices');
    expect(md).toContain('**4 missions** confiées');
    expect(md).toContain('+300 % par rapport au mois précédent');
    expect(md).toContain('**1 h**');
    expect(md).toContain('| Hugo | Marketing | 3 | 1 h |');
    expect(md).toContain('- Posts de novembre (Hugo)');
    expect(md).not.toMatch(/€|\$|coût/i);
    expect(evolution(0, 0)).toBe('—');
    expect(evolution(5, 0)).toBe('nouveau');
  });
});

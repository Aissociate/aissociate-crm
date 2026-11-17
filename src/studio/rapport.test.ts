// Tests du rapport mensuel de valeur : derniersMois, evolution, rapportEnMarkdown.
import { describe, expect, it } from 'vitest';
import { derniersMois, evolution, rapportEnMarkdown, type Rapport } from './rapport';

describe('derniersMois', () => {
  it('rend n entrées, du plus récent au plus ancien', () => {
    const l = derniersMois(6, new Date(Date.UTC(2026, 10, 17))); // novembre 2026
    expect(l).toHaveLength(6);
    expect(l[0].valeur).toBe('2026-11');
    expect(l[1].valeur).toBe('2026-10');
    expect(l[5].valeur).toBe('2026-06');
  });
  it('gère le passage d\'année', () => {
    const l = derniersMois(3, new Date(Date.UTC(2026, 1, 15))); // février 2026
    expect(l.map((x) => x.valeur)).toEqual(['2026-02', '2026-01', '2025-12']);
  });
  it('rend un libellé français du mois', () => {
    const l = derniersMois(1, new Date(Date.UTC(2026, 0, 10)));
    expect(l[0].libelle.toLowerCase()).toContain('janvier');
    expect(l[0].libelle).toContain('2026');
  });
  it('par défaut rend 6 entrées', () => {
    expect(derniersMois()).toHaveLength(6);
  });
});

describe('evolution', () => {
  it('rend « — » quand aucun des deux n\'a de valeur', () => {
    expect(evolution(0, 0)).toBe('—');
  });
  it('rend « nouveau » quand il n\'y avait rien avant', () => {
    expect(evolution(5, 0)).toBe('nouveau');
  });
  it('rend « stable » pour un écart arrondi à 0 %', () => {
    expect(evolution(100, 100)).toBe('stable');
    // 1000 → 1001 : -0.0999…% arrondi à 0 → "stable"
    expect(evolution(1000, 1001)).toBe('stable');
  });
  it('rend un pourcentage signé sinon', () => {
    expect(evolution(140, 100)).toBe('+40 %');
    expect(evolution(50, 100)).toBe('-50 %');
    expect(evolution(200, 100)).toBe('+100 %');
  });
});

const rapportDemo: Rapport = {
  mois: '2026-10', libelle: 'octobre 2026',
  missions: 12, reponses_utiles: 10, minutes: 420,
  contenus_gardes: 4, images: 2, videos: 1,
  par_agent: [
    { agent_id: 'a1', prenom: 'Zoé', metier: 'Marketing', missions: 7, minutes: 300 },
    { agent_id: 'a2', prenom: 'Léo', metier: 'Admin', missions: 5, minutes: 120 },
  ],
  exemples: [
    { titre: 'Préparer la relance de septembre', agent: 'Zoé' },
    { titre: 'Note de frais', agent: '' },
  ],
  precedent: { missions: 8, minutes: 300 },
};

describe('rapportEnMarkdown', () => {
  const md = rapportEnMarkdown(rapportDemo, 'Les Délices');

  it('ouvre par le titre du mois', () => {
    expect(md).toMatch(/^## L'essentiel de octobre 2026/);
  });
  it("inclut le nombre de missions au pluriel et l'évolution", () => {
    expect(md).toContain('**12 missions**');
    expect(md).toContain('+50 %');
  });
  it('affiche le temps gagné formatté en heures/minutes', () => {
    expect(md).toContain('**7 h**'); // 420 min = 7 h
  });
  it('inclut la section tableau « Votre équipe » avec en-têtes', () => {
    expect(md).toContain('## Votre équipe ce mois-ci');
    expect(md).toContain('| Agent | Métier | Missions | Temps gagné |');
    expect(md).toContain('| Zoé | Marketing | 7 | 5 h |');
  });
  it('liste les exemples, agent entre parenthèses quand connu', () => {
    expect(md).toContain('- Préparer la relance de septembre (Zoé)');
    expect(md).toContain('- Note de frais\n');
  });
  it('se termine par la mention italique avec le nom de l\'entreprise', () => {
    expect(md.trim().endsWith('_')).toBe(true);
    expect(md).toContain('Les Délices');
  });
  it('omet la ligne visuels/vidéos quand il n\'y en a pas', () => {
    const vide = rapportEnMarkdown({ ...rapportDemo, images: 0, videos: 0 }, 'X');
    expect(vide).not.toMatch(/visuel/);
  });
  it('gère le singulier pour une seule mission', () => {
    const une = rapportEnMarkdown({ ...rapportDemo, missions: 1, precedent: { ...rapportDemo.precedent, missions: 0 } }, 'X');
    expect(une).toContain('**1 mission**');
    expect(une).toContain('confiée');
    expect(une).toContain('nouveau');
  });
});

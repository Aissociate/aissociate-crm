import { describe, expect, it } from 'vitest';
import { ficheEntreprise, scorer, SECTIONS, validerReponses, type Reponses } from './questionnaire';
import { hacherLigne, stable, verifierChaine, type LigneJournal } from './journal';

const complet: Reponses = {
  agents: ['hugo', 'sam'], A1: 'Les Délices SARL, 123 456 789', A2: 'Boulangerie', A3: '6',
  A5: 'La gérante décide seule', B1: 'Pains et viennoiseries pour les habitants du centre-ville',
  B3: 'Bouche-à-oreille et passage devant la boutique, Facebook', B7: 'Réseaux sociaux, devis CE', B7h: '12',
  C1: 'La gérante valide tout, le chef pâtissier gère la production', D8: 'oui', E1: 'non', E3: 'oui', E4: 'oui', E6: 'non',
  F1: 'Plus de commandes de CE', F3: '300', F5: '3', G3: 'oui',
};

describe("questionnaire d'onboarding", () => {
  it('note un dossier mûr à 100 et le classe en démarrage', () => {
    expect(validerReponses(complet)).toBeNull();
    const s = scorer(complet);
    expect(s.score).toBe(100);
    expect(s.lecture).toBe('démarrage');
    expect(s.drapeaux).toEqual([]);
  });

  it('applique la grille et lève les drapeaux RGPD', () => {
    const s = scorer({ ...complet, B7h: '4', D8: 'non', F5: '1', E3: 'non', E4: 'non', F3: '50', E1: 'oui', E6: 'oui', G3: 'non', C1: '' });
    expect(s.detail).toEqual({ temps: 8, donnees: 0, decideur: 0, process: 8, rgpd: 0, budget: 0 });
    expect(s.lecture).toBe('diagnostic');
    expect(s.drapeaux).toEqual(['donnees_sensibles', 'mineurs', 'disponibilite_insuffisante', 'sans_double_authentification']);
  });

  it('refuse un dossier incomplet ou un agent hors catalogue', () => {
    expect(validerReponses({ ...complet, B7: '' })).toMatch(/B7|temps/);
    expect(validerReponses({ ...complet, agents: ['hugo', 'pirate'] })).toMatch(/Choix invalide/);
    expect(validerReponses({ ...complet, E1: 'peut-être' })).toMatch(/invalide/);
  });

  it('pré-remplit la fiche entreprise lue par les agents', () => {
    const f = ficheEntreprise(complet);
    expect(f).toContain('Entreprise : Les Délices SARL');
    expect(f).toContain('Ce que nous vendons, et à qui : Pains');
    expect(f).not.toContain('Pics saisonniers'); // réponse vide → ligne absente
  });

  it('chaque question a un identifiant unique', () => {
    const ids = SECTIONS.flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("journal d'audit chaîné", () => {
  const ws = '5d1e0000-0000-4000-8000-000000000001';
  async function chaine(n: number): Promise<LigneJournal[]> {
    const lignes: LigneJournal[] = [];
    for (let i = 0; i < n; i++) {
      const base = {
        workspace_id: ws, acteur: 'client:demo@exemple.re', agent_id: 'hugo', action: 'mission',
        detail: { n: i, titre: `Post ${i}` }, hash_precedent: lignes.at(-1)?.hash ?? null, created_at: `2026-11-16T10:0${i}:00.000Z`,
      };
      lignes.push({ ...base, id: i + 1, hash: await hacherLigne(base) });
    }
    return lignes;
  }

  it('valide une chaîne intacte', async () => {
    expect(await verifierChaine(await chaine(4))).toEqual({ ok: true, lignes: 4 });
  });

  it('détecte une ligne modifiée, supprimée ou insérée', async () => {
    const modifiee = await chaine(4);
    modifiee[1] = { ...modifiee[1], detail: { n: 1, titre: 'Post falsifié' } };
    expect(await verifierChaine(modifiee)).toMatchObject({ ok: false, rupture: 2, motif: 'ligne modifiée' });

    const supprimee = (await chaine(4)).filter((l) => l.id !== 2);
    expect(await verifierChaine(supprimee)).toMatchObject({ ok: false, rupture: 3, motif: 'maillon manquant ou inséré' });
  });

  it('sérialise de façon stable (ordre des clés indifférent)', () => {
    expect(stable({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(stable({ a: [2, { c: 4, d: 3 }], b: 1 }));
  });
});

import { describe, expect, it } from 'vitest';
import { BASE, nouvelleAdresse, ongletActif, REDIRECTIONS, sectionDe, SECTIONS } from './routes';

/** Les quinze entrées de l'ancien menu (hors accueil, resté à /studio). */
const ANCIENNES = ['assistants', 'ressources', 'connecteurs', 'par-email', 'taches', 'veille', 'contacts', 'creations', 'livrables', 'perimetre', 'journal', 'rapport', 'entreprise', 'compte'];

describe('navigation du Studio', () => {
  it('se réduit à cinq entrées', () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(["Aujourd'hui", 'Mon équipe', 'Routines', 'Mes documents', 'Réglages et connecteurs']);
  });

  it('redirige chaque ancienne adresse vers un onglet existant', () => {
    const onglets = new Set(SECTIONS.flatMap((s) => [s.to, ...s.onglets.map((o) => o.chemin)]));
    expect(Object.keys(REDIRECTIONS).sort()).toEqual([...ANCIENNES].sort());
    for (const ancienne of ANCIENNES) {
      const cible = nouvelleAdresse(`${BASE}/${ancienne}`);
      expect(cible, ancienne).not.toBeNull();
      expect(onglets.has(cible!), `${ancienne} → ${cible}`).toBe(true);
    }
  });

  it('conserve les paramètres et l\'ancre (retours de connexion et de paiement)', () => {
    expect(nouvelleAdresse('/studio/connecteurs', '?connected=google&profileId=abc')).toBe('/studio/reglages?connected=google&profileId=abc');
    expect(nouvelleAdresse('/studio/perimetre/', '?paiement=ok', '#abonnement')).toBe('/studio/reglages/perimetre?paiement=ok#abonnement');
  });

  it('laisse les adresses inchangées tranquilles', () => {
    expect(nouvelleAdresse('/studio')).toBeNull();
    expect(nouvelleAdresse('/studio/assistants/hugo', '?c=1')).toBeNull(); // conversation avec un agent
    expect(nouvelleAdresse('/studio/reglages/compte')).toBeNull();
    expect(nouvelleAdresse('/ailleurs/livrables')).toBeNull();
  });

  it('retrouve la section et l\'onglet d\'une adresse', () => {
    expect(sectionDe('/studio')?.id).toBe('aujourdhui');
    expect(sectionDe('/studio/aujourdhui/journal')?.id).toBe('aujourdhui');
    expect(sectionDe('/studio/assistants/lea')?.id).toBe('equipe');
    expect(sectionDe('/studio/routines/veille')?.id).toBe('routines');
    expect(sectionDe('/studio/connexion')).toBeNull();
    const reglages = SECTIONS.find((s) => s.id === 'reglages')!;
    expect(ongletActif(reglages, '/studio/reglages')?.label).toBe('Connecteurs');
    expect(ongletActif(reglages, '/studio/reglages/perimetre')?.label).toBe('Mon périmètre');
    expect(ongletActif(SECTIONS[0], '/studio/')?.label).toBe('Vos décisions');
  });

  it('chaque onglet a une adresse unique, dans sa section', () => {
    const chemins = SECTIONS.flatMap((s) => s.onglets.map((o) => o.chemin));
    expect(new Set(chemins).size).toBe(chemins.length);
    for (const s of SECTIONS) for (const o of s.onglets) expect(sectionDe(o.chemin)?.id, o.chemin).toBe(s.id);
  });
});

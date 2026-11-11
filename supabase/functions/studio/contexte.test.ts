// Vérifie que tout ce que l'entreprise a saisi en un mois (fiche, notes, fichiers,
// contenus gardés, connecteurs) arrive bien dans le prompt des agents, et que
// ce qui ne doit pas y être (note archivée, connecteur non actif) n'y est pas.
// Données : supabase/seed/studio_demo.json (le même jeu que le SQL de démo).
//
// STUDIO_DUMP=<dossier> npx vitest run supabase/functions/studio
//   → écrit les prompts construits, pour les rejouer contre un vrai modèle.
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import demo from '../../seed/studio_demo.json';
import {
  construirePrompt, selectionnerRessources, BUDGET_SAVOIRS, HARNESS_REGLES_DEFAUT,
  type AgentPrompt, type ConnecteurActif, type Creation, type Ressource,
} from './contexte';

const agent = (id: string, prenom: string, metier: string, description: string): AgentPrompt => ({
  id, prenom, metier, description, consignes: '', modele_effectif: null,
  prompt_systeme: `Tu es ${prenom}, ${metier}.`,
  super_pouvoirs: [{ id: 'x', titre: `Mission de ${prenom}`, champs: [], gabarit: '' }],
});
const equipe = [
  agent('lea', 'Léa', 'Assistante générale', 'E-mails, comptes rendus, organisation.'),
  agent('hugo', 'Hugo', 'Marketing & réseaux sociaux', 'Posts, calendrier éditorial, visuels.'),
  agent('sam', 'Sam', 'Commercial & prospection', 'Prospection, scripts d\'appel.'),
  agent('mael', 'Maël', 'Administratif & juridique', 'CGV, RGPD, relances.'),
];

// ── Ce que renvoie la base pour cet espace (mêmes filtres que l'Edge Function) ──
const docsActifs = demo.documents.filter((d) => d.actif).sort((a, b) => a.jours - b.jours);
const recentes: Ressource[] = docsActifs.map((d) => ({ titre: d.titre, extrait: d.contenu.slice(0, 4000) }));
/** Imitation de la recherche plein texte : un mot de plus de 3 lettres en commun. */
const rechercher = (question: string): Ressource[] => {
  const mots = question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((m) => m.length > 3);
  return docsActifs.filter((d) => mots.some((m) => `${d.titre} ${d.contenu}`.toLowerCase().includes(m)))
    .map((d) => ({ titre: d.titre, extrait: d.contenu }));
};
const creations: Creation[] = demo.conversations
  .flatMap((c) => c.messages.filter((m) => (m as { epingle?: boolean }).epingle).map((m) => ({
    titre: c.titre, contenu: m.content, jours: c.jours, agent: equipe.find((a) => a.id === c.agent_id)?.prenom,
  })))
  .sort((a, b) => a.jours - b.jours)
  .map(({ jours, ...c }) => ({ ...c, date: `il y a ${jours} j` }));
const connecteurs: ConnecteurActif[] = demo.connecteurs.filter((c) => c.statut === 'connecte')
  .map((c) => ({ type: c.type, libelle: c.type === 'facebook' ? 'Facebook (page)' : c.type, detail: Object.values(c.infos)[0] }));

function prompt(agentId: string, question: string, harness?: { regles?: string; perimetre?: string }) {
  return construirePrompt({
    agent: equipe.find((a) => a.id === agentId)!, equipe,
    ws: demo.workspace, ressources: selectionnerRessources(rechercher(question), recentes),
    creations, connecteurs, harness, aujourdhui: 'mardi 11 novembre 2026',
  });
}

describe('contexte des agents après un mois de fonctionnement', () => {
  const p = prompt('hugo', 'Prépare un post pour ce week-end');

  it('injecte la fiche entreprise', () => {
    expect(p).toContain('Les Délices de Saint-Pierre');
    expect(p).toContain('vanille Bourbon');
  });

  it('injecte les notes même quand la question ne contient aucun de leurs mots', () => {
    // « post », « week-end » : aucun mot commun avec « Tarifs 2026 ».
    expect(rechercher('Prépare un post pour ce week-end').map((r) => r.titre)).not.toContain('Tarifs 2026');
    expect(p).toContain('### Tarifs 2026');
    expect(p).toContain('6,50 €');
    expect(p).toContain('Bûche letchi-passion 8 parts : 38 €');
    expect(p).toContain('### Charte de ton');
    expect(p).toContain('### Plaquette commerciale.pdf');
  });

  it("n'injecte pas une ressource désactivée", () => {
    expect(p).not.toContain('Ancienne carte 2025');
    expect(p).not.toContain('1,10 €');
  });

  it('injecte les contenus gardés, du plus récent au plus ancien, avec leur auteur', () => {
    expect(p).toContain('## Contenus déjà validés par l\'entreprise');
    const cal = p.indexOf('Calendrier éditorial — décembre');
    const prosp = p.indexOf('Séquence de prospection — comités d\'entreprise');
    const lancement = p.indexOf('Générer un post — lancement de la formule petit-déjeuner');
    expect(cal).toBeGreaterThan(0);
    expect(cal).toBeLessThan(prosp);
    expect(prosp).toBeLessThan(lancement);
    expect(p).toContain('(il y a 5 j, Hugo)');
    // Une réponse non gardée (e-mail fournisseur) n'y figure pas.
    expect(p).not.toContain('décaler notre livraison de farine');
  });

  it('liste les seuls connecteurs actifs', () => {
    expect(p).toContain('facebook.com/delicessaintpierre');
    expect(p).not.toContain('@delices.saintpierre');
  });

  it('applique le harness par défaut, avec périmètre et relais', () => {
    expect(p).toContain(HARNESS_REGLES_DEFAUT.split('\n')[0]);
    expect(p).toContain('Ton métier : Marketing & réseaux sociaux');
    expect(p).toContain('[[RELAIS:id]]');
    expect(p).toContain('Maël (id « mael »)');
    expect(p).not.toContain('Hugo (id « hugo »)'); // l'agent ne se liste pas comme collègue
    expect(p).toContain('Date du jour : mardi 11 novembre 2026.');
  });

  it('remplace le harness par celui du CRM et remplit ses variables', () => {
    const perso = prompt('sam', 'test', {
      regles: '## Règles maison\n- Toujours signer « Aissociate ».',
      perimetre: 'Métier : {{metier}}. Pouvoirs : {{super_pouvoirs}}. Équipe :\n{{collegues}}\n[[RELAIS:id]]',
    });
    expect(perso).toContain('## Règles maison');
    expect(perso).not.toContain(HARNESS_REGLES_DEFAUT.split('\n')[1]);
    expect(perso).toContain('Métier : Commercial & prospection. Pouvoirs : « Mission de Sam »');
    expect(perso).not.toMatch(/\{\{\w+\}\}/);
  });

  it('respecte les budgets de taille', () => {
    const enorme = Array.from({ length: 20 }, (_, i) => ({ titre: `Doc ${i}`, extrait: 'x'.repeat(3000) }));
    const sel = selectionnerRessources([], enorme);
    expect(sel.reduce((n, r) => n + r.extrait.length, 0)).toBeLessThanOrEqual(14000);
  });

  it("injecte la base de connaissances de l'agent avec la consigne de citation", () => {
    const savoirs = selectionnerRessources(
      [{ titre: 'Relance des impayés entre professionnels', source: 'Code de commerce, art. L441-10', extrait: 'Indemnité forfaitaire pour frais de recouvrement : 40 €.' }],
      [
        { titre: 'Relance des impayés entre professionnels', source: 'Code de commerce, art. L441-10', extrait: 'doublon' },
        { titre: 'Mise en demeure', source: null, extrait: 'Envoi recommandé avec accusé de réception conseillé.' },
      ],
      BUDGET_SAVOIRS,
    );
    expect(savoirs.map((s) => s.titre)).toEqual(['Relance des impayés entre professionnels', 'Mise en demeure']);
    expect(savoirs[0].source).toBe('Code de commerce, art. L441-10'); // la référence survit à la sélection
    const pm = construirePrompt({
      agent: equipe.find((a) => a.id === 'mael')!, equipe, ws: demo.workspace, ressources: [], savoirs,
    });
    expect(pm).toContain('## Ta base de connaissances (référence Aissociate)');
    expect(pm).toContain('### [S1] Relance des impayés entre professionnels — référence : Code de commerce, art. L441-10');
    expect(pm).toContain('### [S2] Mise en demeure\n');
    expect(pm).toContain('« Sources : »');
    // La base passe avant la fiche entreprise.
    expect(pm.indexOf('## Ta base de connaissances')).toBeLessThan(pm.indexOf('## Entreprise cliente'));
    // Sans savoirs, pas de bloc (ni de consigne de citation orpheline).
    expect(p).not.toContain('## Ta base de connaissances');
  });

  it('écrit les prompts pour un test contre un vrai modèle (STUDIO_DUMP)', () => {
    const dossier = process.env.STUDIO_DUMP;
    if (!dossier) return;
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, 'hugo.txt'), p);
    writeFileSync(join(dossier, 'lea.txt'), prompt('lea', 'Un client demande le prix d\'un gâteau pour 8 personnes, que je lui réponds ?'));
    writeFileSync(join(dossier, 'mael.txt'), construirePrompt({
      agent: equipe.find((a) => a.id === 'mael')!, equipe, ws: demo.workspace, ressources: recentes,
      savoirs: [{
        titre: 'Relance des impayés entre professionnels', source: 'Code de commerce, art. L441-10',
        extrait: 'Entre professionnels, tout retard de paiement entraîne de plein droit des pénalités de retard et une indemnité forfaitaire pour frais de recouvrement de 40 €. Les pénalités sont exigibles sans qu\'un rappel soit nécessaire. Le taux appliqué est celui prévu aux CGV ou, à défaut, le taux de la BCE majoré de 10 points.',
      }],
    }));
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { deciderLivrable, enCours, etatsAgents, raisonRefus, RAISONS_REFUS, soumettreMission, transitionPermise, type Dependances } from './livrables';

type Ligne = Record<string, unknown>;

/** Client Supabase minimal en mémoire : select / update filtrés par eq, appliqués à l'attente. */
function fausseBase(lignes: Ligne[]) {
  const requete = (maj?: Ligne) => {
    const filtres: [string, unknown][] = [];
    const appliquer = () => {
      const cibles = lignes.filter((l) => filtres.every(([c, v]) => l[c] === v));
      if (maj) cibles.forEach((l) => Object.assign(l, maj));
      return cibles.map((l) => ({ ...l }));
    };
    const q = {
      eq(c: string, v: unknown) { filtres.push([c, v]); return q; },
      select() { return q; },
      maybeSingle: async () => ({ data: appliquer()[0] ?? null, error: null }),
      then<R>(ok: (r: { data: Ligne[]; error: null }) => R) { return Promise.resolve({ data: appliquer(), error: null }).then(ok); },
    };
    return q;
  };
  return { from: () => ({ select: () => requete(), update: (m: Ligne) => requete(m) }) };
}

const WS = 'ws-1';
const patron = { acteur: 'client:patron@exemple.re', proprietaire: true };
const membre = { acteur: 'client:salarie@exemple.re', proprietaire: false };
const envoi = { type: 'gmail_envoyer', a: ['client@exemple.re'], objet: 'Relance', corps: 'Bonjour' };

function scene(statut = 'a_valider', action: unknown = envoi) {
  const lignes: Ligne[] = [{ id: 'l1', workspace_id: WS, statut, titre: 'E-mail — Relance', agent_id: 'sam', action, decide_par: null }];
  const deps: Dependances = {
    executer: vi.fn(async () => ({ ok: true as const, lien: 'https://exemple.re/mail', id: 'm1' })),
    journaliser: vi.fn(async () => {}),
  };
  return { lignes, deps, sb: fausseBase(lignes) };
}

describe('décision sur un livrable', () => {
  it('ne laisse passer que les transitions prévues', () => {
    expect(transitionPermise('a_valider', 'valide')).toBe(true);
    expect(transitionPermise('valide', 'publie')).toBe(true);
    expect(transitionPermise('a_valider', 'publie')).toBe(false);
    expect(transitionPermise('refuse', 'publie')).toBe(false);
    expect(transitionPermise('refuse', 'valide')).toBe(false);
    expect(transitionPermise('publie', 'a_valider')).toBe(false);
  });

  it("n'exécute aucune action sans le « VALIDÉ » du propriétaire", async () => {
    const { lignes, deps, sb } = scene();
    expect(await deciderLivrable(sb, WS, membre, { id: 'l1', statut: 'valide' }, deps)).toMatchObject({ statut: 403 });
    expect(await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'publie' }, deps)).toMatchObject({ statut: 400 });
    expect(await deciderLivrable(sb, 'autre-espace', patron, { id: 'l1', statut: 'valide' }, deps)).toMatchObject({ statut: 404 });
    expect(await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'refuse', raison: 'pas_le_moment' }, deps)).toMatchObject({ ok: true });
    expect(deps.executer).not.toHaveBeenCalled();
    expect(lignes[0].statut).toBe('refuse');
  });

  it('exécute au « VALIDÉ », puis publie avec la décision enregistrée', async () => {
    const { lignes, deps, sb } = scene();
    const r = await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'valide' }, deps);
    expect(r).toEqual({ ok: true, execute: true, lien: 'https://exemple.re/mail' });
    expect(deps.executer).toHaveBeenCalledTimes(1);
    expect(deps.executer).toHaveBeenCalledWith(envoi, 'l1');
    expect(lignes[0]).toMatchObject({ statut: 'publie', decide_par: patron.acteur });
    expect(lignes[0].decide_le).toBeTruthy();
  });

  it("n'exécute qu'une fois quand deux validations arrivent en même temps", async () => {
    const { deps, sb } = scene();
    const [a, b] = await Promise.all([
      deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'valide' }, deps),
      deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'valide' }, deps),
    ]);
    expect(deps.executer).toHaveBeenCalledTimes(1);
    expect([a, b].filter((r) => 'erreur' in r)).toMatchObject([{ statut: 409 }]);
  });

  it("garde le livrable « validé » et note l'erreur si l'action échoue", async () => {
    const { lignes, deps, sb } = scene();
    deps.executer = vi.fn(async () => ({ ok: false as const, erreur: 'Boîte déconnectée' }));
    expect(await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'valide' }, deps)).toEqual({ ok: true, execute: false, erreur_action: 'Boîte déconnectée' });
    expect(lignes[0]).toMatchObject({ statut: 'valide', resultat: { erreur: 'Boîte déconnectée' } });
  });

  it('un livrable sans action reste « validé » sans rien exécuter', async () => {
    const { lignes, deps, sb } = scene('a_valider', null);
    expect(await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'valide' }, deps)).toEqual({ ok: true });
    expect(deps.executer).not.toHaveBeenCalled();
    expect(lignes[0].statut).toBe('valide');
  });
});

describe('aucun autre chemin vers une action externe', () => {
  const dossier = dirname(fileURLToPath(import.meta.url));
  const sources = readdirSync(dossier).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  const lire = (f: string) => readFileSync(join(dossier, f), 'utf8');

  it("executerAction n'est appelée que par la décision du propriétaire", () => {
    const appelants = sources.filter((f) => f !== 'outils.ts' && /\bexecuterAction\(/.test(lire(f)));
    expect(appelants).toEqual(['gouvernance.ts']);
    expect(lire('gouvernance.ts').match(/\bexecuterAction\(/g)).toHaveLength(1);
  });

  it('aucun module n\'écrit le statut « publié » hors de livrables.ts', () => {
    const ecrivains = sources.filter((f) => /statut:\s*["']publie["']/.test(lire(f)));
    expect(ecrivains).toEqual(['livrables.ts']);
  });
});

describe('raison de refus', () => {
  it('refuse un refus sans raison ou avec une raison inconnue', async () => {
    const { lignes, deps, sb } = scene();
    expect(await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'refuse' }, deps)).toMatchObject({ statut: 400 });
    expect(await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'refuse', raison: 'toString' }, deps)).toMatchObject({ statut: 400 });
    expect(lignes[0].statut).toBe('a_valider');
  });

  it('enregistre la raison sur le livrable et au journal', async () => {
    const { lignes, deps, sb } = scene();
    expect(await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'refuse', raison: 'mauvais_ton', commentaire: ' Trop familier ' }, deps)).toEqual({ ok: true });
    expect(lignes[0]).toMatchObject({ statut: 'refuse', refus_raison: 'mauvais_ton', commentaire: 'Trop familier' });
    expect(deps.journaliser).toHaveBeenCalledWith(expect.objectContaining({ action: 'livrable_refuse', detail: expect.objectContaining({ raison: 'mauvais_ton' }) }));
  });

  it('efface la raison quand le livrable est remis à valider', async () => {
    const { lignes, deps, sb } = scene('refuse');
    lignes[0].refus_raison = 'trop_long';
    await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'a_valider' }, deps);
    expect(lignes[0]).toMatchObject({ statut: 'a_valider', refus_raison: null });
  });

  it('connaît les quatre raisons de la maquette', () => {
    expect(Object.values(RAISONS_REFUS)).toEqual(['Trop long', 'Pas le bon ton', 'Pas le moment', 'Autre raison']);
    expect(raisonRefus('autre')).toBe('autre');
    expect(raisonRefus(undefined)).toBeNull();
  });
});

describe('mission guidée : le résultat rejoint « Aujourd\'hui »', () => {
  it('soumet la réponse quand rien d\'autre n\'a été proposé', () => {
    expect(soumettreMission({ mission: true, texte: 'Voici votre planning…', propositions: 0 })).toBe(true);
  });
  it('ne soumet ni une conversation ordinaire, ni une réponse vide, ni un relais', () => {
    expect(soumettreMission({ mission: false, texte: 'Bonjour', propositions: 0 })).toBe(false);
    expect(soumettreMission({ mission: true, texte: '  \n', propositions: 0 })).toBe(false);
    expect(soumettreMission({ mission: true, texte: "Ce n'est pas mon domaine. [[RELAIS:theo]]", propositions: 0 })).toBe(false);
  });
  it('laisse la place à la proposition déposée par l\'agent (e-mail, publication, document)', () => {
    expect(soumettreMission({ mission: true, texte: 'J\'ai préparé la relance L-1a2b3c4d.', propositions: 1 })).toBe(false);
  });
});

describe('état des agents (« Mon équipe »)', () => {
  const t0 = Date.parse('2026-11-24T08:00:00Z');
  const ilYA = (ms: number) => new Date(t0 - ms).toISOString();

  it('reconnaît un travail en cours à sa fraîcheur', () => {
    expect(enCours(ilYA(60_000), 180_000, t0)).toBe(true);
    expect(enCours(ilYA(200_000), 180_000, t0)).toBe(false); // réponse bloquée : plus « en cours »
    expect(enCours(null, 180_000, t0)).toBe(false);
    expect(enCours('pas une date', 180_000, t0)).toBe(false);
  });

  it('compte les décisions par agent et note qui travaille', () => {
    const etats = etatsAgents(
      [{ agent_id: 'theo' }, { agent_id: 'theo' }, { agent_id: 'hugo' }, { agent_id: null }],
      [{ agent_id: 'lea', generation_depuis: ilYA(30_000) }, { agent_id: 'sam', generation_depuis: ilYA(600_000) }],
      [{ agent_id: 'theo', en_cours_depuis: ilYA(5 * 60_000) }, { agent_id: 'ines', en_cours_depuis: ilYA(20 * 60_000) }],
      t0,
    );
    expect(etats).toEqual({
      theo: { decisions: 2, au_travail: true },
      hugo: { decisions: 1, au_travail: false },
      lea: { decisions: 0, au_travail: true },
    });
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { deciderLivrable, transitionPermise, type Dependances } from './livrables';

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
    expect(await deciderLivrable(sb, WS, patron, { id: 'l1', statut: 'refuse' }, deps)).toMatchObject({ ok: true });
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

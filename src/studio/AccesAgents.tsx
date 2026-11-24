// Connecteur réservé à certains agents : « Agents : toute l'équipe » / « Agents : Hugo, Sam ».
// Clé d'un connecteur : « zernio:<id du compte> » (messagerie, réseau, application en un clic) ou le type
// de la connexion directe (« api:brevo », « mcp:notion »…), comme supabase/functions/studio/acces.ts.
// Pas de réglage = toute l'équipe. Seul le propriétaire règle ; les membres voient le libellé.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Loader2, Users } from 'lucide-react';
import { useStudio } from './StudioApp';
import { appel } from './api';
import { cx } from './composants';

type Acces = Record<string, string[]>;
type Ctx = { acces: Acces; regler: (cle: string, nom: string, agents: string[] | null) => Promise<void> };
const AccesContext = createContext<Ctx | null>(null);

export const cleZernio = (id: string) => `zernio:${id}`;

/** Charge les réglages de l'espace pour la page Connecteurs. */
export function AccesAgentsProvider({ children }: { children: ReactNode }) {
  const { gerer } = useStudio();
  const [acces, setAcces] = useState<Acces>({});
  useEffect(() => {
    appel<{ acces: Acces }>('acces_connecteurs').then((r) => setAcces(r.acces ?? {})).catch(() => setAcces({}));
  }, []);
  const regler = useCallback(async (cle: string, nom: string, agents: string[] | null) => {
    let erreur: string;
    try { setAcces((await appel<{ acces: Acces }>('acces_connecteur_regler', { cle, nom, agents })).acces ?? {}); return; }
    catch (e) { erreur = gerer(e); }
    throw new Error(erreur);
  }, [gerer]);
  return <AccesContext.Provider value={{ acces, regler }}>{children}</AccesContext.Provider>;
}

/** Libellé « Agents : … » et, pour le propriétaire, le choix des agents qui peuvent utiliser ce connecteur. */
export function AgentsConnecteur({ cle, nom }: { cle: string; nom: string }) {
  const ctx = useContext(AccesContext);
  const { me } = useStudio();
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  if (!ctx) return null;
  const proprietaire = me.user.role === 'proprietaire';
  const equipe = me.agents;
  const reserves = ctx.acces[cle];
  const prenoms = (ids: string[]) => ids.map((id) => equipe.find((a) => a.id === id)?.prenom ?? id).join(', ');
  const libelle = reserves ? prenoms(reserves) : "toute l'équipe";

  const ouvrir = () => { setChoix(reserves ?? equipe.map((a) => a.id)); setErreur(''); setOuvert(true); };
  const enregistrer = async (agents: string[] | null) => {
    setEnvoi(true); setErreur('');
    try { await ctx.regler(cle, nom, agents); setOuvert(false); }
    catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setEnvoi(false); }
  };

  return (
    <div className="mt-1.5 text-xs">
      {proprietaire ? (
        <button type="button" onClick={() => (ouvert ? setOuvert(false) : ouvrir())} aria-expanded={ouvert}
          className={cx('inline-flex max-w-full items-center gap-1 rounded-lg px-1.5 py-0.5 hover:bg-neutral-100', reserves ? 'font-medium text-orange-700' : 'text-neutral-500')}>
          <Users className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Agents : {libelle}</span>
        </button>
      ) : (
        <p className={cx('flex items-center gap-1 px-1.5', reserves ? 'text-orange-700' : 'text-neutral-500')}>
          <Users className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Agents : {libelle}</span>
        </p>
      )}
      {ouvert && (
        <div className="mt-1 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-neutral-600">Qui peut utiliser <span className="font-medium text-neutral-900">{nom}</span> ?</p>
          <div className="grid grid-cols-2 gap-1.5">
            {equipe.map((a) => {
              const coche = choix.includes(a.id);
              return (
                <label key={a.id} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={coche} onChange={() => setChoix(coche ? choix.filter((x) => x !== a.id) : [...choix, a.id])} />
                  <span className="truncate">{a.prenom}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-neutral-500">Les autres agents ne verront pas ce connecteur ; Léa leur confie ce qui en a besoin.</p>
          {erreur && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-red-700" role="alert">{erreur}</p>}
          <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
            <button type="button" disabled={envoi} onClick={() => enregistrer(null)} className="rounded-lg px-2 py-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50">Toute l'équipe</button>
            <button type="button" disabled={envoi || !choix.length} onClick={() => enregistrer(choix)}
              className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1 font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">
              {envoi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Studio › Rapport mensuel : la valeur produite par l'équipe d'agents, à garder ou partager.
import { useEffect, useState } from 'react';
import { Clock, Image as ImageIcon, MessageSquare, Pin, TrendingDown, TrendingUp } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel, minutesEnTexte } from '../api';
import { Avatar, Carte, Chargement, Titre, cx } from '../composants';
import BoutonsExport from '../BoutonsExport';
import { derniersMois, evolution, rapportEnMarkdown, type Rapport as R } from '../rapport';

function Kpi({ icone: I, titre, valeur, evol }: { icone: typeof Clock; titre: string; valeur: string; evol?: string }) {
  const negatif = evol?.startsWith('-');
  return (
    <Carte>
      <p className="flex items-center gap-2 text-sm text-neutral-500"><I className="h-4 w-4" /> {titre}</p>
      <p className="mt-2 text-3xl font-semibold">{valeur}</p>
      {evol && evol !== '—' && (
        <p className={cx('mt-1 flex items-center gap-1 text-xs', negatif ? 'text-red-600' : 'text-emerald-700')}>
          {negatif ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />} {evol} vs mois précédent
        </p>
      )}
    </Carte>
  );
}

export default function Rapport() {
  const { me, gerer } = useStudio();
  const mois = derniersMois();
  const [choix, setChoix] = useState(mois[0].valeur);
  const [r, setR] = useState<R | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    setR(null); setErreur('');
    appel<{ rapport: R }>('rapport', { mois: choix }).then((x) => setR(x.rapport)).catch((e) => setErreur(gerer(e)));
  }, [choix, gerer]);

  const maxMinutes = Math.max(1, ...(r?.par_agent.map((a) => a.minutes) ?? [1]));
  const agent = (id: string) => me.agents.find((a) => a.id === id);
  const nomEntreprise = me.workspace.nom.replace(/^Démo — /, '');

  return (
    <>
      <Titre sous="Ce que votre équipe d'agents a produit pour vous, mois par mois. À garder, ou à partager avec vos associés.">
        Rapport mensuel
      </Titre>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select value={choix} onChange={(e) => setChoix(e.target.value)} aria-label="Mois du rapport"
          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm capitalize outline-none focus:border-neutral-900">
          {mois.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
        </select>
        {r && r.missions > 0 && (
          <span className="ml-auto rounded-xl border border-neutral-200 bg-white px-1 py-0.5 text-neutral-500">
            <BoutonsExport source={{
              titre: `Rapport d'activité — ${r.libelle}`, contenu: rapportEnMarkdown(r, nomEntreprise),
              agent: "votre équipe d'agents IA", nomEspace: me.workspace.nom,
            }} />
          </span>
        )}
      </div>
      {erreur && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      {!r ? (!erreur && <Chargement />) : r.missions === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 py-14 text-center text-sm text-neutral-500">
          Aucune mission en {r.libelle}. Confiez une première mission à un agent : elle apparaîtra ici.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icone={Clock} titre="Temps gagné (estimation)" valeur={minutesEnTexte(r.minutes)} evol={evolution(r.minutes, r.precedent.minutes)} />
            <Kpi icone={MessageSquare} titre="Missions confiées" valeur={String(r.missions)} evol={evolution(r.missions, r.precedent.missions)} />
            <Kpi icone={Pin} titre="Contenus gardés" valeur={String(r.contenus_gardes)} />
            <Kpi icone={ImageIcon} titre="Visuels et vidéos" valeur={String(r.images + r.videos)} />
          </div>

          <Carte>
            <h2 className="mb-4 font-semibold">Votre équipe en {r.libelle}</h2>
            <div className="space-y-3">
              {r.par_agent.map((a) => {
                const ag = agent(a.agent_id);
                return (
                  <div key={a.agent_id} className="flex items-center gap-3">
                    <Avatar prenom={a.prenom} couleur={ag?.couleur ?? '#999'} photo={ag?.photo} taille={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-sm">
                        <span><b>{a.prenom}</b> <span className="text-neutral-500">· {a.metier}</span></span>
                        <span className="text-neutral-500">{a.missions} mission{a.missions > 1 ? 's' : ''} · {minutesEnTexte(a.minutes)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(4, (a.minutes / maxMinutes) * 100)}%`, background: ag?.couleur ?? '#f97316' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Carte>

          {r.exemples.length > 0 && (
            <Carte>
              <h2 className="mb-3 font-semibold">Quelques missions du mois</h2>
              <ul className="space-y-1.5 text-sm">
                {r.exemples.map((e, i) => <li key={i} className="flex gap-2"><span className="text-orange-500">•</span>{e.titre}{e.agent && <span className="text-neutral-400">({e.agent})</span>}</li>)}
              </ul>
            </Carte>
          )}
          <p className="text-xs text-neutral-500">
            Le temps gagné est une estimation : chaque réponse utile (non notée « à revoir ») compte pour la durée moyenne de la tâche correspondante.
          </p>
        </div>
      )}
    </>
  );
}

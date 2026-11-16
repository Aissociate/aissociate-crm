// « Journal » : tout ce que les agents et les utilisateurs ont fait dans l'espace.
// Le journal est chaîné (chaque ligne scelle la précédente) : il ne se modifie pas.
import { useEffect, useState } from 'react';
import { appel } from '../api';
import { Carte, Chargement, Titre } from '../composants';
import { useStudio } from '../StudioApp';
import { libelleAction, type LigneJournal } from '../journal';

export default function PageJournal() {
  const { me, gerer } = useStudio();
  const [lignes, setLignes] = useState<LigneJournal[] | null>(null);
  const [erreur, setErreur] = useState('');
  const prenoms = new Map(me.agents.map((a) => [a.id, a.prenom]));

  useEffect(() => {
    appel<{ lignes: LigneJournal[] }>('journal').then((r) => setLignes(r.lignes)).catch((e) => setErreur(gerer(e)));
  }, [gerer]);

  return (
    <div>
      <Titre sous="Chaque mission, validation, connexion ou suspension est tracée ici. Ce journal est scellé : personne ne peut le réécrire.">Journal</Titre>
      {erreur && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      {!lignes ? <Chargement /> : lignes.length === 0 ? (
        <Carte><p className="text-sm text-neutral-500">Rien pour l'instant : la première mission confiée à un agent apparaîtra ici.</p></Carte>
      ) : (
        <Carte className="p-0">
          <ul className="divide-y divide-neutral-100">
            {lignes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-3 text-sm">
                <span className="w-32 shrink-0 text-xs text-neutral-400">{new Date(l.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="font-medium">{libelleAction(l.action)}</span>
                {l.agent_id && <span className="text-neutral-500">· {prenoms.get(l.agent_id) ?? l.agent_id}</span>}
                {typeof l.detail?.titre === 'string' && <span className="min-w-0 flex-1 truncate text-neutral-600">« {l.detail.titre} »</span>}
                <span className="ml-auto text-xs text-neutral-400">{l.acteur.replace(/^client:/, '').replace(/^crm$/, 'Aissociate')}</span>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}

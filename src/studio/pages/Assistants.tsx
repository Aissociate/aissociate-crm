import { Link } from 'react-router-dom';
import { Clock, Zap } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { Avatar, Titre } from '../composants';

export default function Assistants() {
  const { me } = useStudio();
  return (
    <>
      <Titre sous="Chaque agent est spécialisé et connaît votre entreprise. Cliquez pour lui confier une mission.">Mes assistants</Titre>
      <div className="grid gap-4 md:grid-cols-2">
        {me.agents.map((a) => (
          <div key={a.id} className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {a.photo && (
              <div className="relative h-44 overflow-hidden" style={{ background: a.couleur }}>
                <img src={a.photo} alt={`${a.prenom}, ${a.metier}`} loading="lazy"
                  className="absolute bottom-0 left-1/2 h-[115%] -translate-x-1/2 object-cover object-top" />
              </div>
            )}
            <div className="flex flex-1 flex-col p-5">
            <div className="flex items-center gap-3">
              <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={52} />
              <div>
                <p className="text-lg font-semibold">{a.prenom}</p>
                <p className="text-sm text-neutral-500">{a.metier}</p>
              </div>
              <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> disponible
              </span>
            </div>
            <p className="mt-4 text-sm italic text-neutral-700">« {a.accroche} »</p>
            <p className="mt-2 text-sm text-neutral-500">{a.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {a.super_pouvoirs.map((p) => (
                <Link key={p.id} to={`/studio/assistants/${a.id}?p=${p.id}`}
                  className="flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700 hover:border-neutral-900">
                  <Zap className="h-3 w-3 text-orange-500" /> {p.titre}
                </Link>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between pt-5">
              <span className="flex items-center gap-1 text-xs text-neutral-400"><Clock className="h-3.5 w-3.5" /> ≈ {a.minutes_par_tache} min gagnées par mission</span>
              <Link to={`/studio/assistants/${a.id}`} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
                Discuter avec {a.prenom}
              </Link>
            </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

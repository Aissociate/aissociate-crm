import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUp, CheckCircle2, Circle, Clock, MessageSquare, FolderOpen } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { Avatar, Carte, cx } from '../composants';
import { minutesEnTexte } from '../api';

export default function Accueil() {
  const { me } = useStudio();
  const navigate = useNavigate();
  const [agentId, setAgentId] = useState(me.agents[0]?.id ?? '');
  const [demande, setDemande] = useState('');
  const agent = me.agents.find((a) => a.id === agentId);
  const s = me.stats;

  const lancer = (e: FormEvent) => {
    e.preventDefault();
    if (!demande.trim() || !agentId) return;
    navigate(`/studio/assistants/${agentId}`, { state: { message: demande.trim() } });
  };

  const etapes = [
    { fait: me.workspace.contexte_entreprise.trim().length > 50, label: 'Présenter votre entreprise à vos agents', to: '/studio/entreprise' },
    { fait: s.ressources_actives > 0, label: 'Ajouter une ressource (plaquette, offre, charte…)', to: '/studio/ressources' },
    { fait: s.minutes_gagnees_total > 0, label: 'Confier une première mission à un agent', to: '/studio/assistants' },
  ];
  const reste = etapes.filter((e) => !e.fait).length;
  const quotaPct = s.quota_mois ? Math.min(100, Math.round((s.demandes_mois / s.quota_mois) * 100)) : 0;

  return (
    <div className="space-y-8">
      <div className="pt-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Bonjour {me.user.prenom ?? ''}, que fait-on aujourd'hui&nbsp;?
        </h1>
        <p className="mt-2 text-neutral-500">Décrivez la mission, choisissez l'agent : il s'en occupe.</p>
      </div>

      <form onSubmit={lancer} className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
        <textarea
          value={demande} onChange={(e) => setDemande(e.target.value)} rows={3}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); lancer(e); } }}
          placeholder={agent?.demandes[0]?.prompt ?? 'Rédige 5 publications LinkedIn pour cette semaine…'}
          className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-neutral-400"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {me.agents.map((a) => (
              <button key={a.id} type="button" onClick={() => setAgentId(a.id)}
                className={cx('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  a.id === agentId ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50')}>
                <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={16} /> {a.prenom}
              </button>
            ))}
          </div>
          <button type="submit" aria-label="Envoyer" disabled={!demande.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white disabled:bg-neutral-300">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Carte>
          <div className="flex items-center gap-2 text-sm text-neutral-500"><Clock className="h-4 w-4" /> Temps gagné ce mois-ci</div>
          <p className="mt-2 text-3xl font-semibold">{minutesEnTexte(s.minutes_gagnees_mois)}</p>
          <p className="mt-1 text-xs text-neutral-500">{minutesEnTexte(s.minutes_gagnees_total)} depuis le début · estimation par mission utile</p>
        </Carte>
        <Carte>
          <div className="flex items-center gap-2 text-sm text-neutral-500"><MessageSquare className="h-4 w-4" /> Missions ce mois-ci</div>
          <p className="mt-2 text-3xl font-semibold">{s.demandes_mois}{s.quota_mois ? <span className="text-base font-normal text-neutral-400"> / {s.quota_mois}</span> : null}</p>
          {s.quota_mois ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div className={cx('h-full rounded-full', quotaPct > 85 ? 'bg-red-500' : 'bg-orange-500')} style={{ width: `${quotaPct}%` }} />
            </div>
          ) : <p className="mt-1 text-xs text-neutral-500">Sans limite</p>}
        </Carte>
        <Carte>
          <div className="flex items-center gap-2 text-sm text-neutral-500"><FolderOpen className="h-4 w-4" /> Ressources utilisées par vos agents</div>
          <p className="mt-2 text-3xl font-semibold">{s.ressources_actives}</p>
          <Link to="/studio/ressources" className="mt-1 inline-block text-xs text-neutral-500 underline">Gérer mes ressources</Link>
        </Carte>
      </div>

      {reste > 0 && (
        <Carte>
          <p className="font-medium">Bien démarrer — {3 - reste}/3</p>
          <p className="text-sm text-neutral-500">Plus vos agents connaissent votre entreprise, plus leurs réponses sont justes.</p>
          <ul className="mt-3 space-y-2">
            {etapes.map((e) => (
              <li key={e.label}>
                <Link to={e.to} className="flex items-center gap-2 text-sm hover:underline">
                  {e.fait ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-neutral-300" />}
                  <span className={e.fait ? 'text-neutral-400 line-through' : ''}>{e.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Mes assistants</h2>
          <Link to="/studio/assistants" className="text-sm text-neutral-500 hover:text-neutral-900">Tout voir</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {me.agents.map((a) => (
            <Link key={a.id} to={`/studio/assistants/${a.id}`}
              className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md">
              <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} />
              <div className="min-w-0">
                <p className="font-medium">{a.prenom} <span className="text-sm font-normal text-neutral-500">· {a.metier}</span></p>
                <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">{a.accroche}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {me.conversations.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Reprendre</h2>
          <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {me.conversations.map((c) => {
              const a = me.agents.find((x) => x.id === c.agent_id);
              return (
                <Link key={c.id} to={`/studio/assistants/${c.agent_id}?c=${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                  {a && <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={28} />}
                  <span className="min-w-0 flex-1 truncate text-sm">{c.titre}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{new Date(c.updated_at).toLocaleDateString('fr-FR')}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

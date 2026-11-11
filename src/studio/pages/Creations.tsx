import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, PinOff } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel } from '../api';
import { Avatar, Chargement, Markdown, Titre } from '../composants';

type Creation = { id: string; agent_id: string; content: string; created_at: string; conversation_id: string; titre: string };

export default function Creations() {
  const { me, gerer } = useStudio();
  const [liste, setListe] = useState<Creation[] | null>(null);
  const [filtre, setFiltre] = useState('');
  const [copie, setCopie] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    appel<{ creations: Creation[] }>('creations').then((r) => setListe(r.creations)).catch((e) => setErreur(gerer(e)));
  }, [gerer]);

  const retirer = async (id: string) => {
    setListe((l) => l?.filter((c) => c.id !== id) ?? null);
    try { await appel('epingler', { message_id: id, epingle: false }); } catch (e) { setErreur(gerer(e)); }
  };

  const visibles = (liste ?? []).filter((c) => !filtre || c.agent_id === filtre);

  return (
    <>
      <Titre sous="Les réponses que vous avez gardées (bouton « Garder » sous chaque réponse), partagées avec toute votre équipe.">Contenus</Titre>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setFiltre('')} className={`rounded-full border px-3 py-1 text-xs ${!filtre ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200'}`}>Tous</button>
        {me.agents.map((a) => (
          <button key={a.id} onClick={() => setFiltre(a.id)}
            className={`rounded-full border px-3 py-1 text-xs ${filtre === a.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200'}`}>{a.prenom}</button>
        ))}
      </div>
      {erreur && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      {liste === null ? <Chargement /> : visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 py-14 text-center text-sm text-neutral-500">
          Aucun contenu gardé pour l'instant.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibles.map((c) => {
            const a = me.agents.find((x) => x.id === c.agent_id);
            return (
              <article key={c.id} className="flex max-h-[28rem] flex-col rounded-2xl border border-neutral-200 bg-white">
                <header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                  {a && <Avatar prenom={a.prenom} couleur={a.couleur} taille={26} />}
                  <Link to={`/studio/assistants/${c.agent_id}?c=${c.conversation_id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{c.titre}</Link>
                  <span className="text-xs text-neutral-400">{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                </header>
                <div className="flex-1 overflow-y-auto px-4 py-3"><Markdown texte={c.content} /></div>
                <footer className="flex gap-1 border-t border-neutral-100 px-2 py-1.5 text-neutral-500">
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-neutral-100"
                    onClick={async () => { try { await navigator.clipboard.writeText(c.content); setCopie(c.id); setTimeout(() => setCopie(null), 1500); } catch { /* refusé */ } }}>
                    {copie === c.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copier
                  </button>
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-neutral-100" onClick={() => retirer(c.id)}>
                    <PinOff className="h-3.5 w-3.5" /> Retirer
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

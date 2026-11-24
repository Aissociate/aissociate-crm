import { useCallback, useEffect, useState } from 'react';
import MediaVue from '../MediaVue';
import { mediasDuMessage } from '../marqueursMedia';
import { Link } from 'react-router-dom';
import { Check, Copy, Download, PinOff, Pin, Trash2 } from 'lucide-react';
import { useStudio } from '../StudioApp';
import { appel } from '../api';
import { Avatar, Chargement, Markdown, Titre } from '../composants';
import EtatVide from '../composants/EtatVide';
import Confirmation from '../composants/Confirmation';
import BoutonsExport from '../BoutonsExport';
import { BarreDossiers, ChoixDossier, dansFiltre, useDossiers, type Filtre } from '../Dossiers';

type Creation = { id: string; agent_id: string; content: string; created_at: string; conversation_id: string; titre: string };
type MediaGalerie = { id: string; type: 'image' | 'video'; agent_id: string | null; prompt: string; url: string | null; created_at: string; conversation_id: string | null; dossier_id?: string | null; user_id?: string | null };

export default function Creations() {
  const { me, gerer } = useStudio();
  const [liste, setListe] = useState<Creation[] | null>(null);
  const [filtre, setFiltre] = useState('');
  const [copie, setCopie] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');

  const [medias, setMedias] = useState<MediaGalerie[]>([]);
  const dossiers = useDossiers(gerer);
  const [filtreDossier, setFiltreDossier] = useState<Filtre>('tous');

  const chargerMedias = useCallback(() => {
    appel<{ medias: MediaGalerie[] }>('medias').then((r) => setMedias(r.medias)).catch(() => { /* galerie facultative */ });
  }, []);
  useEffect(() => {
    appel<{ creations: Creation[] }>('creations').then((r) => setListe(r.creations)).catch((e) => setErreur(gerer(e)));
    chargerMedias();
  }, [gerer, chargerMedias]);

  /** Visuel ou vidéo à supprimer (confirmation), et suppression en cours. */
  const [aSupprimer, setASupprimer] = useState<MediaGalerie | null>(null);
  const [suppression, setSuppression] = useState(false);
  const supprimer = async () => {
    if (!aSupprimer) return;
    setSuppression(true);
    try {
      await appel('media_supprimer', { id: aSupprimer.id });
      setMedias((x) => x.filter((m) => m.id !== aSupprimer.id));
      void dossiers.charger();
    } catch (e) { setErreur(gerer(e)); }
    finally { setSuppression(false); setASupprimer(null); }
  };
  const peutSupprimer = (m: MediaGalerie) => me.user.role === 'proprietaire' || (m.user_id != null && m.user_id === me.user.id);

  const retirer = async (id: string) => {
    setListe((l) => l?.filter((c) => c.id !== id) ?? null);
    try { await appel('epingler', { message_id: id, epingle: false }); } catch (e) { setErreur(gerer(e)); }
  };

  // Les contenus gardés ne se rangent pas : un filtre de dossier n'affiche que les visuels.
  const visibles = filtreDossier === 'tous' ? (liste ?? []).filter((c) => !filtre || c.agent_id === filtre) : [];
  const mediasVisibles = medias.filter((m) => (!filtre || m.agent_id === filtre) && dansFiltre(dossiers.dossiers, filtreDossier, m.dossier_id));

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
      {medias.length > 0 && (
        <BarreDossiers dossiers={dossiers.dossiers} filtre={filtreDossier} onFiltre={setFiltreDossier} gerer={gerer}
          onChange={() => { void dossiers.charger(); chargerMedias(); }} />
      )}
      {erreur && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      {mediasVisibles.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold">Visuels et vidéos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {mediasVisibles.map((m) => m.url && (
              <figure key={m.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                {m.type === 'image'
                  ? <img src={m.url} alt={m.prompt.slice(0, 120)} className="aspect-square w-full object-cover" loading="lazy" />
                  : <video src={m.url} controls playsInline preload="metadata" className="aspect-square w-full bg-black object-cover" />}
                <figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-neutral-500">
                  <span>{new Date(m.created_at).toLocaleDateString('fr-FR')}</span>
                  <ChoixDossier options={dossiers.options} valeur={m.dossier_id ?? null} quoi="media" id={m.id} gerer={gerer}
                    onRange={(d) => { setMedias((x) => x.map((y) => (y.id === m.id ? { ...y, dossier_id: d } : y))); void dossiers.charger(); }} />
                  <a href={m.url} download target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-neutral-900">
                    <Download className="h-3.5 w-3.5" /> Télécharger
                  </a>
                  {peutSupprimer(m) && (
                    <button type="button" onClick={() => setASupprimer(m)} aria-label={m.type === 'video' ? 'Supprimer la vidéo' : 'Supprimer le visuel'}
                      className="inline-flex items-center gap-1 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer
                    </button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {liste === null ? <Chargement /> : visibles.length === 0 && mediasVisibles.length === 0 ? (
        <EtatVide
          icone={<Pin className="h-10 w-10" />}
          titre="Aucun contenu gardé pour l'instant"
          description="Sous chaque réponse d'agent, cliquez sur « Garder » pour épingler celles qui vous servent. Elles apparaîtront ici, partagées avec votre équipe."
        />
      ) : visibles.length === 0 ? null : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibles.map((c) => {
            const a = me.agents.find((x) => x.id === c.agent_id);
            return (
              <article key={c.id} className="flex max-h-[28rem] flex-col rounded-2xl border border-neutral-200 bg-white">
                <header className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                  {a && <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={26} />}
                  <Link to={`/studio/assistants/${c.agent_id}?c=${c.conversation_id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{c.titre}</Link>
                  <span className="text-xs text-neutral-400">{new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                </header>
                <div className="flex-1 overflow-y-auto px-4 py-3"><Markdown texte={c.content} />{mediasDuMessage(c.content).map((m) => <div key={m.id} className="mt-3"><MediaVue media={m} /></div>)}</div>
                <footer className="flex gap-1 border-t border-neutral-100 px-2 py-1.5 text-neutral-500">
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-neutral-100"
                    onClick={async () => { try { await navigator.clipboard.writeText(c.content); setCopie(c.id); setTimeout(() => setCopie(null), 1500); } catch { /* refusé */ } }}>
                    {copie === c.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copier
                  </button>
                  <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-neutral-100" onClick={() => retirer(c.id)}>
                    <PinOff className="h-3.5 w-3.5" /> Retirer
                  </button>
                  <BoutonsExport className="ml-auto" source={{
                    titre: c.titre, contenu: c.content, agent: a?.prenom ?? 'votre agent', date: c.created_at, nomEspace: me.workspace.nom,
                  }} />
                </footer>
              </article>
            );
          })}
        </div>
      )}
      <Confirmation
        ouvert={aSupprimer !== null}
        titre={aSupprimer?.type === 'video' ? 'Supprimer cette vidéo ?' : 'Supprimer ce visuel ?'}
        message="Le fichier est effacé définitivement : il disparaît de Contenus et des conversations où il apparaît. Pensez à le télécharger avant si vous voulez le garder."
        confirmer={{ label: 'Supprimer', danger: true, onClick: supprimer }}
        annuler={{ onClick: () => setASupprimer(null) }}
        enCours={suppression}
      />
    </>
  );
}

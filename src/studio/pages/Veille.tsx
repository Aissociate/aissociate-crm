// « Veille » : flux RSS suivis par l'espace et dernières actualités agrégées.
// Les agents y puisent (outil veille_actualites) pour rédiger articles et newsletters.
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Newspaper, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { appel } from '../api';
import { Bouton, Carte, Chargement, Interrupteur, Titre, cx } from '../composants';
import EtatVide from '../composants/EtatVide';
import { useStudio } from '../StudioApp';

type Flux = { id: string; url: string; titre: string; site: string | null; actif: boolean; derniere_lecture: string | null; erreur: string | null };
type Article = { id: string; source: string; titre: string; lien: string | null; date: string; resume: string };
type Etat = { flux: Flux[]; articles: Article[]; max: number };

const quand = (iso: string) => new Date(iso.length === 16 ? `${iso}:00Z` : iso)
  .toLocaleString('fr-FR', { timeZone: 'Indian/Reunion', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Veille() {
  const { gerer } = useStudio();
  const [e, setE] = useState<Etat | null>(null);
  const [url, setUrl] = useState('');
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [source, setSource] = useState<string>('');

  const agir = useCallback(async (action: string, donnees: Record<string, unknown> = {}, cle = action) => {
    setOccupe(cle); setErreur('');
    try { setE(await appel<Etat>(action, donnees)); return true; }
    catch (x) { setErreur(gerer(x)); return false; }
    finally { setOccupe(null); }
  }, [gerer]);
  useEffect(() => { void agir('flux'); }, [agir]);

  if (!e) return erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />;
  const articles = source ? e.articles.filter((a) => a.source === source) : e.articles;

  return (
    <div className="space-y-6">
      <Titre sous="Les flux RSS que vous suivez. Vos agents s'en servent pour vous résumer l'actualité, rédiger des articles ou préparer vos newsletters.">Veille</Titre>
      {erreur && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{erreur}</p>}

      <Carte>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (ev) => { ev.preventDefault(); if (await agir('flux_ajouter', { url }, 'ajout')) setUrl(''); }}>
          <input value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="Adresse d'un flux RSS ou d'un site (https://…)"
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm" />
          <Bouton type="submit" disabled={!url.trim() || occupe !== null || e.flux.length >= e.max}>
            {occupe === 'ajout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Suivre
          </Bouton>
        </form>
        <p className="mt-2 text-xs text-neutral-500">Collez l'adresse d'un site : son flux est trouvé automatiquement s'il en déclare un. {e.flux.length}/{e.max} flux.</p>

        {e.flux.length > 0 && (
          <ul className="mt-4 divide-y divide-neutral-100">
            {e.flux.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className={cx('truncate text-sm font-medium', !f.actif && 'text-neutral-400')}>{f.titre || f.url}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {f.erreur ? <span className="text-red-700">Erreur : {f.erreur}</span> : f.derniere_lecture ? `Lu le ${quand(f.derniere_lecture)}` : f.url}
                  </p>
                </div>
                <Interrupteur actif={f.actif} label={f.actif ? 'Mettre en pause' : 'Réactiver'} onChange={(v) => agir('flux_basculer', { id: f.id, actif: v }, f.id)} />
                <button title="Ne plus suivre" disabled={occupe !== null}
                  onClick={() => { if (confirm(`Ne plus suivre « ${f.titre || f.url} » ?`)) void agir('flux_supprimer', { id: f.id }, f.id); }}
                  className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {!e.flux.length ? (
        <EtatVide icone={<Newspaper className="h-10 w-10" />} titre="Aucun flux suivi"
          description="Ajoutez les sites d'actualité de votre secteur. Ensuite, demandez par exemple à un agent : « rédige un article avec les 3 meilleures news du jour », ou planifiez-le dans Tâches planifiées." />
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="mr-auto font-semibold">Actualités des 7 derniers jours <span className="font-normal text-neutral-500">({articles.length})</span></p>
            <select value={source} onChange={(ev) => setSource(ev.target.value)} className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-sm">
              <option value="">Toutes les sources</option>
              {[...new Set(e.articles.map((a) => a.source))].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Bouton variante="clair" disabled={occupe !== null} onClick={() => agir('flux_actualiser', {}, 'maj')}>
              <RefreshCw className={cx('h-4 w-4', occupe === 'maj' && 'animate-spin')} /> Actualiser
            </Bouton>
          </div>
          <div className="space-y-2">
            {articles.map((a) => (
              <Carte key={a.id} className="p-4">
                <p className="text-xs text-neutral-500">{a.source} · {quand(a.date)}</p>
                <p className="mt-0.5 font-medium">
                  {a.lien ? <a href={a.lien} target="_blank" rel="noreferrer noopener" className="hover:underline">{a.titre} <ExternalLink className="inline h-3 w-3 text-neutral-400" /></a> : a.titre}
                </p>
                {a.resume && <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{a.resume}</p>}
              </Carte>
            ))}
            {!articles.length && <p className="text-sm text-neutral-500">Rien de neuf sur cette période.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

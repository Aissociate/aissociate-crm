// « Calendrier » (Aujourd'hui › Calendrier) : calendrier par défaut de l'espace, sans agenda externe.
// Rappels posés par les agents (outil rappel_programmer) ou par l'utilisateur, prochains passages
// des routines et publications programmées sur les réseaux. Côté serveur : calendrier.ts.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Megaphone, Plus, Trash2, Workflow } from 'lucide-react';
import { appel } from '../api';
import { Avatar, Bouton, Carte, Chargement, Titre, cx } from '../composants';
import EtatVide from '../composants/EtatVide';
import { useStudio } from '../StudioApp';
import {
  DUREE_JOURS, decaler, enRetard, heure, jourReunion, libelleJour, libellePeriode, parJour,
  type EvenementCalendrier, type ReponseCalendrier,
} from '../calendrierVue';

const ICONES = { rappel: Bell, routine: Workflow, publication: Megaphone } as const;
const TYPES = { rappel: 'Rappel', routine: 'Routine', publication: 'Publication programmée' } as const;
const CL_CHAMP = 'w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none';

export default function PageCalendrier() {
  const { me, gerer } = useStudio();
  const [du, setDu] = useState(() => jourReunion(new Date()));
  const [rep, setRep] = useState<ReponseCalendrier | null>(null);
  const [erreur, setErreur] = useState('');
  const [ajout, setAjout] = useState(false);

  const charger = useCallback(() => {
    appel<ReponseCalendrier>('calendrier', { du, au: decaler(du, DUREE_JOURS - 1) })
      .then((r) => { setRep(r); setErreur(''); }).catch((e) => setErreur(gerer(e)));
  }, [du, gerer]);
  useEffect(() => { charger(); }, [charger]);

  const agent = (id: string | null) => (id ? me.agents.find((a) => a.id === id) : undefined);
  const agir = async (action: string, corps: Record<string, unknown>) => {
    try { await appel(action, corps); charger(); } catch (e) { setErreur(gerer(e)); }
  };
  const groupes = rep ? parJour(rep.evenements) : [];
  const auj = jourReunion(new Date());

  return (
    <div>
      <Titre sous="Les rappels posés par vos agents, les prochains passages de vos routines et les publications programmées. Heures de La Réunion.">Calendrier</Titre>

      {rep?.agenda && (
        <p className="mb-4 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          Votre agenda {rep.agenda.nom} est connecté : vos agents y proposent les rendez-vous{rep.agenda.a_reconnecter ? ' (il est à reconnecter dans Réglages et connecteurs)' : ''}.
          Ce calendrier garde ce que le Studio prévoit lui-même.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Bouton variante="clair" onClick={() => setDu(decaler(du, -DUREE_JOURS))} aria-label="Période précédente"><ChevronLeft className="h-4 w-4" /></Bouton>
        <Bouton variante="clair" onClick={() => setDu(auj)} disabled={du === auj}>Aujourd'hui</Bouton>
        <Bouton variante="clair" onClick={() => setDu(decaler(du, DUREE_JOURS))} aria-label="Période suivante"><ChevronRight className="h-4 w-4" /></Bouton>
        {rep && <span className="text-sm text-neutral-500">{libellePeriode(rep.du, rep.au)}</span>}
        <Bouton className="ml-auto" onClick={() => setAjout((v) => !v)} aria-expanded={ajout}><Plus className="h-4 w-4" /> Ajouter un rappel</Bouton>
      </div>

      {ajout && <NouveauRappel onFini={() => { setAjout(false); charger(); }} onErreur={setErreur} />}
      {erreur && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}

      {!rep ? (erreur ? null : <Chargement />) : groupes.length === 0 ? (
        <EtatVide
          icone={<CalendarDays className="h-10 w-10" />}
          titre="Rien de prévu sur cette période"
          description="Demandez à un agent de vous rappeler une relance ou une échéance : il la pose ici. Les routines et les publications programmées s'y ajoutent d'elles-mêmes."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groupes.map((g) => (
            <section key={g.jour} aria-labelledby={`jour-${g.jour}`}>
              <h2 id={`jour-${g.jour}`} className={cx('mb-2 text-sm font-semibold', g.jour === auj ? 'text-orange-600' : 'text-neutral-700')}>{libelleJour(g.jour)}</h2>
              <Carte className="p-0">
                <ul className="divide-y divide-neutral-100">
                  {g.evenements.map((e) => <Ligne key={e.id} e={e} agent={agent(e.agent_id)} agir={agir} />)}
                </ul>
              </Carte>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Ligne({ e, agent, agir }: {
  e: EvenementCalendrier; agent?: { prenom: string; couleur: string; photo?: string | null };
  agir: (action: string, corps: Record<string, unknown>) => Promise<void>;
}) {
  const Icone = ICONES[e.type];
  const retard = enRetard(e);
  return (
    <li className="flex items-start gap-3 px-5 py-3 text-sm">
      <span className="w-12 shrink-0 pt-0.5 font-medium tabular-nums text-neutral-500">{heure(e.quand)}</span>
      {e.type === 'rappel' ? (
        <input
          type="checkbox" checked={Boolean(e.fait)} onChange={(ev) => void agir('rappel_fait', { id: e.ref_id, fait: ev.target.checked })}
          className="mt-1 h-4 w-4 shrink-0 accent-neutral-900" aria-label={`Marquer « ${e.titre} » comme fait`}
        />
      ) : <Icone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />}
      <div className="min-w-0 flex-1">
        <p className={cx('font-medium', e.fait && 'text-neutral-400 line-through')}>
          <span className="sr-only">{TYPES[e.type]} : </span>
          {e.type === 'routine' && e.ref_id ? <Link to={`/studio/routines/${e.ref_id}`} className="hover:underline">{e.titre}</Link>
            : e.type === 'publication' ? <Link to="/studio/aujourdhui/livrables" className="hover:underline">{e.titre}</Link>
            : e.titre}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
          <span>{TYPES[e.type]}</span>
          {e.type === 'publication' && e.statut === 'a_valider' && <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700">À valider</span>}
          {retard && <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">En retard</span>}
        </p>
        {e.note && <p className="mt-1 whitespace-pre-line text-neutral-600">{e.note}</p>}
      </div>
      {agent && (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-500">
          <Avatar prenom={agent.prenom} couleur={agent.couleur} photo={agent.photo} taille={22} />
          <span className="hidden sm:inline">{agent.prenom}</span>
        </span>
      )}
      {e.type === 'rappel' && (
        <button
          type="button" onClick={() => { if (window.confirm(`Supprimer le rappel « ${e.titre} » ?`)) void agir('rappel_supprimer', { id: e.ref_id }); }}
          className="shrink-0 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={`Supprimer le rappel « ${e.titre} »`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function NouveauRappel({ onFini, onErreur }: { onFini: () => void; onErreur: (m: string) => void }) {
  const { gerer } = useStudio();
  const [titre, setTitre] = useState('');
  const [jour, setJour] = useState(() => decaler(jourReunion(new Date()), 1));
  const [h, setH] = useState('09:00');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const valider = async (ev: FormEvent) => {
    ev.preventDefault();
    setEnvoi(true);
    try { await appel('rappel_creer', { titre, quand: `${jour}T${h}`, note }); onFini(); }
    catch (e) { onErreur(gerer(e)); }
    finally { setEnvoi(false); }
  };

  return (
    <Carte className="mb-4">
      <form onSubmit={(ev) => void valider(ev)} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="text-sm sm:col-span-3">
          <span className="mb-1 block font-medium">Rappel</span>
          <input className={CL_CHAMP} value={titre} onChange={(ev) => setTitre(ev.target.value)} maxLength={200} required placeholder="Relancer le devis Dupont" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Jour</span>
          <input type="date" className={CL_CHAMP} value={jour} onChange={(ev) => setJour(ev.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Heure</span>
          <input type="time" className={CL_CHAMP} value={h} onChange={(ev) => setH(ev.target.value)} required />
        </label>
        <label className="text-sm sm:col-span-3">
          <span className="mb-1 block font-medium">Note <span className="font-normal text-neutral-500">(facultatif)</span></span>
          <textarea className={CL_CHAMP} rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={2000} />
        </label>
        <div className="sm:col-span-3"><Bouton type="submit" disabled={envoi || !titre.trim()}>{envoi ? 'Enregistrement…' : 'Poser le rappel'}</Bouton></div>
      </form>
    </Carte>
  );
}

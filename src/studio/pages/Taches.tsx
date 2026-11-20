// « Tâches planifiées » : une consigne confiée à un agent, rejouée automatiquement
// aux jours et heures choisis (heure de La Réunion). Les propositions de l'agent
// (réponses, publications, e-mails) arrivent dans les Livrables, à valider.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, Play, Pencil, Trash2, Loader2 } from 'lucide-react';
import { appel } from '../api';
import { Bouton, Carte, Chargement, Interrupteur, Markdown, Titre, cx } from '../composants';
import EtatVide from '../composants/EtatVide';
import { useStudio } from '../StudioApp';

type Tache = {
  id: string; titre: string; agent_id: string; consigne: string; heures: number[]; jours: number[]; actif: boolean;
  prochaine_execution: string | null; derniere_execution: string | null; dernier_statut: 'ok' | 'erreur' | null;
  dernier_compte_rendu: string | null; conversation_id: string | null; planning: string; en_cours: boolean;
};
type Modele = { id: string; titre: string; consigne: string; heures: readonly number[]; jours: readonly number[]; agent?: string };
type Reponse = { taches: Tache[]; modeles: Modele[] };
type Brouillon = { id?: string; titre: string; agent_id: string; consigne: string; heures: number[]; jours: number[]; actif: boolean };

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HEURES = Array.from({ length: 17 }, (_, i) => i + 6); // 6 h → 22 h

const date = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Indian/Reunion', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

export default function Taches() {
  const { me, gerer } = useStudio();
  const proprio = me.user.role === 'proprietaire';
  const [r, setR] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState('');
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const prenoms = new Map(me.agents.map((a) => [a.id, a.prenom]));

  const charger = useCallback(() => appel<Reponse>('taches').then(setR).catch((e) => setErreur(gerer(e))), [gerer]);
  useEffect(() => { charger(); }, [charger]);
  // Une tâche tourne : on rafraîchit jusqu'à la fin.
  useEffect(() => {
    if (!r?.taches.some((t) => t.en_cours)) return;
    const id = setInterval(charger, 5000);
    return () => clearInterval(id);
  }, [r, charger]);

  const agir = async (action: string, donnees: Record<string, unknown>) => {
    setOccupe(true); setErreur('');
    try { setR(await appel<Reponse>(action, donnees)); return true; }
    catch (e) { setErreur(gerer(e)); return false; }
    finally { setOccupe(false); }
  };

  const nouveau = (m?: Modele) => setBrouillon({
    titre: m?.titre ?? '', consigne: m?.consigne ?? '',
    // Modèle propre à un agent (ex. point comptable → Théo) : présélectionné s'il fait partie de l'équipe.
    agent_id: (m?.agent && me.agents.some((a) => a.id === m.agent) ? m.agent : me.agents[0]?.id) ?? '',
    heures: [...(m?.heures ?? [9])], jours: [...(m?.jours ?? [1, 2, 3, 4, 5])], actif: true,
  });

  if (!r) return erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />;

  return (
    <div className="space-y-6">
      <Titre sous="Vos agents travaillent seuls aux heures choisies (heure de La Réunion). Tout ce qu'ils préparent attend votre validation dans les Livrables.">
        Tâches planifiées
      </Titre>
      {erreur && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{erreur}</p>}

      {brouillon ? (
        <Formulaire b={brouillon} setB={setBrouillon} occupe={occupe} agents={me.agents.map((a) => ({ id: a.id, prenom: a.prenom, metier: a.metier }))}
          onAnnuler={() => setBrouillon(null)}
          onEnregistrer={async () => { if (await agir('tache_enregistrer', brouillon)) setBrouillon(null); }} />
      ) : proprio && (
        <Carte>
          <p className="mb-3 font-semibold">Nouvelle tâche</p>
          <div className="flex flex-wrap gap-2">
            {r.modeles.map((m) => (
              <Bouton key={m.id} variante="clair" onClick={() => nouveau(m)}>{m.titre}</Bouton>
            ))}
            <Bouton variante="fantome" onClick={() => nouveau()}>Tâche libre…</Bouton>
          </div>
        </Carte>
      )}

      {!r.taches.length ? (
        <EtatVide icone={<AlarmClock className="h-10 w-10" />} titre="Aucune tâche planifiée"
          description={proprio ? 'Choisissez un modèle ci-dessus : par exemple, vérifier vos messages privés trois fois par jour et préparer les réponses.' : 'Le propriétaire de l\'espace peut en créer.'} />
      ) : (
        <div className="space-y-3">
          {r.taches.map((t) => (
            <Carte key={t.id} className={cx(!t.actif && 'opacity-70')}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.titre} <span className="font-normal text-neutral-500">· {prenoms.get(t.agent_id) ?? t.agent_id}</span></p>
                  <p className="text-sm text-neutral-600">{t.planning}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {t.en_cours ? <span className="inline-flex items-center gap-1 text-amber-700"><Loader2 className="h-3 w-3 animate-spin" /> En cours…</span>
                      : t.actif ? <>Prochain passage : {date(t.prochaine_execution)}</> : 'En pause'}
                    {t.derniere_execution && <> · Dernier : {date(t.derniere_execution)}{' '}
                      <span className={t.dernier_statut === 'ok' ? 'text-emerald-700' : 'text-red-700'}>{t.dernier_statut === 'ok' ? '✓' : 'échec'}</span></>}
                  </p>
                </div>
                {proprio && (
                  <div className="flex items-center gap-1">
                    <Interrupteur actif={t.actif} label={t.actif ? 'Mettre en pause' : 'Activer'}
                      onChange={(v) => agir('tache_enregistrer', { ...t, actif: v })} />
                    <button title="Lancer maintenant" disabled={occupe || t.en_cours} onClick={() => agir('tache_lancer', { id: t.id })}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"><Play className="h-4 w-4" /></button>
                    <button title="Modifier" onClick={() => setBrouillon({ id: t.id, titre: t.titre, agent_id: t.agent_id, consigne: t.consigne, heures: t.heures, jours: t.jours, actif: t.actif })}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><Pencil className="h-4 w-4" /></button>
                    <button title="Supprimer" disabled={occupe}
                      onClick={() => { if (confirm(`Supprimer la tâche « ${t.titre} » ?`)) agir('tache_supprimer', { id: t.id }); }}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              {t.dernier_compte_rendu && (
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <button className="text-xs font-medium text-neutral-500 hover:text-neutral-900" onClick={() => setOuvert(ouvert === t.id ? null : t.id)}>
                    {ouvert === t.id ? 'Masquer le compte rendu' : 'Voir le dernier compte rendu'}
                  </button>
                  {ouvert === t.id && (
                    <div className="mt-2 text-sm">
                      <Markdown texte={t.dernier_compte_rendu} />
                      <div className="mt-2 flex gap-4 text-xs">
                        <Link to="/studio/livrables" className="font-medium text-orange-600 hover:underline">Voir les livrables à valider</Link>
                        {t.conversation_id && <Link to={`/studio/assistants/${t.agent_id}?c=${t.conversation_id}`} className="text-neutral-500 hover:underline">Historique de la tâche</Link>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}

function Formulaire({ b, setB, occupe, agents, onAnnuler, onEnregistrer }: {
  b: Brouillon; setB: (b: Brouillon) => void; occupe: boolean; agents: { id: string; prenom: string; metier: string }[];
  onAnnuler: () => void; onEnregistrer: () => void;
}) {
  const bascule = (liste: number[], v: number) => (liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]).sort((x, y) => x - y);
  const puce = (actif: boolean) => cx('rounded-lg border px-2.5 py-1 text-sm transition-colors', actif ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:bg-neutral-50');
  return (
    <Carte>
      <p className="mb-4 font-semibold">{b.id ? 'Modifier la tâche' : 'Nouvelle tâche'}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-neutral-600">Titre</span>
          <input value={b.titre} maxLength={120} onChange={(e) => setB({ ...b, titre: e.target.value })}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900" />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-600">Agent</span>
          <select value={b.agent_id} onChange={(e) => setB({ ...b, agent_id: e.target.value })}
            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2">
            {agents.map((a) => <option key={a.id} value={a.id}>{a.prenom} — {a.metier}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-4 block text-sm">
        <span className="text-neutral-600">Consigne</span>
        <textarea value={b.consigne} maxLength={4000} rows={4} onChange={(e) => setB({ ...b, consigne: e.target.value })}
          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900" />
      </label>
      <p className="mt-4 text-sm text-neutral-600">Jours</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {JOURS.map((j, i) => <button key={j} type="button" className={puce(b.jours.includes(i + 1))} onClick={() => setB({ ...b, jours: bascule(b.jours, i + 1) })}>{j}</button>)}
      </div>
      <p className="mt-4 text-sm text-neutral-600">Heures (La Réunion)</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {HEURES.map((h) => <button key={h} type="button" className={puce(b.heures.includes(h))} onClick={() => setB({ ...b, heures: bascule(b.heures, h) })}>{h} h</button>)}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Bouton variante="fantome" onClick={onAnnuler}>Annuler</Bouton>
        <Bouton disabled={occupe || !b.titre.trim() || !b.consigne.trim() || !b.jours.length || !b.heures.length} onClick={onEnregistrer}>
          {occupe && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
        </Bouton>
      </div>
    </Carte>
  );
}

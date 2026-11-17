// « Livrables » : réponses soumises à validation. Rien ne sort sans le
// « VALIDÉ » du propriétaire de l'espace (a_valider → validé / refusé → publié).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, History, Pencil, RotateCcw, Send, X } from 'lucide-react';
import { appel } from '../api';
import BoutonsExport from '../BoutonsExport';
import { Avatar, Bouton, Carte, Chargement, Markdown, Titre, cx } from '../composants';
import EtatVide from '../composants/EtatVide';
import Confirmation from '../composants/Confirmation';
import { useStudio } from '../StudioApp';
import EditeurLivrable, { champsDepuis, type ActionLivrable } from '../EditeurLivrable';

type Livrable = {
  id: string; titre: string; contenu: string; statut: 'a_valider' | 'valide' | 'refuse' | 'publie';
  agent_id: string | null; conversation_id: string | null; soumis_par: string | null;
  decide_par: string | null; decide_le: string | null; commentaire: string | null; created_at: string;
  /** Action exécutée au « VALIDÉ » (ex. dépôt d'un document dans le Drive). */
  type_action?: string | null;
  resultat?: { lien?: string | null; erreur?: string } | null;
  action?: ActionLivrable | null;
  /** Versions précédentes, la plus récente d'abord. */
  versions?: { titre: string; contenu: string; action: ActionLivrable | null; par: string; le: string }[];
};

const ACTIONS: Record<string, { avant: string; fait: string; lien: string }> = {
  drive_creer_document: { avant: 'Création dans votre Drive / OneDrive au « VALIDÉ »', fait: 'Document créé dans votre espace de fichiers.', lien: 'Ouvrir le document' },
  gmail_envoyer: { avant: 'Envoi depuis votre messagerie au « VALIDÉ »', fait: 'E-mail envoyé depuis votre messagerie.', lien: 'Voir l\'e-mail' },
  reseaux_publier: { avant: 'Publication sur vos réseaux sociaux au « VALIDÉ » (ou à la date programmée)', fait: 'Publication envoyée (ou programmée) sur vos réseaux sociaux.', lien: 'Voir la publication' },
  reseaux_repondre_commentaire: { avant: 'Réponse publiée sous le commentaire au « VALIDÉ »', fait: 'Réponse publiée.', lien: 'Voir' },
  reseaux_envoyer_message: { avant: 'Message privé envoyé au « VALIDÉ »', fait: 'Message envoyé.', lien: 'Voir' },
  mailing_envoyer: { avant: 'Envoi depuis votre messagerie aux abonnés au « VALIDÉ » (un e-mail chacun, 45 par heure au plus ; suivi dans Contacts)', fait: 'Mailing mis en file : les envois partent par lots depuis votre messagerie (suivi dans Contacts).', lien: 'Voir' },
  agenda_creer: { avant: 'Création dans votre agenda (et invitations) au « VALIDÉ »', fait: 'Rendez-vous créé dans votre agenda, invitations envoyées.', lien: 'Ouvrir le rendez-vous' },
};

const STATUTS: Record<Livrable['statut'], { label: string; style: string }> = {
  a_valider: { label: 'À valider', style: 'bg-amber-50 text-amber-800' },
  valide: { label: 'Validé', style: 'bg-emerald-50 text-emerald-700' },
  refuse: { label: 'Refusé', style: 'bg-red-50 text-red-700' },
  publie: { label: 'Publié', style: 'bg-neutral-900 text-white' },
};
const FILTRES = ['a_valider', 'valide', 'refuse', 'publie'] as const;

export default function PageLivrables() {
  const { me, gerer, rafraichir } = useStudio();
  const [livrables, setLivrables] = useState<Livrable[] | null>(null);
  const [filtre, setFiltre] = useState<Livrable['statut'] | 'tous'>('a_valider');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');
  const [edition, setEdition] = useState<string | null>(null);
  const [historique, setHistorique] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ action: 'refuser'; id: string } | null>(null);
  const [envoiConfirm, setEnvoiConfirm] = useState(false);
  const proprietaire = me.user.role === 'proprietaire';
  const agents = new Map(me.agents.map((a) => [a.id, a]));

  const charger = useCallback(() => appel<{ livrables: Livrable[] }>('livrables').then((r) => setLivrables(r.livrables)).catch((e) => setErreur(gerer(e))), [gerer]);
  useEffect(() => { charger(); }, [charger]);

  const deciderDirect = async (id: string, statut: Livrable['statut']) => {
    try {
      const r = await appel<{ livrables: Livrable[]; execute?: boolean; lien?: string | null; erreur_action?: string }>('livrable_decider', { id, statut, commentaire });
      setLivrables(r.livrables); setCommentaire(''); setErreur(''); rafraichir();
      const type = r.livrables.find((x) => x.id === id)?.type_action;
      if (r.execute) setInfo((type && ACTIONS[type]?.fait) || 'Action exécutée.');
      else if (r.erreur_action) setErreur(`Validé, mais le dépôt a échoué : ${r.erreur_action}`);
      else setInfo('');
    } catch (e) { setErreur(gerer(e)); }
  };

  const decider = async (id: string, statut: Livrable['statut']) => {
    if (statut === 'refuse' && !commentaire.trim()) {
      setConfirmation({ action: 'refuser', id });
      return;
    }
    await deciderDirect(id, statut);
  };

  /** Restaurer une ancienne version : elle devient la version actuelle (l'actuelle est conservée). */
  // Note : laissée sur window.confirm volontairement (geste bas risque, l'actuelle est préservée).
  const restaurer = async (l: Livrable, k: number) => {
    const v = l.versions?.[k];
    if (!v || !confirm(`Revenir à la version du ${new Date(v.le).toLocaleString('fr-FR')} ? La version actuelle reste dans l'historique.`)) return;
    try {
      const r = await appel<{ livrables: Livrable[] }>('livrable_modifier', { id: l.id, champs: champsDepuis(v.titre, v.contenu, v.action) });
      setLivrables(r.livrables); setInfo('Version restaurée : le livrable repasse « à valider ».'); setErreur(''); rafraichir();
    } catch (e) { setErreur(gerer(e)); }
  };

  if (!livrables) return erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />;
  const visibles = livrables.filter((l) => filtre === 'tous' || l.statut === filtre);
  const compte = (s: Livrable['statut']) => livrables.filter((l) => l.statut === s).length;

  return (
    <div>
      <Titre sous={proprietaire
        ? 'Vos agents préparent, vous décidez : rien n\'est envoyé ni publié sans votre validation.'
        : 'Les livrables que vous soumettez sont validés par le propriétaire de l\'espace.'}>Livrables</Titre>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTRES.map((s) => (
          <button key={s} onClick={() => setFiltre(s)}
            className={cx('rounded-full border px-3 py-1 text-sm', filtre === s ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white')}>
            {STATUTS[s].label} <span className="opacity-60">{compte(s)}</span>
          </button>
        ))}
        <button onClick={() => setFiltre('tous')}
          className={cx('rounded-full border px-3 py-1 text-sm', filtre === 'tous' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white')}>Tous</button>
      </div>
      {erreur && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
      {info && <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>}

      {visibles.length === 0 ? (
        <EtatVide
          icone={<Check className="h-10 w-10" />}
          titre={filtre === 'a_valider' ? 'Aucun livrable à valider' : 'Aucun livrable dans cette vue'}
          description={filtre === 'a_valider'
            ? 'Bravo, tout est à jour. Dans une conversation, cliquez sur « Soumettre à validation » sous une réponse d\'agent pour en ajouter.'
            : 'Changez de filtre pour voir les livrables dans d\'autres statuts.'}
        />
      ) : (
        <div className="space-y-3">
          {visibles.map((l) => {
            const a = l.agent_id ? agents.get(l.agent_id) : undefined;
            const deplie = ouvert === l.id;
            return (
              <Carte key={l.id} className="p-0">
                <button onClick={() => { setOuvert(deplie ? null : l.id); setCommentaire(''); setEdition(null); setHistorique(null); }} className="flex w-full items-center gap-3 p-4 text-left">
                  {a && <Avatar prenom={a.prenom} couleur={a.couleur} photo={a.photo} taille={32} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.titre}</p>
                    <p className="text-xs text-neutral-500">
                      {a?.prenom ?? 'Agent'} · soumis le {new Date(l.created_at).toLocaleDateString('fr-FR')}
                      {l.decide_le && ` · décidé le ${new Date(l.decide_le).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                  <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUTS[l.statut].style)}>{STATUTS[l.statut].label}</span>
                </button>
                {deplie && (
                  <div className="border-t border-neutral-100 p-4">
                    {l.type_action && (
                      <div className="mb-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                        <p className="font-medium">{ACTIONS[l.type_action]?.avant ?? l.type_action}</p>
                        {l.resultat?.lien && <a href={l.resultat.lien} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 underline"><ExternalLink className="h-3.5 w-3.5" /> {ACTIONS[l.type_action]?.lien ?? 'Ouvrir'}</a>}
                        {l.resultat?.erreur && <p className="mt-1 text-red-700">Dépôt échoué : {l.resultat.erreur}</p>}
                      </div>
                    )}
                    {edition === l.id ? (
                      <EditeurLivrable<Livrable> id={l.id} titre={l.titre} contenu={l.contenu} action={l.action} gerer={gerer}
                        onCancel={() => setEdition(null)}
                        onSaved={(liste) => { setLivrables(liste); setEdition(null); setErreur(''); setInfo('Version enregistrée : le livrable est « à valider ».'); setFiltre('a_valider'); rafraichir(); }} />
                    ) : (
                      <div className="max-h-[28rem] overflow-y-auto rounded-xl bg-neutral-50 p-4"><Markdown texte={l.contenu} /></div>
                    )}
                    {historique === l.id && l.versions?.length ? (
                      <div className="mt-3 rounded-xl border border-neutral-200 p-3">
                        <p className="mb-2 text-sm font-medium">Versions précédentes</p>
                        <ul className="space-y-2">
                          {l.versions.map((v, k) => (
                            <li key={k} className="rounded-lg bg-neutral-50 p-2 text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-neutral-500">{new Date(v.le).toLocaleString('fr-FR')} · remplacée par {v.par.replace(/^client:/, '')}</span>
                                {l.statut !== 'publie' && <button onClick={() => restaurer(l, k)} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs text-orange-600 hover:bg-orange-50"><RotateCcw className="h-3 w-3" /> Restaurer</button>}
                              </div>
                              <details className="mt-1"><summary className="cursor-pointer text-xs text-neutral-600">{v.titre}</summary>
                                <div className="mt-2 max-h-64 overflow-y-auto"><Markdown texte={v.contenu} /></div>
                              </details>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {l.commentaire && <p className="mt-3 text-sm text-neutral-600"><span className="font-medium">Commentaire :</span> {l.commentaire}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {l.statut !== 'publie' && edition !== l.id && (
                        <Bouton variante="clair" className="px-3 py-1.5" onClick={() => { setEdition(l.id); setHistorique(null); }}><Pencil className="h-4 w-4" /> Modifier</Bouton>
                      )}
                      {l.versions?.length ? (
                        <button onClick={() => setHistorique(historique === l.id ? null : l.id)} className="flex items-center gap-1 rounded-lg p-1.5 text-xs text-neutral-500 hover:bg-neutral-100">
                          <History className="h-3.5 w-3.5" /> {l.versions.length} version{l.versions.length > 1 ? 's' : ''} précédente{l.versions.length > 1 ? 's' : ''}
                        </button>
                      ) : null}
                      <BoutonsExport source={{ titre: l.titre, contenu: l.contenu, agent: a?.prenom ?? 'Agent', date: l.created_at, nomEspace: me.workspace.nom }} />
                      {l.conversation_id && a && (
                        <Link to={`/studio/assistants/${a.id}?c=${l.conversation_id}`} className="flex items-center gap-1 rounded-lg p-1.5 text-xs text-neutral-500 hover:bg-neutral-100">
                          <ExternalLink className="h-3.5 w-3.5" /> Conversation
                        </Link>
                      )}
                    </div>
                    {proprietaire && l.statut !== 'publie' && edition !== l.id && (
                      <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
                        {l.statut === 'a_valider' && (
                          <textarea rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Commentaire (facultatif)"
                            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:bg-white" />
                        )}
                        <div className="flex flex-wrap gap-2">
                          {l.statut === 'a_valider' && <>
                            <Bouton onClick={() => decider(l.id, 'valide')}><Check className="h-4 w-4" /> VALIDÉ</Bouton>
                            <Bouton variante="clair" onClick={() => decider(l.id, 'refuse')}><X className="h-4 w-4" /> Refuser</Bouton>
                          </>}
                          {l.statut === 'valide' && <>
                            {l.type_action
                              ? <Bouton onClick={async () => { await decider(l.id, 'a_valider'); await decider(l.id, 'valide'); }}><RotateCcw className="h-4 w-4" /> Réessayer le dépôt</Bouton>
                              : <Bouton onClick={() => decider(l.id, 'publie')}><Send className="h-4 w-4" /> Marquer comme publié</Bouton>}
                            <Bouton variante="fantome" onClick={() => decider(l.id, 'a_valider')}><RotateCcw className="h-4 w-4" /> Revoir</Bouton>
                          </>}
                          {l.statut === 'refuse' && <Bouton variante="clair" onClick={() => decider(l.id, 'a_valider')}><RotateCcw className="h-4 w-4" /> Remettre à valider</Bouton>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Carte>
            );
          })}
        </div>
      )}
      <Confirmation
        ouvert={confirmation?.action === 'refuser'}
        titre="Refuser sans commentaire ?"
        message="Un mot aide l'agent à mieux faire la prochaine fois. Vous pouvez aussi ajouter un commentaire dans le champ, puis refuser à nouveau."
        confirmer={{
          label: 'Refuser quand même',
          danger: true,
          onClick: async () => {
            if (!confirmation) return;
            setEnvoiConfirm(true);
            try { await deciderDirect(confirmation.id, 'refuse'); } finally { setEnvoiConfirm(false); setConfirmation(null); }
          },
        }}
        annuler={{ onClick: () => setConfirmation(null) }}
        enCours={envoiConfirm}
      />
    </div>
  );
}

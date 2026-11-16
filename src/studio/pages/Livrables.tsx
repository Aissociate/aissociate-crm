// « Livrables » : réponses soumises à validation. Rien ne sort sans le
// « VALIDÉ » du propriétaire de l'espace (a_valider → validé / refusé → publié).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, RotateCcw, Send, X } from 'lucide-react';
import { appel } from '../api';
import BoutonsExport from '../BoutonsExport';
import { Avatar, Bouton, Carte, Chargement, Markdown, Titre, cx } from '../composants';
import { useStudio } from '../StudioApp';

type Livrable = {
  id: string; titre: string; contenu: string; statut: 'a_valider' | 'valide' | 'refuse' | 'publie';
  agent_id: string | null; conversation_id: string | null; soumis_par: string | null;
  decide_par: string | null; decide_le: string | null; commentaire: string | null; created_at: string;
  /** Action exécutée au « VALIDÉ » (ex. dépôt d'un document dans le Drive). */
  type_action?: string | null;
  resultat?: { lien?: string | null; erreur?: string } | null;
};

const ACTIONS: Record<string, { avant: string; fait: string; lien: string }> = {
  drive_creer_document: { avant: 'Création dans le Google Drive au « VALIDÉ »', fait: 'Document créé dans le Google Drive.', lien: 'Ouvrir le document' },
  gmail_envoyer: { avant: 'Envoi depuis votre Gmail au « VALIDÉ »', fait: 'E-mail envoyé depuis votre Gmail.', lien: 'Voir dans Gmail' },
  agenda_creer: { avant: 'Création dans votre agenda Google (et invitations) au « VALIDÉ »', fait: 'Rendez-vous créé dans votre agenda, invitations envoyées.', lien: 'Ouvrir le rendez-vous' },
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
  const proprietaire = me.user.role === 'proprietaire';
  const agents = new Map(me.agents.map((a) => [a.id, a]));

  const charger = useCallback(() => appel<{ livrables: Livrable[] }>('livrables').then((r) => setLivrables(r.livrables)).catch((e) => setErreur(gerer(e))), [gerer]);
  useEffect(() => { charger(); }, [charger]);

  const decider = async (id: string, statut: Livrable['statut']) => {
    if (statut === 'refuse' && !commentaire.trim() && !confirm('Refuser sans dire pourquoi ? Un mot aide l\'agent à mieux faire la prochaine fois.')) return;
    try {
      const r = await appel<{ livrables: Livrable[]; execute?: boolean; lien?: string | null; erreur_action?: string }>('livrable_decider', { id, statut, commentaire });
      setLivrables(r.livrables); setCommentaire(''); setErreur(''); rafraichir();
      const type = r.livrables.find((x) => x.id === id)?.type_action;
      if (r.execute) setInfo((type && ACTIONS[type]?.fait) || 'Action exécutée.');
      else if (r.erreur_action) setErreur(`Validé, mais le dépôt a échoué : ${r.erreur_action}`);
      else setInfo('');
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
        <Carte><p className="text-sm text-neutral-500">
          Aucun livrable ici. Dans une conversation, cliquez sur « Soumettre à validation » sous une réponse d'agent.
        </p></Carte>
      ) : (
        <div className="space-y-3">
          {visibles.map((l) => {
            const a = l.agent_id ? agents.get(l.agent_id) : undefined;
            const deplie = ouvert === l.id;
            return (
              <Carte key={l.id} className="p-0">
                <button onClick={() => { setOuvert(deplie ? null : l.id); setCommentaire(''); }} className="flex w-full items-center gap-3 p-4 text-left">
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
                    <div className="max-h-[28rem] overflow-y-auto rounded-xl bg-neutral-50 p-4"><Markdown texte={l.contenu} /></div>
                    {l.commentaire && <p className="mt-3 text-sm text-neutral-600"><span className="font-medium">Commentaire :</span> {l.commentaire}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <BoutonsExport source={{ titre: l.titre, contenu: l.contenu, agent: a?.prenom ?? 'Agent', date: l.created_at, nomEspace: me.workspace.nom }} />
                      {l.conversation_id && a && (
                        <Link to={`/studio/assistants/${a.id}?c=${l.conversation_id}`} className="flex items-center gap-1 rounded-lg p-1.5 text-xs text-neutral-500 hover:bg-neutral-100">
                          <ExternalLink className="h-3.5 w-3.5" /> Conversation
                        </Link>
                      )}
                    </div>
                    {proprietaire && l.statut !== 'publie' && (
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
    </div>
  );
}

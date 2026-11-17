// « Par e-mail » : l'adresse de liaison de l'espace, le mode d'emploi et les
// derniers e-mails reçus. Les utilisateurs de l'espace écrivent à cette adresse,
// l'agent répond dans le même fil ; rien ne part vers un tiers sans validation.
import { useEffect, useState } from 'react';
import { Check, Copy, Mail, MailOpen } from 'lucide-react';
import { appel } from '../api';
import { Carte, Chargement, Titre, cx } from '../composants';
import EtatVide from '../composants/EtatVide';
import { useStudio } from '../StudioApp';

type Instruction = {
  reference: string; sujet: string; type: string; statut: 'recue' | 'traitee' | 'quarantaine' | 'ignoree' | 'erreur';
  motif: string | null; agent_id: string | null; created_at: string; expediteur?: string;
};
type Liaison = { disponible: boolean; email: string | null; actif: boolean; agent: string | null; instructions: Instruction[] };

const STATUTS: Record<Instruction['statut'], [string, string]> = {
  recue: ['En cours', 'bg-amber-50 text-amber-800'], traitee: ['Traité', 'bg-emerald-50 text-emerald-700'],
  quarantaine: ['Bloqué', 'bg-red-50 text-red-700'], ignoree: ['Ignoré', 'bg-neutral-100 text-neutral-600'], erreur: ['Erreur', 'bg-red-50 text-red-700'],
};

export default function ParEmail() {
  const { me, gerer } = useStudio();
  const [l, setL] = useState<Liaison | null>(null);
  const [erreur, setErreur] = useState('');
  const [copie, setCopie] = useState(false);
  const prenoms = new Map(me.agents.map((a) => [a.id, a.prenom]));

  useEffect(() => { appel<Liaison>('liaison').then(setL).catch((e) => setErreur(gerer(e))); }, [gerer]);
  if (!l) return erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />;

  const ouvert = l.disponible && l.actif && l.email;
  const exemple = me.agents.find((a) => a.id !== l.agent) ?? me.agents[0];
  const parDefaut = prenoms.get(l.agent ?? '') ?? me.agents[0]?.prenom;

  return (
    <div className="space-y-6">
      <Titre sous="Confiez une mission à vos agents depuis votre messagerie, sans ouvrir le Studio.">Par e-mail</Titre>

      {!ouvert ? (
        <Carte>
          <p className="flex items-center gap-2 font-medium"><Mail className="h-5 w-5 text-neutral-400" /> Le canal e-mail n'est pas encore activé pour votre espace.</p>
          <p className="mt-1 text-sm text-neutral-500">Demandez-le à Aissociate : vous recevrez une adresse dédiée à votre entreprise.</p>
        </Carte>
      ) : (
        <>
          <Carte>
            <p className="text-sm text-neutral-500">L'adresse de vos agents</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <p className="text-xl font-semibold">{l.email}</p>
              <button onClick={async () => { try { await navigator.clipboard.writeText(l.email!); setCopie(true); setTimeout(() => setCopie(false), 1500); } catch { /* refusé */ } }}
                className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50">
                {copie ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copier
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Seuls les utilisateurs de votre espace, depuis leur adresse de connexion, sont écoutés. Les autres messages sont bloqués sans réponse.
            </p>
          </Carte>

          <div className="grid gap-4 md:grid-cols-2">
            <Carte>
              <p className="mb-2 font-semibold">Confier une mission</p>
              <p className="text-sm text-neutral-600">Mettez le prénom de l'agent entre crochets en tête de l'objet :</p>
              <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 font-mono text-sm">[{exemple?.prenom}] 3 idées pour la semaine</p>
              <p className="mt-2 text-sm text-neutral-600">
                Sans prénom, c'est {parDefaut} qui répond. La réponse arrive dans le même fil en général en moins d'une minute ;
                répondez dans ce fil pour poursuivre la conversation.
              </p>
            </Carte>
            <Carte>
              <p className="mb-2 font-semibold">Commandes {me.user.role !== 'proprietaire' && <span className="text-xs font-normal text-neutral-500">(propriétaire)</span>}</p>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li><span className="font-mono font-medium text-neutral-900">VALIDÉ L-1a2b3c4d</span> : valide un livrable (la référence figure en bas de chaque réponse). <span className="font-mono">REFUSÉ L-…</span> pour le refuser.</li>
                <li><span className="font-mono font-medium text-neutral-900">SUSPENDRE</span> : arrête immédiatement tous les agents. <span className="font-mono">REPRENDRE</span> pour les relancer.</li>
                <li>Une demande de virement, de changement d'IBAN ou de cartes prépayées n'est <b>jamais</b> exécutée.</li>
              </ul>
            </Carte>
          </div>
        </>
      )}

      {ouvert && l.instructions.length === 0 && (
        <EtatVide
          icone={<MailOpen className="h-10 w-10" />}
          titre="Aucun e-mail reçu pour l'instant"
          description={<>Écrivez à <span className="font-mono">{l.email}</span> depuis votre adresse de connexion : votre premier e-mail, et la réponse de l'agent, apparaîtront ici.</>}
        />
      )}
      {l.instructions.length > 0 && (
        <Carte className="p-0">
          <p className="border-b border-neutral-100 px-5 py-3 font-semibold">Derniers e-mails reçus</p>
          <ul className="divide-y divide-neutral-100">
            {l.instructions.map((i) => (
              <li key={i.reference} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-3 text-sm">
                <span className="w-32 shrink-0 text-xs text-neutral-400">{new Date(i.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="min-w-0 flex-1 truncate">{i.sujet || '(sans objet)'}</span>
                {i.agent_id && <span className="text-neutral-500">{prenoms.get(i.agent_id) ?? i.agent_id}</span>}
                {i.expediteur && <span className="text-xs text-neutral-400">{i.expediteur}</span>}
                <span className={cx('rounded-full px-2 py-0.5 text-xs', STATUTS[i.statut][1])} title={i.motif ?? undefined}>{STATUTS[i.statut][0]}</span>
                <span className="text-xs text-neutral-400">{i.reference}</span>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}

// Mode avancé (« Jarvis ») — poste de commande : l'assistant IA au centre,
// l'aperçu de la fiche concernée sur le côté. On pilote le CRM en langage
// naturel, à l'écrit, à la voix, ou en lui confiant une conversation
// enregistrée ; chaque écriture reste une proposition à valider.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AssistantChat, { type AssistantContexte } from '@/components/AssistantChat';
import ApercuEntite, { type EntiteRef } from '@/components/ApercuEntite';
import CaptureConversation from '@/components/CaptureConversation';
import JournalActionsIA from '@/components/JournalActionsIA';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  "J'ai demandé une demande de leads à un client et j'attends son devis : prépare le suivi.",
  'Quels prospects dois-je relancer aujourd\'hui ?',
  'Résume-moi le pipeline et les devis en attente.',
  'Quelles sessions démarrent dans les 15 prochains jours ?',
];

type EtatNavigation = { assistantContexte?: AssistantContexte; messageInitial?: string } | null;

export default function Commande() {
  const location = useLocation();
  const navigate = useNavigate();
  const etat = location.state as EtatNavigation;
  const contexte = etat?.assistantContexte ?? null;
  const [entite, setEntite] = useState<EntiteRef | null>(
    contexte ? { type: contexte.type, id: contexte.id } : null,
  );
  const [onglet, setOnglet] = useState<'fiche' | 'journal'>('fiche');
  const voirFiche = (e: EntiteRef) => { setEntite(e); setOnglet('fiche'); };
  const [capture, setCapture] = useState(false);
  const [envoi, setEnvoi] = useState<{ id: number; texte: string } | null>(null);
  const compteur = useRef(0);
  const envoyer = (texte: string) => { compteur.current += 1; setEnvoi({ id: compteur.current, texte }); };

  // Arrivée depuis la capture mobile : la demande d'analyse part d'elle-même,
  // et l'état de navigation est consommé (un rafraîchissement ne la renvoie pas).
  useEffect(() => {
    if (!etat?.messageInitial) return;
    envoyer(etat.messageInitial);
    navigate('.', { replace: true, state: contexte ? { assistantContexte: contexte } : null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mode-avance-fond flex h-full gap-4 p-3 sm:p-6">
      <section className="flex min-w-0 flex-1 flex-col">
        <AssistantChat
          variant="jarvis" contexte={contexte} suggestions={SUGGESTIONS} onEntite={voirFiche}
          envoi={envoi}
          onEnregistrer={() => setCapture(true)}
          panneauSaisie={capture && (
            <CaptureConversation onAnalyse={envoyer} onFermer={() => setCapture(false)} />
          )}
        />
      </section>
      <aside className="hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto xl:flex">
        <div className="flex rounded-lg border border-line bg-surface p-0.5 text-sm">
          {([['fiche', 'Fiche'], ['journal', 'Journal IA']] as const).map(([cle, libelle]) => (
            <button key={cle} onClick={() => setOnglet(cle)}
              className={cn('flex-1 rounded-md px-3 py-1.5 font-medium transition',
                onglet === cle ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'text-muted hover:text-fg')}>
              {libelle}
            </button>
          ))}
        </div>
        {onglet === 'journal' && <JournalActionsIA onVoir={voirFiche} />}
        {onglet === 'fiche' && (entite
          ? <ApercuEntite entite={entite} onFermer={() => setEntite(null)} />
          : <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
              La fiche concernée par la dernière proposition de l'IA s'affiche ici.
            </p>)}
      </aside>
    </div>
  );
}

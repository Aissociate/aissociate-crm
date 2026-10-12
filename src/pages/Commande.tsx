// Mode avancé (« Jarvis ») — poste de commande : l'assistant IA au centre,
// l'aperçu de la fiche concernée sur le côté. On pilote le CRM en langage
// naturel, à l'écrit, à la voix, ou en lui confiant une conversation
// enregistrée ; chaque écriture reste une proposition à valider.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AssistantChat, { type AssistantContexte } from '@/components/AssistantChat';
import ApercuEntite, { type EntiteRef } from '@/components/ApercuEntite';
import CaptureConversation from '@/components/CaptureConversation';

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
          variant="jarvis" contexte={contexte} suggestions={SUGGESTIONS} onEntite={setEntite}
          envoi={envoi}
          onEnregistrer={() => setCapture(true)}
          panneauSaisie={capture && (
            <CaptureConversation onAnalyse={envoyer} onFermer={() => setCapture(false)} />
          )}
        />
      </section>
      {entite && (
        <aside className="hidden w-80 shrink-0 overflow-y-auto xl:block">
          <ApercuEntite entite={entite} onFermer={() => setEntite(null)} />
        </aside>
      )}
    </div>
  );
}

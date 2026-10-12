// Mode avancé (« Jarvis ») — poste de commande : l'assistant IA au centre,
// l'aperçu de la fiche concernée sur le côté. On pilote le CRM en langage
// naturel ; chaque écriture reste une proposition à valider.
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import AssistantChat, { type AssistantContexte } from '@/components/AssistantChat';
import ApercuEntite, { type EntiteRef } from '@/components/ApercuEntite';

const SUGGESTIONS = [
  "J'ai demandé une demande de leads à un client et j'attends son devis : prépare le suivi.",
  'Quels prospects dois-je relancer aujourd\'hui ?',
  'Résume-moi le pipeline et les devis en attente.',
  'Quelles sessions démarrent dans les 15 prochains jours ?',
];

export default function Commande() {
  const location = useLocation();
  const contexte = (location.state as { assistantContexte?: AssistantContexte } | null)?.assistantContexte ?? null;
  const [entite, setEntite] = useState<EntiteRef | null>(
    contexte ? { type: contexte.type, id: contexte.id } : null,
  );

  return (
    <div className="mode-avance-fond flex h-full gap-4 p-3 sm:p-6">
      <section className="flex min-w-0 flex-1 flex-col">
        <AssistantChat variant="jarvis" contexte={contexte} suggestions={SUGGESTIONS} onEntite={setEntite} />
      </section>
      {entite && (
        <aside className="hidden w-80 shrink-0 overflow-y-auto xl:block">
          <ApercuEntite entite={entite} onFermer={() => setEntite(null)} />
        </aside>
      )}
    </div>
  );
}

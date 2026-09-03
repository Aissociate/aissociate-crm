// Page Assistant IA — coquille autour du composant partagé AssistantChat
// (également embarqué dans les fiches contact). Le contexte de fiche arrive
// via navigate state (bouton IA d'une fiche ou d'un dossier).
import { useLocation } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import AssistantChat, { type AssistantContexte } from '@/components/AssistantChat';

export default function Assistant() {
  const location = useLocation();
  const contexte = (location.state as { assistantContexte?: AssistantContexte } | null)?.assistantContexte ?? null;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Assistant IA"
        subtitle="Interroge vos données en direct et propose des actions — rien n'est modifié sans votre validation"
      />
      {contexte && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-sm text-fg">
          <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" />
          Contexte : {contexte.type === 'contact' ? 'fiche contact' : 'dossier'} <strong>{contexte.label}</strong>
        </div>
      )}
      <AssistantChat contexte={contexte} />
    </div>
  );
}

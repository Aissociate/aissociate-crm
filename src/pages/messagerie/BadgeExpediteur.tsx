import { Bot, Clock, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui';
import { estIA, type Expediteur } from './conversations';

/** Qui a envoyé le message : une IA, un envoi automatique ou un utilisateur. */
export function BadgeExpediteur({ x }: { x: Expediteur }) {
  return (
    <Badge tone={estIA(x.origine) ? 'info' : x.origine === 'automatique' ? 'neutral' : 'brand'}>
      <span className="inline-flex items-center gap-1">
        {estIA(x.origine) ? <Bot className="h-3 w-3" /> : x.origine === 'automatique' ? <Clock className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
        {estIA(x.origine) ? `IA · ${x.label}` : x.label}
      </span>
    </Badge>
  );
}

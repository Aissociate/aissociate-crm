import { differenceInCalendarDays } from 'date-fns';
import { Badge } from '@/components/ui';
import { OPP_STAGE_LABELS } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';
import type { Contact } from '@/lib/database.types';
import { TODAY } from './constantes';
import type { Pilotage } from './pilotage';

// Suivi d'un contact, en une cellule : ce qu'il faut faire, puis depuis quand
// on ne lui a pas parlé. Une absence d'action n'est signalée que sur un prospect.
export function CelluleSuivi({ c, pilotage }: { c: Contact; pilotage: Pilotage }) {
  const { nextAction, lastInteraction, stageOf, nextSession } = pilotage;
  const na = nextAction[c.id];
  const la = lastInteraction[c.id];
  const retard = !!na && na.date_action < TODAY;
  const jours = la ? differenceInCalendarDays(new Date(), new Date(`${la.date_action}T00:00:00`)) : null;
  const dernier = jours === null ? 'Jamais contacté' : jours <= 0 ? "Contacté aujourd'hui" : jours === 1 ? 'Contacté hier' : `Contacté il y a ${jours} j`;
  return (
    <div className="flex flex-col gap-1 text-xs">
      {na ? (
        <span className={cn('flex items-center gap-1.5', retard ? 'font-medium text-red-600 dark:text-red-400' : 'text-fg')} title={na.description}>
          <span className={cn('shrink-0 rounded px-1 tabular-nums', retard ? 'bg-red-500/10' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>{formatDate(na.date_action, 'dd/MM')}</span>
          <span className="max-w-[190px] truncate">{na.description}</span>
        </span>
      ) : c.type === 'prospect' ? (
        <span className="font-medium text-amber-600 dark:text-amber-400">Aucune action prévue</span>
      ) : null}
      {(c.type === 'prospect' || la) && (
        <span className="text-muted" title={la ? `${la.description} · ${formatDate(la.date_action)}` : undefined}>{dernier}</span>
      )}
      {(stageOf[c.id] || nextSession[c.id]) && (
        <div className="flex flex-wrap gap-1">
          {stageOf[c.id] && <Badge tone="brand">{OPP_STAGE_LABELS[stageOf[c.id]] ?? stageOf[c.id]}</Badge>}
          {nextSession[c.id] && (
            <Badge tone={nextSession[c.id].date_debut >= TODAY ? 'warning' : 'success'}>
              {nextSession[c.id].date_debut >= TODAY ? 'Session ' : 'Réalisée '}{formatDate(nextSession[c.id].date_debut, 'dd/MM')}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

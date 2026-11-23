// Contacts — données de pilotage par contact (prochaine action, dernier échange, pipeline, session).
import type { ContactAction, Opportunite, SessionFormation, SessionParticipant } from '@/lib/database.types';
import { TODAY } from './constantes';

/**
 * Index « contact_id → info de pilotage ».
 * `actions` doit être trié par `date_action` croissante (c'est l'ordre de chargement de la page).
 */
export function indexerPilotage(
  actions: ContactAction[], opps: Opportunite[], participants: SessionParticipant[], sessions: SessionFormation[],
) {
  const nextAction: Record<string, ContactAction> = {};
  for (const a of actions) if (!a.faite && !nextAction[a.contact_id]) nextAction[a.contact_id] = a;
  // Dernière interaction = action RÉALISÉE la plus récente par contact.
  // actionsCol est trié par date_action croissante → la dernière rencontrée est la plus récente.
  const lastInteraction: Record<string, ContactAction> = {};
  for (const a of actions) if (a.faite) lastInteraction[a.contact_id] = a;
  const stageOf: Record<string, Opportunite['stage']> = {};
  for (const o of opps) if (o.contact_id && !['gagne', 'perdu'].includes(o.stage) && !stageOf[o.contact_id]) stageOf[o.contact_id] = o.stage;
  const sessById = Object.fromEntries(sessions.map((s) => [s.id, s]));
  const nextSession: Record<string, SessionFormation> = {};
  for (const p of participants) {
    if (!p.contact_id) continue;
    const s = sessById[p.session_id]; if (!s) continue;
    const cur = nextSession[p.contact_id];
    const better = !cur
      || (s.date_debut >= TODAY && (cur.date_debut < TODAY || s.date_debut < cur.date_debut))
      || (s.date_debut < TODAY && cur.date_debut < TODAY && s.date_debut > cur.date_debut);
    if (better) nextSession[p.contact_id] = s;
  }
  return { nextAction, lastInteraction, stageOf, nextSession };
}
export type Pilotage = ReturnType<typeof indexerPilotage>;

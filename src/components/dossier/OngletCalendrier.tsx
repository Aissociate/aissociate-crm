import { useCallback, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, Spinner } from '@/components/ui';
import MiniCalendrierContact from '@/components/MiniCalendrierContact';
import type { Contact, SessionFormation, SessionParticipant, Opportunite, ContactAction } from '@/lib/database.types';

/**
 * Onglet « Calendrier » du dossier client : le calendrier miniature de la fiche
 * contact, pour inscrire (réserver) le bénéficiaire sur une session avec la
 * même mise à jour en cascade (fiche, action de suivi, pipeline).
 */
export default function OngletCalendrier({ contact, onChanged }: { contact: Contact | null; onChanged: () => void }) {
  const [donnees, setDonnees] = useState<{
    sessions: SessionFormation[]; participants: SessionParticipant[]; opps: Opportunite[]; actions: ContactAction[];
  } | null>(null);

  const charger = useCallback(async () => {
    if (!contact) return;
    const [s, p, o, a] = await Promise.all([
      supabase.from('sessions_formation').select('*').order('date_debut', { ascending: false }),
      supabase.from('session_participants').select('*').eq('contact_id', contact.id),
      supabase.from('opportunites').select('*').eq('contact_id', contact.id),
      supabase.from('contact_actions').select('*').eq('contact_id', contact.id).order('date_action', { ascending: false }),
    ]);
    setDonnees({ sessions: s.data ?? [], participants: p.data ?? [], opps: o.data ?? [], actions: a.data ?? [] });
  }, [contact]);
  useEffect(() => { void charger(); }, [charger]);

  if (!contact) return <Card><p className="text-sm text-muted">Ce dossier n'a pas de bénéficiaire : rien à réserver.</p></Card>;

  const inscrit = donnees?.sessions.filter((s) => donnees.participants.some((p) => p.session_id === s.id)) ?? [];

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-fg"><CalendarDays className="h-4 w-4 text-brand-500" /> Calendrier et réservation</h2>
      <p className="mb-4 text-sm text-muted">
        Choisissez un jour puis une session pour y inscrire le bénéficiaire.
        {inscrit.length > 0 && ` Inscrit à : ${inscrit.map((s) => s.titre).join(', ')}.`}
      </p>
      {!donnees ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <MiniCalendrierContact
          contact={contact}
          sessions={donnees.sessions}
          participants={donnees.participants}
          opportunites={donnees.opps}
          actions={donnees.actions}
          onChanged={() => { void charger(); onChanged(); }}
          // Les liens « Ouvrir » du calendrier naviguent d'eux-mêmes : rien à fermer ici.
          onNavigate={() => undefined}
        />
      )}
    </Card>
  );
}

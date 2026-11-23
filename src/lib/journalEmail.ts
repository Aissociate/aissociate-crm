import { supabase } from '@/lib/supabase';

/**
 * Trace dans la Messagerie (table `emails`) un e-mail qu'un utilisateur vient
 * d'envoyer depuis un écran du CRM. `send-email` ne fait qu'expédier : sans
 * cette ligne, l'envoi est invisible dans la Messagerie et l'historique du
 * contact. Pendant serveur : supabase/functions/_shared/journal_email.ts.
 *
 * Renvoie le message d'erreur si l'écriture a échoué (le mail, lui, est parti),
 * sinon null.
 */
export async function journaliserEnvoi(e: {
  destinataire: string;
  sujet: string;
  corps: string;
  expediteur: string | null;
  ownerId: string | null;
  contactId?: string | null;
  dossierId?: string | null;
  envoyeLe?: string;
}): Promise<string | null> {
  const { error } = await supabase.from('emails').insert({
    destinataires: [e.destinataire], copie: [], sujet: e.sujet, corps: e.corps,
    statut: 'envoye', canal: 'email', direction: 'sortant',
    expediteur: e.expediteur,
    contact_id: e.contactId ?? null, dossier_id: e.dossierId ?? null,
    sent_at: e.envoyeLe ?? new Date().toISOString(),
    owner_id: e.ownerId, attachments: [],
    origine: 'utilisateur',
  });
  return error ? error.message : null;
}

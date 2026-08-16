import { supabase } from './supabase';
import type { Conversation } from './database.types';

/**
 * Lance la transcription d'une conversation puis suit son avancement.
 *
 * L'Edge Function répond tout de suite et travaille en tâche de fond (un long
 * entretien dépasse le temps imparti à une requête) : le résultat se lit donc
 * sur la ligne `conversations`, relue toutes les trois secondes.
 */
export async function traiterConversation(
  id: string,
  options: { timeoutMs?: number } = {},
): Promise<{ conversation: Conversation | null; erreur: string | null }> {
  const { data, error } = await supabase.functions.invoke('conversation', {
    body: { action: 'traiter', conversation_id: id },
  });
  const reponse = data as { error?: string } | null;
  if (error || reponse?.error) {
    return {
      conversation: null,
      erreur: reponse?.error ?? "Le service de transcription n'a pas répondu. L'audio est conservé.",
    };
  }

  const limite = Date.now() + (options.timeoutMs ?? 10 * 60 * 1000);
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 3000));
    const { data: row } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
    const conv = row as Conversation | null;
    if (!conv) continue;
    if (conv.statut === 'traitee') return { conversation: conv, erreur: null };
    if (conv.statut === 'erreur') return { conversation: conv, erreur: conv.erreur ?? 'Le traitement a échoué.' };
  }
  return {
    conversation: null,
    erreur: "Le traitement dure plus longtemps que prévu. Le compte-rendu apparaîtra dans la fiche du contact dès qu'il sera prêt.",
  };
}

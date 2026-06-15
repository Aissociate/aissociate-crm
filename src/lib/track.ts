import { supabase } from './supabase';

const VISITOR_KEY = 'aiv'; // identifiant visiteur anonyme (1st-party)

/** Identifiant visiteur stable, stocké localement (aucune donnée personnelle). */
function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/**
 * Enregistre une vue de page du site vitrine (analytics 1st-party).
 * Non bloquant pour le visiteur, mais l'échec est tracé en console : un INSERT
 * Supabase ne « throw » pas sur erreur RLS/grant — il renvoie `{ error }` —, il
 * faut donc le lire explicitement, sinon une panne d'écriture reste invisible.
 */
export async function trackPageView(path: string): Promise<void> {
  try {
    const { error } = await supabase.from('page_views').insert({
      path,
      visitor_id: visitorId(),
      referrer: document.referrer || null,
    });
    if (error) console.warn('[analytics] page_views insert échoué :', error.message);
  } catch (e) {
    console.warn('[analytics] page_views insert exception :', e instanceof Error ? e.message : e);
  }
}

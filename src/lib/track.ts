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
 * Tolérant aux erreurs : ne bloque jamais la navigation.
 */
export async function trackPageView(path: string): Promise<void> {
  try {
    await supabase.from('page_views').insert({
      path,
      visitor_id: visitorId(),
      referrer: document.referrer || null,
    });
  } catch {
    /* silencieux : l'analytics ne doit pas impacter l'expérience visiteur */
  }
}

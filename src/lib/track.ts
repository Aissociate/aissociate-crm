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
const THROTTLE_KEY = 'aiv_seen'; // { [path]: timestamp du dernier envoi }
const THROTTLE_MS = 30 * 60 * 1000; // 30 min

/**
 * Une même page revue par le même visiteur dans la demi-heure n'est pas
 * recomptée : un écran qui se recharge en boucle ou un moniteur de
 * disponibilité gonflait les vues (constaté : 2 visitor_id = 96 % des vues
 * de l'accueil sur 30 jours), ce qui rendait le taux de conversion illisible.
 */
function alreadyCounted(path: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(THROTTLE_KEY) || '{}');
    const now = Date.now();
    if (seen[path] && now - seen[path] < THROTTLE_MS) return true;
    seen[path] = now;
    // Purge des entrées expirées pour ne pas grossir indéfiniment.
    for (const k of Object.keys(seen)) if (now - seen[k] >= THROTTLE_MS) delete seen[k];
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(seen));
    return false;
  } catch {
    return false; // stockage indisponible : on compte (comportement historique)
  }
}

/**
 * Enregistre un clic sortant (téléphone, WhatsApp) sous un chemin /click/<nom>.
 * Ces lignes vivent dans page_views mais sont EXCLUES des KPI visiteurs du
 * dashboard (fonction SQL dashboard_visiteurs) : ce sont des conversions, pas
 * des vues. Dédoublonné sur 10 s pour absorber les double-clics.
 */
const lastClick: Record<string, number> = {};
export async function trackClick(name: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    const now = Date.now();
    if (lastClick[name] && now - lastClick[name] < 10_000) return;
    lastClick[name] = now;
    const { error } = await supabase.from('page_views').insert({
      path: `/click/${name}`,
      visitor_id: visitorId(),
      referrer: window.location.pathname,
    });
    if (error) console.warn('[analytics] clic insert échoué :', error.message);
  } catch (e) {
    console.warn('[analytics] clic insert exception :', e instanceof Error ? e.message : e);
  }
}

export async function trackPageView(path: string): Promise<void> {
  try {
    // Navigateurs pilotés (crawlers exécutant le JS, tests) : pas des visiteurs.
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    if (alreadyCounted(path)) return;
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

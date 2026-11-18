/**
 * Onglet périmé après un déploiement.
 *
 * Chaque déploiement renomme les fichiers JS (empreinte dans le nom). Un onglet
 * resté ouvert connaît encore les anciens noms : au premier changement d'écran,
 * le navigateur demande un fichier qui n'existe plus et l'application affichait
 * « Failed to fetch dynamically imported module ». On recharge alors la page,
 * une seule fois, pour récupérer la version en ligne.
 */

const CLE = 'aissociate:rechargement-version';
/** Pas plus d'un rechargement automatique par minute : évite toute boucle si le fichier manque vraiment. */
const DELAI_MS = 60_000;

const MOTIFS = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i,   // Firefox
  /Importing a module script failed/i,            // Safari
  /Unable to preload CSS/i,                        // Vite (feuille de style d'un écran)
];

export function estErreurDeVersion(erreur: unknown): boolean {
  const message = erreur instanceof Error ? erreur.message : String(erreur ?? '');
  return MOTIFS.some((m) => m.test(message));
}

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Recharge la page si aucun rechargement automatique n'a eu lieu depuis une minute.
 * Renvoie `true` si le rechargement est lancé.
 */
export function rechargerUneFois(
  stockage: Stockage | null = stockageSession(),
  recharger: () => void = () => window.location.reload(),
  maintenant: number = Date.now(),
): boolean {
  // Sans stockage de session (navigation privée stricte), on ne peut pas se
  // protéger d'une boucle : on laisse l'écran d'erreur habituel.
  if (!stockage) return false;
  try {
    const dernier = Number(stockage.getItem(CLE) ?? 0);
    if (Number.isFinite(dernier) && maintenant - dernier < DELAI_MS) return false;
    stockage.setItem(CLE, String(maintenant));
  } catch {
    return false;
  }
  recharger();
  return true;
}

function stockageSession(): Stockage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

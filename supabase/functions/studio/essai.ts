// ⚠ Depuis le 23/11/2026, le contrat Stage gratuit (contrats.ts) remplace l'essai : plus aucun
// espace n'est créé avec `essai_fin` et la migration studio_contrats a basculé les essais en Stage.
// Ce module reste pour un espace d'essai qu'Aissociate recréerait à la main.
//
// Essai gratuit : un espace créé à la fin du questionnaire a `essai_fin` (7 jours par défaut).
// Pendant l'essai : quotas habituels, un seul connecteur. Après : accès bloqué (seuls Mon
// périmètre, l'abonnement, le mot de passe et les CGV restent ouverts) tant qu'aucun
// abonnement n'est payé. Un espace sans `essai_fin` (créé par le CRM) n'est jamais concerné.

/** Statuts Stripe qui valent abonnement en règle (l'essai ne compte plus). */
export const ABONNEMENT_PAYE = ["active", "trialing", "past_due"];
export const CONNECTEURS_ESSAI = 1;

/** Actions encore permises une fois l'essai terminé. */
export const ACTIONS_APRES_ESSAI = new Set([
  "me", "logout", "change_password", "cgv", "cgv_accepter", "perimetre", "abonnement_souscrire", "abonnement_gerer", "agent_ajouter",
  "contrat_souscrire", "integration_demander", "abonnement_resilier",
  "entete", "entete_update", "bug_signaler",
]);

type EspaceEssai = { essai_fin?: string | null; abonnement_statut?: string | null };

/** L'espace est-il couvert par l'essai (et non par un abonnement payé) ? */
export function enEssai(w: EspaceEssai): boolean {
  return Boolean(w.essai_fin) && !ABONNEMENT_PAYE.includes(String(w.abonnement_statut ?? ""));
}

export function essaiTermine(w: EspaceEssai, maintenant = new Date()): boolean {
  return enEssai(w) && new Date(String(w.essai_fin)) <= maintenant;
}

/** Jours restants (arrondis au supérieur), 0 si terminé, null hors essai. */
export function joursRestants(w: EspaceEssai, maintenant = new Date()): number | null {
  if (!enEssai(w)) return null;
  return Math.max(0, Math.ceil((new Date(String(w.essai_fin)).getTime() - maintenant.getTime()) / 86_400_000));
}

export const MESSAGE_FIN = "Votre essai gratuit est terminé. Choisissez votre abonnement dans « Mon périmètre » pour retrouver vos agents.";
export const MESSAGE_CONNECTEUR = `Pendant l'essai gratuit, ${CONNECTEURS_ESSAI === 1 ? "un seul outil peut être connecté" : `${CONNECTEURS_ESSAI} outils peuvent être connectés`}. Retirez la connexion actuelle ou choisissez votre abonnement dans « Mon périmètre ».`;

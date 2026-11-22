// Essai gratuit : un espace créé à la fin du questionnaire a `essai_fin` (7 jours par défaut).
// Pendant l'essai : quotas habituels, sauf deux garde-fous de coût réglés dans studio_config
// (CRM › Studio IA › Paramètres) et appliqués aussitôt, sans rien écrire sur l'espace :
//   essai_connecteurs_max = "1"  (connecteurs actifs permis pendant l'essai)
//   essai_quota_videos    = "0"  (vidéos par mois pendant l'essai ; 0 = à l'abonnement seulement)
// Dès qu'un abonnement est payé, enEssai est faux : les quotas de l'espace reprennent seuls.
// Après l'essai : accès bloqué (seuls Mon périmètre, l'abonnement, le mot de passe et les CGV
// restent ouverts) tant qu'aucun abonnement n'est payé. Un espace sans `essai_fin` (créé par
// le CRM) n'est jamais concerné.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

/** Statuts Stripe qui valent abonnement en règle (l'essai ne compte plus). */
export const ABONNEMENT_PAYE = ["active", "trialing", "past_due"];
export const LIMITES_DEFAUT = { connecteurs: 1, videos: 0 };
export type LimitesEssai = typeof LIMITES_DEFAUT;

const entier = (v: unknown, defaut: number): number => {
  const t = String(v ?? "").trim();
  const n = Number(t);
  return t !== "" && Number.isInteger(n) && n >= 0 ? n : defaut;
};

/** Limites de l'essai lues dans studio_config ; valeur absente ou illisible = défaut. */
export function limitesEssai(cfg: Record<string, string | undefined>): LimitesEssai {
  return {
    connecteurs: entier(cfg.essai_connecteurs_max, LIMITES_DEFAUT.connecteurs),
    videos: entier(cfg.essai_quota_videos, LIMITES_DEFAUT.videos),
  };
}

export async function chargerLimites(sb: SupabaseClient): Promise<LimitesEssai> {
  const { data } = await sb.from("studio_config").select("cle, valeur").in("cle", ["essai_connecteurs_max", "essai_quota_videos"]);
  return limitesEssai(Object.fromEntries((data ?? []).map((r) => [r.cle, String(r.valeur ?? "")])));
}

/** Quota de vidéos pendant l'essai : le plus petit entre celui de l'espace (null = illimité) et la limite d'essai. */
export function quotaVideosEssai(quotaEspace: number | null | undefined, limite: number): number {
  return quotaEspace == null ? limite : Math.min(quotaEspace, limite);
}

/** Actions encore permises une fois l'essai terminé. */
export const ACTIONS_APRES_ESSAI = new Set([
  "me", "logout", "change_password", "cgv", "cgv_accepter", "perimetre", "abonnement_souscrire", "abonnement_gerer", "agent_ajouter",
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
export function messageConnecteur(max: number): string {
  if (max <= 0) return "Pendant l'essai gratuit, les outils ne peuvent pas encore être connectés. Choisissez votre abonnement dans « Mon périmètre ».";
  return `Pendant l'essai gratuit, ${max === 1 ? "un seul outil peut être connecté" : `${max} outils peuvent être connectés`}. Retirez ${max === 1 ? "la connexion actuelle" : "une connexion"} ou choisissez votre abonnement dans « Mon périmètre ».`;
}
export const MESSAGE_VIDEO = "La vidéo n'est pas comprise dans l'essai gratuit : elle est disponible dès votre abonnement (« Mon périmètre »).";

// Facturation des connecteurs : les types inclus (un compte de chacun) sont compris dans
// l'abonnement ; tout autre connecteur actif est facturé `prix` € HT par mois.
// Réglage dans studio_config (CRM › Studio IA › Paramètres) :
//   prix_connecteur_supplementaire_ht = "9.99"
//   connecteurs_inclus = "google,microsoft,facebook,instagram,tiktok,linkedin"
// Mêmes clés de type que src/lib/tarifConnecteurs.ts.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import * as bureau from "./bureau.ts";
import * as zernio from "./zernio.ts";

export const TYPES = ["google", "microsoft", "facebook", "instagram", "tiktok", "linkedin", "imap", "mcp", "app"] as const;
export const INCLUS_DEFAUT = ["google", "microsoft", "facebook", "instagram", "tiktok", "linkedin"];
export const PRIX_DEFAUT = 9.99;
const NOMS: Record<string, string> = {
  google: "Google Workspace", microsoft: "Outlook / Microsoft 365", facebook: "Facebook", instagram: "Instagram",
  tiktok: "TikTok", linkedin: "LinkedIn", imap: "Autre messagerie", mcp: "Serveur MCP", app: "Application",
};

export type Tarif = { prix: number; inclus: string[] };
export type Actif = { type: string; libelle: string; detail: string };
export type LigneFacturee = Actif & { facture: boolean };

/** Lit le tarif depuis les lignes studio_config ; valeur absente ou illisible = défaut. */
export function lireTarif(lignes: { cle: string; valeur: unknown }[]): Tarif {
  const v = new Map(lignes.map((l) => [l.cle, String(l.valeur ?? "").trim()]));
  const brut = v.get("prix_connecteur_supplementaire_ht") ?? "";
  const prix = brut === "" ? NaN : Number(brut.replace(",", "."));
  const liste = (v.get("connecteurs_inclus") ?? "").split(",").map((t) => t.trim().toLowerCase())
    .filter((t) => (TYPES as readonly string[]).includes(t));
  return {
    prix: Number.isFinite(prix) && prix >= 0 ? Math.round(prix * 100) / 100 : PRIX_DEFAUT,
    inclus: v.has("connecteurs_inclus") ? [...new Set(liste)] : INCLUS_DEFAUT,
  };
}

/** Type facturable d'une ligne studio_connecteurs (connecteurs saisis à la main). */
export function typeManuel(type: string): string | null {
  if (type === "outlook") return "microsoft";
  if (type === "smtp") return "imap";
  if (type.startsWith("app:")) return "app";
  return (TYPES as readonly string[]).includes(type) ? type : null;
}

/**
 * Connecteurs actifs d'un espace : comptes Zernio valides (ceux « à reconnecter » ne sont pas
 * facturés) puis connecteurs manuels au statut « connecte ». Un connecteur manuel d'un type déjà
 * présent chez Zernio est ignoré (même compte, mis en place avant la connexion en un clic).
 */
export function actifsDepuis(comptes: Record<string, unknown>[], manuels: { type: string; infos?: Record<string, unknown> | null }[]): Actif[] {
  const actifs: Actif[] = [];
  for (const a of comptes) {
    const b = bureau.versBoite(a);
    if (b) {
      if (!b.a_reconnecter) actifs.push({ type: b.fournisseur, libelle: NOMS[b.fournisseur], detail: b.adresse });
      continue;
    }
    if (!zernio.estReseau(a.platform)) continue;
    if (a.needsReconnection || a.isActive === false) continue;
    actifs.push({ type: a.platform, libelle: NOMS[a.platform], detail: String(a.displayName || a.username || "") });
  }
  const zernioTypes = new Set(actifs.map((a) => a.type));
  for (const m of manuels) {
    const t = typeManuel(m.type);
    if (!t || (t !== "app" && t !== "mcp" && t !== "imap" && zernioTypes.has(t))) continue;
    const infos = (m.infos ?? {}) as Record<string, unknown>;
    const detail = String(infos.adresse || infos.expediteur || infos.nom || infos.libelle || infos.page || infos.compte || (t === "app" ? m.type.slice(4) : ""));
    actifs.push({ type: t, libelle: NOMS[t], detail });
  }
  return actifs;
}

/** Un compte de chaque type inclus est offert ; le reste est facturé. */
export function facturer(actifs: Actif[], tarif: Tarif): { lignes: LigneFacturee[]; nb_factures: number; montant_ht: number } {
  const offerts = new Set<string>();
  const lignes = actifs.map((a) => {
    const offert = tarif.inclus.includes(a.type) && !offerts.has(a.type);
    if (offert) offerts.add(a.type);
    return { ...a, facture: !offert };
  });
  const nb = lignes.filter((l) => l.facture).length;
  return { lignes, nb_factures: nb, montant_ht: Math.round(nb * tarif.prix * 100) / 100 };
}

export async function tarifConnecteurs(sb: SupabaseClient): Promise<Tarif> {
  const { data } = await sb.from("studio_config").select("cle, valeur").in("cle", ["prix_connecteur_supplementaire_ht", "connecteurs_inclus"]);
  return lireTarif(data ?? []);
}

/** Connecteurs facturés d'un espace (abonnement Stripe) ; erreur si Zernio n'a pas répondu. */
export async function facturationEspace(sb: SupabaseClient, wsId: string) {
  const [tarif, { data: manuels }] = await Promise.all([
    tarifConnecteurs(sb),
    sb.from("studio_connecteurs").select("type, infos").eq("statut", "connecte").eq("workspace_id", wsId),
  ]);
  let comptes: Record<string, unknown>[] = [];
  let erreur: string | null = null;
  if (zernio.zernioConfigure()) {
    try { comptes = await zernio.comptesBruts(wsId); } catch (e) { erreur = bureau.messageErreur(e); }
  }
  return { tarif, ...facturer(actifsDepuis(comptes, manuels ?? []), tarif), erreur };
}

/** État actuel de la facturation des connecteurs, pour chaque espace actif (CRM). */
export async function facturationEspaces(sb: SupabaseClient) {
  const [tarif, { data: espaces }, { data: manuels }] = await Promise.all([
    tarifConnecteurs(sb),
    sb.from("studio_workspaces").select("id").eq("actif", true),
    sb.from("studio_connecteurs").select("workspace_id, type, infos").eq("statut", "connecte"),
  ]);
  const resultat = await Promise.all((espaces ?? []).map(async (w) => {
    let comptes: Record<string, unknown>[] = [];
    let erreur: string | null = null;
    if (zernio.zernioConfigure()) {
      try { comptes = await zernio.comptesBruts(w.id); } catch (e) { erreur = bureau.messageErreur(e); }
    }
    const actifs = actifsDepuis(comptes, (manuels ?? []).filter((m) => m.workspace_id === w.id));
    return { workspace_id: w.id, ...facturer(actifs, tarif), erreur };
  }));
  return { tarif, espaces: resultat };
}

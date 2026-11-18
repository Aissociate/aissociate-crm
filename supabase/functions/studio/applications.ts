// Applications connectables en un clic via Zernio, au-delà des messageries (bureau.ts) et des
// réseaux où les agents publient (zernio.ts) : vidéo, messageries instantanées, publicité,
// site et boutique, CRM, mesure d'audience, paiement.
// Même cloisonnement que les réseaux : compte rattaché au profil Zernio de l'espace, et
// toute opération vérifie que le compte visé appartient à CET espace.
// ⚠ Même liste que APPLICATIONS_UN_CLIC dans src/lib/tarifConnecteurs.ts (noms et logos).
import * as zernio from "./zernio.ts";

export const APPLICATIONS: Record<string, { nom: string; categorie: string }> = {
  youtube: { nom: "YouTube", categorie: "Réseaux et vidéo" },
  reddit: { nom: "Reddit", categorie: "Réseaux et vidéo" },
  whatsapp: { nom: "WhatsApp Business", categorie: "Messageries instantanées" },
  slack: { nom: "Slack", categorie: "Messageries instantanées" },
  discord: { nom: "Discord", categorie: "Messageries instantanées" },
  metaads: { nom: "Meta Ads", categorie: "Publicité" },
  googleads: { nom: "Google Ads", categorie: "Publicité" },
  linkedinads: { nom: "LinkedIn Ads", categorie: "Publicité" },
  tiktokads: { nom: "TikTok Ads", categorie: "Publicité" },
  pinterestads: { nom: "Pinterest Ads", categorie: "Publicité" },
  xads: { nom: "X Ads", categorie: "Publicité" },
  redditads: { nom: "Reddit Ads", categorie: "Publicité" },
  microsoftads: { nom: "Microsoft Ads", categorie: "Publicité" },
  shopify: { nom: "Shopify", categorie: "Site et boutique" },
  wordpress: { nom: "WordPress.com", categorie: "Site et boutique" },
  wix: { nom: "Wix", categorie: "Site et boutique" },
  webflow: { nom: "Webflow", categorie: "Site et boutique" },
  hubspot: { nom: "HubSpot", categorie: "CRM et ventes" },
  salesforce: { nom: "Salesforce", categorie: "CRM et ventes" },
  googleanalytics: { nom: "Google Analytics", categorie: "Mesure et paiement" },
  stripe: { nom: "Stripe", categorie: "Mesure et paiement" },
};

export const estApplication = (x: unknown): x is string => typeof x === "string" && Object.hasOwn(APPLICATIONS, x);

export type CompteApplication = { id: string; app: string; nom: string; a_reconnecter: boolean };

/** Applications de la liste parmi des comptes Zernio bruts. */
export function applicationsDepuis(comptes: Record<string, unknown>[]): CompteApplication[] {
  return comptes.filter((a) => estApplication(a.platform)).map((a) => ({
    id: String(a._id), app: String(a.platform),
    nom: String(a.displayName || a.username || APPLICATIONS[String(a.platform)].nom),
    a_reconnecter: Boolean(a.needsReconnection) || a.isActive === false,
  }));
}

export const comptesApplications = async (wsId: string) => applicationsDepuis(await zernio.comptesBruts(wsId));

/** Domaine d'une boutique Shopify (« ma-boutique » ou « ma-boutique.myshopify.com »), ou null. */
export function boutiqueShopify(brut: unknown): string | null {
  const s = String(brut ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const nom = s.replace(/\.myshopify\.com$/, "");
  return /^[a-z0-9][a-z0-9-]{0,60}$/.test(nom) ? `${nom}.myshopify.com` : null;
}

/**
 * Régies publicitaires : Zernio les connecte par `GET /connect/{chemin}/ads`, où le chemin est le
 * réseau porteur (facebook → compte « metaads », twitter → « xads »…), et non par `/connect/{slug}`.
 */
export const CHEMIN_PUB: Record<string, string> = {
  metaads: "facebook", googleads: "googleads", linkedinads: "linkedin", tiktokads: "tiktok",
  pinterestads: "pinterest", xads: "twitter", redditads: "redditads", microsoftads: "microsoftads",
};

/** Chemin et paramètres de connexion d'une application (pur : testé sans réseau). */
export function cheminConnexion(app: string, q: URLSearchParams, compteX: string | null): string | { erreur: string } {
  const pub = CHEMIN_PUB[app];
  if (!pub) return `/connect/${app}?${q}`;
  if (app === "xads") {
    // X Ads s'appuie sur le compte X de l'espace : il doit être connecté d'abord.
    if (!compteX) return { erreur: "Connectez d'abord votre compte X (carte « X » plus haut), puis X Ads." };
    q.set("accountId", compteX);
  }
  // Meta : connexion « business », indépendante de la page Facebook reliée pour publier.
  if (app === "metaads") q.set("loginMode", "business");
  return `/connect/${pub}/ads?${q}`;
}

/** Lien d'autorisation (fenêtre de l'application), retour sur `retour`. */
export async function lienConnexionApplication(p: {
  wsId: string; wsNom: string; app: string; retour: string; reconnecter?: string | null; boutique?: string | null;
}): Promise<string> {
  const profil = await zernio.profilEspace(p.wsId, p.wsNom, true);
  const q = new URLSearchParams({ profileId: profil!, redirect_url: p.retour });
  if (p.app === "shopify") {
    if (!p.boutique) throw new Error("Indiquez l'adresse de votre boutique Shopify (ex. ma-boutique.myshopify.com).");
    q.set("shop", p.boutique);
  }
  if (p.reconnecter) {
    if (!(await comptesApplications(p.wsId)).some((c) => c.id === p.reconnecter)) throw new Error("Compte inconnu dans cet espace.");
    q.set("reconnectAccountId", p.reconnecter);
  }
  const compteX = p.app === "xads"
    ? String((await zernio.comptesBruts(p.wsId)).find((a) => a.platform === "twitter" && a.isActive !== false)?._id ?? "") || null
    : null;
  const chemin = cheminConnexion(p.app, q, compteX);
  if (typeof chemin !== "string") throw new Error(chemin.erreur);
  type Reponse = { authUrl?: string; alreadyConnected?: boolean };
  let data: Reponse;
  try {
    ({ data } = await zernio.appel<Reponse>(chemin));
  } catch (e) {
    // Connexion « business » de Meta indisponible chez Zernio (503) : connexion classique.
    if (p.app !== "metaads" || (e as { statut?: number }).statut !== 503) throw e;
    q.delete("loginMode");
    ({ data } = await zernio.appel<Reponse>(`/connect/facebook/ads?${q}`));
  }
  zernio.oublierComptes(p.wsId);
  // Régie déjà reliée (droits déjà accordés avec le compte de publication) : retour direct, sans fenêtre.
  if (data?.alreadyConnected) return `${p.retour}${p.retour.includes("?") ? "&" : "?"}connected=1`;
  if (!data?.authUrl) throw new Error("Cette application ne propose pas encore la connexion en un clic.");
  return data.authUrl;
}

export async function deconnecterApplication(wsId: string, compteId: string): Promise<CompteApplication> {
  const compte = (await comptesApplications(wsId)).find((c) => c.id === compteId);
  if (!compte) throw new Error("Compte inconnu dans cet espace.");
  await zernio.appel(`/accounts/${encodeURIComponent(compteId)}`, { method: "DELETE" });
  zernio.oublierComptes(wsId);
  return compte;
}

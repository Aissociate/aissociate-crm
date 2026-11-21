// Connecteurs du Studio : catalogue côté serveur (validation des saisies).
//
// Principe « simple pour le client » : il saisit le minimum (adresse, page,
// compte) et coche son accord. Les connexions OAuth (Google, Microsoft, Meta,
// LinkedIn, TikTok) exigent des applications validées par chaque plateforme :
// elles sont enregistrées en « demande » et finalisées à la main par Aissociate.
// SMTP et MCP fournissent tout de suite leurs paramètres ; le secret est chiffré.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import type { ConnecteurActif } from "./contexte.ts";
import { chiffrer } from "./securite.ts";
import * as bureau from "./bureau.ts";
import * as zernio from "./zernio.ts";
import { APPLICATIONS, estApplication } from "./applications.ts";
import { APPS_OUTILLEES } from "./applications_outils.ts";
import { estTypeMcp, SERVEURS_MAX, slug, urlAutorisee } from "./mcp_client.ts";
import { API_MAX, AUTHS, DOC_MAX, estTypeApi } from "./api_client.ts";

type Def = {
  libelle: string;
  champs: { nom: string; requis?: boolean; max?: number }[];
  secret?: string;           // nom du champ secret (chiffré, jamais renvoyé)
  detail?: (i: Record<string, string>) => string;
};

export const CONNECTEURS: Record<string, Def> = {
  google: {
    libelle: "Google Workspace (Gmail, Agenda, Drive)",
    champs: [{ nom: "adresse", requis: true }, { nom: "services" }],
    detail: (i) => [i.adresse, i.services].filter(Boolean).join(" · "),
  },
  outlook: {
    libelle: "Outlook / Microsoft 365",
    champs: [{ nom: "adresse", requis: true }],
    detail: (i) => i.adresse,
  },
  smtp: {
    libelle: "Messagerie sur mesure (SMTP)",
    champs: [
      { nom: "expediteur", requis: true }, { nom: "nom_affiche" }, { nom: "hote", requis: true },
      { nom: "port", requis: true, max: 5 }, { nom: "securite" }, { nom: "utilisateur", requis: true },
      { nom: "imap_hote" }, { nom: "fournisseur" },
    ],
    secret: "mot_de_passe",
    detail: (i) => `envoi depuis ${i.expediteur}`,
  },
  facebook: { libelle: "Facebook (page)", champs: [{ nom: "page", requis: true }], detail: (i) => i.page },
  instagram: { libelle: "Instagram (compte professionnel)", champs: [{ nom: "compte", requis: true }, { nom: "page_facebook" }], detail: (i) => i.compte },
  linkedin: { libelle: "LinkedIn", champs: [{ nom: "page", requis: true }, { nom: "type_compte" }], detail: (i) => i.page },
  tiktok: { libelle: "TikTok", champs: [{ nom: "compte", requis: true }], detail: (i) => i.compte },
  mcp: {
    libelle: "Serveur MCP",
    champs: [{ nom: "nom", requis: true }, { nom: "url", requis: true, max: 500 }, { nom: "description" }],
    secret: "jeton",
    detail: (i) => `${i.nom}${i.description ? ` : ${i.description}` : ""}`,
  },
  api: {
    libelle: "API",
    champs: [
      { nom: "nom", requis: true }, { nom: "url", requis: true, max: 500 }, { nom: "auth", requis: true, max: 20 },
      { nom: "auth_nom", max: 80 }, { nom: "description" }, { nom: "documentation", max: DOC_MAX }, { nom: "openapi", max: 500 },
    ],
    secret: "cle",
    detail: (i) => `${i.nom}${i.description ? ` : ${i.description}` : ""}`,
  },
};

const DEMANDE_APP: Def = { libelle: "Application sur demande", champs: [{ nom: "libelle", max: 120 }, { nom: "besoin", max: 1000 }] };

/**
 * Définition d'un type de connecteur. Plusieurs serveurs MCP par espace : « mcp:<nom> »
 * (« mcp » seul reste valable pour les connexions enregistrées avant).
 */
export function defDe(type: string): Def | undefined {
  if (estTypeMcp(type)) return CONNECTEURS.mcp;
  if (estTypeApi(type)) return CONNECTEURS.api;
  return type === "api" ? undefined : CONNECTEURS[type];
}

/** Connecteurs au statut « connecte », pour le prompt des agents. */
export async function connecteursActifs(sb: SupabaseClient, wsId: string): Promise<ConnecteurActif[]> {
  const [{ data }, comptes] = await Promise.all([
    sb.from("studio_connecteurs").select("type, infos").eq("workspace_id", wsId).eq("statut", "connecte"),
    // Connexions en un clic (Zernio) de CET espace : messageries et réseaux sociaux.
    zernio.zernioConfigure() ? zernio.comptesBruts(wsId).catch(() => []) : Promise.resolve([] as Record<string, unknown>[]),
  ]);
  const enUnClic: ConnecteurActif[] = comptes.flatMap((a): ConnecteurActif[] => {
    const b = bureau.versBoite(a);
    if (b) {
      return [{
        type: `zernio:${b.fournisseur}`, libelle: `${bureau.NOMS_FOURNISSEURS[b.fournisseur]} (${b.zones.map((z) => bureau.NOMS_ZONES[z]).join(", ")})`,
        detail: [b.adresse, b.a_reconnecter ? "à reconnecter" : "connecté par le client"].filter(Boolean).join(" · "),
      }];
    }
    if (estApplication(a.platform)) {
      // Outils dans applications_outils.ts ; sans outil, l'agent ne doit pas prétendre y agir.
      return [{ type: `zernio:${a.platform}`, libelle: APPLICATIONS[a.platform].nom, detail: `${String(a.displayName || a.username || "compte relié")} · ${APPS_OUTILLEES.includes(a.platform) ? "reliée par le client : utilise les outils app_* indiqués plus bas" : "reliée par le client ; tu n'as pas d'outil pour y lire ni y agir : dis-le si on te le demande"}` }];
    }
    if (!zernio.estReseau(a.platform)) return [];
    return [{ type: `zernio:${a.platform}`, libelle: zernio.NOMS_RESEAUX[a.platform], detail: String(a.displayName || a.username || "connecté par le client") }];
  });
  return [...enUnClic, ...(data ?? []).filter((c) => defDe(c.type)).map((c) => ({
    type: c.type, libelle: defDe(c.type)!.libelle,
    detail: defDe(c.type)!.detail?.((c.infos ?? {}) as Record<string, string>),
  }))];
}

/** Liste pour le client : jamais le secret, seulement s'il est renseigné. */
export async function listerConnecteurs(sb: SupabaseClient, wsId: string) {
  const { data } = await sb.from("studio_connecteurs")
    .select("id, type, statut, infos, secret_chiffre, notes_admin, updated_at").eq("workspace_id", wsId);
  return (data ?? []).map(({ secret_chiffre, ...c }) => ({ ...c, secret_renseigne: Boolean(secret_chiffre) }));
}

export async function enregistrerConnecteur(
  sb: SupabaseClient, wsId: string, userId: string, body: Record<string, unknown>,
): Promise<{ ok: true } | { erreur: string }> {
  let type = String(body.type ?? "");
  // Nouveau serveur MCP : un connecteur par serveur, nommé d'après l'outil (« mcp:notion »).
  if (type === "mcp" && body.nouveau === true) {
    const s = slug(String((body.infos as Record<string, unknown> | undefined)?.nom ?? ""));
    if (!s) return { erreur: "Champ requis : nom" };
    type = `mcp:${s}`;
  }
  // Nouvelle API : un connecteur par API (« api:pennylane »). Le type « api » seul n'existe pas.
  if (type === "api") {
    const s = slug(String((body.infos as Record<string, unknown> | undefined)?.nom ?? ""));
    if (!s) return { erreur: "Champ requis : nom" };
    type = `api:${s}`;
  }
  // Autre application demandée à Aissociate : « app:<nom> ».
  const def = /^app:[a-z0-9][a-z0-9._-]{0,79}$/.test(type) ? DEMANDE_APP : defDe(type);
  if (!def) return { erreur: "Connecteur inconnu" };
  if (body.accord !== true) return { erreur: "Merci de cocher votre accord pour la mise en place de la connexion." };
  const brut = (body.infos ?? {}) as Record<string, unknown>;
  const infos: Record<string, string> = {};
  for (const c of def.champs) {
    const v = String(brut[c.nom] ?? "").trim().slice(0, c.max ?? 300);
    if (c.requis && !v) return { erreur: `Champ requis : ${c.nom}` };
    if (v) infos[c.nom] = v;
  }
  if (type === "smtp" && !/^\d{2,5}$/.test(infos.port ?? "")) return { erreur: "Port SMTP invalide" };
  if (estTypeMcp(type) && !urlAutorisee(infos.url ?? "")) return { erreur: "L'adresse du serveur MCP doit commencer par https:// et viser un serveur public." };
  if (estTypeMcp(type)) {
    const { count } = await sb.from("studio_connecteurs").select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId).or("type.eq.mcp,type.like.mcp:*").neq("type", type);
    if ((count ?? 0) >= SERVEURS_MAX) return { erreur: `${SERVEURS_MAX} serveurs MCP au plus par espace.` };
  }
  if (estTypeApi(type)) {
    if (!urlAutorisee(infos.url ?? "")) return { erreur: "L'adresse de l'API doit commencer par https:// et viser un serveur public." };
    if (infos.openapi && !urlAutorisee(infos.openapi)) return { erreur: "L'adresse de la description OpenAPI doit commencer par https:// et viser un serveur public." };
    if (!(AUTHS as readonly string[]).includes(infos.auth)) return { erreur: "Mode d'authentification inconnu." };
    if ((infos.auth === "entete" || infos.auth === "parametre") && !/^[A-Za-z0-9_.-]{1,80}$/.test(infos.auth_nom ?? "")) {
      return { erreur: infos.auth === "entete" ? "Indiquez le nom de l'en-tête (ex. X-API-Key)." : "Indiquez le nom du paramètre (ex. api_key)." };
    }
    if (infos.auth !== "entete" && infos.auth !== "parametre") delete infos.auth_nom;
    const { count } = await sb.from("studio_connecteurs").select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId).like("type", "api:*").neq("type", type);
    if ((count ?? 0) >= API_MAX) return { erreur: `${API_MAX} API au plus par espace.` };
  }

  const ligne: Record<string, unknown> = {
    workspace_id: wsId, type, infos, demande_par: userId,
    // Paramètres complets fournis : Aissociate vérifie puis passe en « connecte ».
    statut: "demande",
  };
  const secret = def.secret ? String((body.secret ?? "")).slice(0, 2000) : "";
  if (secret) ligne.secret_chiffre = await chiffrer(secret);
  else if (def.secret && !(estTypeApi(type) && infos.auth === "aucune")) {
    // Mise à jour sans ressaisie du secret : on garde l'ancien s'il existe.
    const { data: existant } = await sb.from("studio_connecteurs").select("secret_chiffre").eq("workspace_id", wsId).eq("type", type).maybeSingle();
    if (!existant?.secret_chiffre) return { erreur: type === "smtp" ? "Mot de passe SMTP requis" : estTypeApi(type) ? "Clé d'API requise" : "Jeton requis" };
  }
  const { error } = await sb.from("studio_connecteurs").upsert(ligne, { onConflict: "workspace_id,type" });
  if (error) return { erreur: error.message };
  return { ok: true };
}

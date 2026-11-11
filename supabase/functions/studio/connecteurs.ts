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
};

/** Connecteurs au statut « connecte », pour le prompt des agents. */
export async function connecteursActifs(sb: SupabaseClient, wsId: string): Promise<ConnecteurActif[]> {
  const { data } = await sb.from("studio_connecteurs").select("type, infos").eq("workspace_id", wsId).eq("statut", "connecte");
  return (data ?? []).filter((c) => CONNECTEURS[c.type]).map((c) => ({
    type: c.type, libelle: CONNECTEURS[c.type].libelle,
    detail: CONNECTEURS[c.type].detail?.((c.infos ?? {}) as Record<string, string>),
  }));
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
  const type = String(body.type ?? "");
  const def = CONNECTEURS[type];
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
  if (type === "mcp" && !/^https:\/\//i.test(infos.url ?? "")) return { erreur: "L'URL du serveur MCP doit commencer par https://" };

  const ligne: Record<string, unknown> = {
    workspace_id: wsId, type, infos, demande_par: userId,
    // Paramètres complets fournis : Aissociate vérifie puis passe en « connecte ».
    statut: "demande",
  };
  const secret = def.secret ? String((body.secret ?? "")).slice(0, 2000) : "";
  if (secret) ligne.secret_chiffre = await chiffrer(secret);
  else if (def.secret) {
    // Mise à jour sans ressaisie du secret : on garde l'ancien s'il existe.
    const { data: existant } = await sb.from("studio_connecteurs").select("secret_chiffre").eq("workspace_id", wsId).eq("type", type).maybeSingle();
    if (!existant?.secret_chiffre) return { erreur: type === "smtp" ? "Mot de passe SMTP requis" : "Jeton requis" };
  }
  const { error } = await sb.from("studio_connecteurs").upsert(ligne, { onConflict: "workspace_id,type" });
  if (error) return { erreur: error.message };
  return { ok: true };
}

// Invitations « connectez votre application » (lien envoyé par e-mail, valable 7 jours).
//
// L'espace vient TOUJOURS de l'invitation (côté serveur), jamais du navigateur.
// À l'ouverture, un lien de connexion Zernio est créé pour le profil de CET espace ;
// la personne revient ensuite sur la page de l'invitation (?retour=1).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { nouveauJeton, sha256 } from "./securite.ts";
import * as bureau from "./bureau.ts";
import * as zernio from "./zernio.ts";

const INVITATION_JOURS = 7;

/** Cibles d'invitation et libellés. Sans cible : toute messagerie (Google, Microsoft ou IMAP). */
export const CIBLES: Record<string, string> = {
  google: "Google (Gmail, Agenda, Drive)", microsoft: "Microsoft (Outlook, calendrier, OneDrive)", email: "votre messagerie",
  facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", tiktok: "TikTok",
};

export async function creerInvitation(sb: SupabaseClient, p: {
  wsId: string; cible?: string | null; email?: string | null; creePar: string; origine: string;
}): Promise<{ url: string; expire: string }> {
  if (p.cible && !(p.cible in CIBLES)) throw new Error("Application inconnue.");
  const jeton = nouveauJeton();
  const expire = new Date(Date.now() + INVITATION_JOURS * 86_400_000).toISOString();
  const { error } = await sb.from("studio_connexion_invitations").insert({
    token_hash: await sha256(jeton), workspace_id: p.wsId, integration_id: p.cible ?? null,
    email: p.email ?? null, cree_par: p.creePar, expires_at: expire,
  });
  if (error) throw new Error(error.message);
  return { url: `${p.origine.replace(/\/$/, "")}/studio/connecter/${jeton}`, expire };
}

/** Ouverture publique d'une invitation : lien de connexion pour l'espace de l'invitation. */
export async function ouvrirInvitation(sb: SupabaseClient, jeton: unknown, origine: string) {
  if (typeof jeton !== "string" || jeton.length !== 64) return null;
  const { data: inv } = await sb.from("studio_connexion_invitations")
    .select("id, workspace_id, integration_id, email, expires_at, studio_workspaces!inner(nom, actif)")
    .eq("token_hash", await sha256(jeton)).maybeSingle();
  if (!inv || new Date(inv.expires_at) < new Date()) return null;
  const ws = inv.studio_workspaces as unknown as { nom: string; actif: boolean };
  if (!ws.actif) return null;
  await sb.from("studio_connexion_invitations").update({ ouvert_at: new Date().toISOString() }).eq("id", inv.id);
  const cible = inv.integration_id && inv.integration_id in CIBLES ? String(inv.integration_id) : "email";
  const retour = `${origine.replace(/\/$/, "")}/studio/connecter/${jeton}?retour=1`;
  const lien = zernio.estReseau(cible)
    ? await zernio.lienConnexionReseau({ wsId: inv.workspace_id, wsNom: ws.nom, reseau: cible, retour })
    : await bureau.lienConnexion({ wsId: inv.workspace_id, wsNom: ws.nom, quoi: cible as "google" | "microsoft" | "email", retour });
  return { lien, espace: ws.nom.replace(/^Démo — /, ""), application: inv.integration_id ? CIBLES[cible] : null };
}

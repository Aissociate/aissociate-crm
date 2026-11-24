// Responsables d'un espace Studio : les personnes qui donnent des consignes aux agents.
// Leur nombre maximum vient du contrat (contrats.ts : responsables inclus + avenant « Responsables
// supplémentaires »), écrit dans studio_workspaces.max_utilisateurs par appliquerContrat (stripe.ts).
//
// Le propriétaire de l'espace gère lui-même ses responsables (réglages → Responsables) :
//   - inviter : compte « membre », mot de passe provisoire envoyé par e-mail, dans la limite du contrat ;
//   - retirer : le compte est désactivé (jamais supprimé : son historique reste), ses sessions fermées ;
//   - réactiver : un compte retiré revient, s'il reste une place.
// Passage à un contrat inférieur : les comptes en trop sont désactivés, les plus récents d'abord,
// jamais le propriétaire. Le propriétaire choisit ensuite qui réactiver.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { hasherMotDePasse } from "./securite.ts";
import { journaliser } from "./journal.ts";
import * as courriel from "./courriel.ts";
import { lister } from "./responsables_limite.ts";

export { ajuster, lister } from "./responsables_limite.ts";


const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


async function placeLibre(sb: SupabaseClient, wsId: string): Promise<{ max: number } | { erreur: string; statut: number }> {
  const { max, actifs } = await lister(sb, wsId);
  if (actifs >= max) {
    return { erreur: `Votre contrat comprend ${max} responsable${max > 1 ? "s" : ""}, déjà ${max > 1 ? "tous actifs" : "actif"}. Ajoutez un responsable à votre contrat (avenant) ou retirez quelqu'un.`, statut: 409 };
  }
  return { max };
}

export async function inviter(
  sb: SupabaseClient,
  p: { wsId: string; nomEspace: string; par: string; email: string; prenom?: string | null; nom?: string | null; site: string; motDePasse: string },
) {
  const email = p.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return { erreur: "Adresse e-mail invalide.", statut: 400 };
  const place = await placeLibre(sb, p.wsId);
  if ("erreur" in place) return place;

  // Déjà dans l'espace : un compte retiré est réactivé avec un nouveau mot de passe provisoire.
  const { data: existant } = await sb.from("studio_users").select("id, workspace_id, actif").eq("email", email).maybeSingle();
  if (existant && existant.workspace_id !== p.wsId) return { erreur: "Cette adresse a déjà un accès à un autre Studio : utilisez une autre adresse.", statut: 409 };
  if (existant?.actif) return { erreur: "Cette personne est déjà responsable de votre espace.", statut: 409 };

  let id: string;
  if (existant) {
    id = String(existant.id);
    await sb.from("studio_users").update({ actif: true, prenom: p.prenom || undefined, nom: p.nom || undefined }).eq("id", id);
  } else {
    const { data: u, error } = await sb.from("studio_users").insert({
      workspace_id: p.wsId, email, role: "membre", prenom: p.prenom || null, nom: p.nom || null,
    }).select("id").single();
    if (error) return { erreur: error.code === "23505" ? "Cette adresse a déjà un accès au Studio." : error.message, statut: 400 };
    id = String(u.id);
  }
  await sb.from("studio_credentials").upsert({
    user_id: id, password_hash: await hasherMotDePasse(p.motDePasse), doit_changer: true, updated_at: new Date().toISOString(),
  });

  let envoye = true;
  try {
    await courriel.envoyer(sb, { a: email, ...courriel.mailInvitationResponsable({ prenom: p.prenom ?? null, invitePar: p.par, espace: p.nomEspace, email, motDePasse: p.motDePasse, site: p.site }) });
  } catch (e) {
    envoye = false;
    console.error("[studio] invitation responsable :", e instanceof Error ? e.message : String(e));
  }
  await journaliser(sb, { wsId: p.wsId, acteur: `client:${p.par}`, action: "responsable_invite", detail: { email, reactive: Boolean(existant), email_envoye: envoye } });
  // Sans e-mail, le propriétaire transmet lui-même le mot de passe provisoire.
  return { ok: true as const, id, email_envoye: envoye, mot_de_passe: envoye ? null : p.motDePasse };
}

async function cibleMembre(sb: SupabaseClient, wsId: string, id: string) {
  const { data } = await sb.from("studio_users").select("id, email, role, actif").eq("id", id).eq("workspace_id", wsId).maybeSingle();
  if (!data) return { erreur: "Responsable introuvable.", statut: 404 };
  if (data.role === "proprietaire") return { erreur: "Le propriétaire de l'espace ne peut pas être retiré.", statut: 400 };
  return { compte: data as { id: string; email: string; role: string; actif: boolean } };
}

export async function retirer(sb: SupabaseClient, wsId: string, id: string, par: string) {
  const c = await cibleMembre(sb, wsId, id);
  if ("erreur" in c) return c;
  await sb.from("studio_users").update({ actif: false }).eq("id", id);
  await sb.from("studio_sessions").delete().eq("user_id", id);
  await journaliser(sb, { wsId, acteur: `client:${par}`, action: "responsable_retire", detail: { email: c.compte.email } });
  return { ok: true as const };
}

export async function reactiver(sb: SupabaseClient, wsId: string, id: string, par: string) {
  const c = await cibleMembre(sb, wsId, id);
  if ("erreur" in c) return c;
  if (c.compte.actif) return { ok: true as const };
  const place = await placeLibre(sb, wsId);
  if ("erreur" in place) return place;
  await sb.from("studio_users").update({ actif: true }).eq("id", id);
  await journaliser(sb, { wsId, acteur: `client:${par}`, action: "responsable_reactive", detail: { email: c.compte.email } });
  return { ok: true as const };
}


// Studio IA — états renvoyés au client : veille, contacts, liaison, abonnement, agents de l'espace, « me ».
// Extrait de index.ts (même code).
import { type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { type SuperPouvoir } from "./contexte.ts";
import * as veille from "./veille.ts";
import * as mailing from "./mailing.ts";
import * as bureau from "./bureau.ts";
import { type Passage } from "./routines.ts";
import { etatEspace, journaliser } from "./gouvernance.ts";
import { agentmailConfigure } from "./agentmail.ts";
import * as zernio from "./zernio.ts";
import { facturationEspace } from "./facturation.ts";
import * as stripe from "./stripe.ts";
import * as essai from "./essai.ts";
import * as contrats from "./contrats.ts";
import * as cgv from "./cgv.ts";
import * as equipe from "./equipe.ts";
import * as consignes from "./consignes.ts";
import * as pouvoirs from "./pouvoirs.ts";
import { pouvoirsQualiopi } from "./qualiopi.ts";
import { autorise, type Session } from "./socle.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Veille, contacts, mailings
// ─────────────────────────────────────────────────────────────────────────────

/** Désinscription par jeton → nom de l'entreprise, ou null si jeton inconnu. */
export async function desinscrire(sb: SupabaseClient, jeton: string): Promise<string | null> {
  if (!/^[a-f0-9]{32,64}$/.test(jeton)) return null;
  const { data: c } = await sb.from("studio_contacts").select("id, workspace_id, desinscrit_le, studio_workspaces(nom)").eq("jeton", jeton).maybeSingle();
  if (!c) return null;
  if (!c.desinscrit_le) {
    await sb.from("studio_contacts").update({ desinscrit_le: new Date().toISOString() }).eq("id", c.id);
    await sb.from("studio_envois").update({ statut: "ignore" }).eq("contact_id", c.id).eq("statut", "a_envoyer");
    await journaliser(sb, { wsId: String(c.workspace_id), acteur: "contact", agentId: null, action: "contact_desinscrit", detail: { contact: c.id } });
  }
  return String((c.studio_workspaces as unknown as { nom: string } | null)?.nom ?? "");
}

/** Passage horaire : campagnes avec des envois en attente (ou bloqués) relancées. */
export async function relancerEnvois(sb: SupabaseClient): Promise<number> {
  await sb.from("studio_envois").update({ statut: "a_envoyer" }).eq("statut", "en_cours").lt("updated_at", new Date(Date.now() - 15 * 60_000).toISOString());
  const { data } = await sb.from("studio_envois").select("livrable_id").eq("statut", "a_envoyer").limit(2000);
  const ids = [...new Set((data ?? []).map((x) => String(x.livrable_id)))].slice(0, 20);
  for (const id of ids) await mailing.declencherEnvois(sb, id);
  return ids.length;
}

export async function etatVeille(sb: SupabaseClient, wsId: string) {
  const [{ data: flux }, articles] = await Promise.all([
    sb.from("studio_flux").select("id, url, titre, site, actif, derniere_lecture, erreur").eq("workspace_id", wsId).order("created_at"),
    veille.actualites(sb, wsId, { heures: 24 * 7, max: 100 }),
  ]);
  return { flux: flux ?? [], articles, max: veille.FLUX_MAX };
}

export async function etatContacts(sb: SupabaseClient, wsId: string, recherche: unknown) {
  let q = sb.from("studio_contacts").select("id, email, prenom, nom, listes, source, desinscrit_le, created_at")
    .eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(300);
  const r = String(recherche ?? "").trim().replace(/[%_,()\\]/g, " ").slice(0, 80);
  if (r) q = q.or(`email.ilike.%${r}%,prenom.ilike.%${r}%,nom.ilike.%${r}%`);
  const [{ data }, resume, campagnes] = await Promise.all([q, mailing.resumeContacts(sb, wsId), mailing.campagnes(sb, wsId)]);
  const boite = zernio.zernioConfigure() ? bureau.boitePour(await bureau.boitesEspace(wsId).catch(() => []), "email") : null;
  return {
    contacts: data ?? [], ...resume, campagnes, boite: boite?.adresse ?? null,
    plafond_jour: boite ? bureau.plafondJour(boite) : 0, plafond_heure: mailing.PLAFOND_HEURE,
  };
}

/** État du canal e-mail d'un espace (+ derniers e-mails reçus). Colonnes absentes → non disponible. */
export async function etatLiaison(sb: SupabaseClient, wsId: string, avecExpediteurs: boolean) {
  const { data: w, error } = await sb.from("studio_workspaces")
    .select("liaison_email, liaison_actif, liaison_agent").eq("id", wsId).maybeSingle();
  if (error || !w) return { disponible: false, configure: agentmailConfigure(), email: null, actif: false, agent: null, instructions: [] };
  const { data: instr } = await sb.from("studio_instructions")
    .select(`reference, sujet, type, statut, motif, agent_id, livrable_id, created_at${avecExpediteurs ? ", expediteur, extrait" : ""}`)
    .eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(50);
  return {
    disponible: true, configure: agentmailConfigure(), email: w.liaison_email, actif: w.liaison_actif === true,
    agent: w.liaison_agent, instructions: instr ?? [],
  };
}

/** Agents accessibles à l'espace : actifs au catalogue, inclus dans l'offre, non désactivés pour l'espace. */
/** Refus d'un nouveau connecteur pendant l'essai gratuit (un seul permis) ; null sinon. */
// Aussi : limite des badges d'accès du contrat (contrats.ts, colonne connecteurs_max).
export async function refusConnecteurEssai(sb: SupabaseClient, s: Session): Promise<string | null> {
  const max = s.ws.connecteurs_max;
  if (!essai.enEssai(s.ws) && max == null) return null;
  const f = await facturationEspace(sb, s.ws.id);
  if (essai.enEssai(s.ws)) return f.lignes.length >= essai.CONNECTEURS_ESSAI ? essai.MESSAGE_CONNECTEUR : null;
  if (max == null || f.lignes.length < max) return null;
  return max === 0
    ? "Votre contrat Stage ne donne aucun badge d'accès à vos outils. Choisissez un contrat ou ajoutez un badge dans « Mon abonnement »."
    : `Vos ${max} badge${max > 1 ? "s" : ""} d'accès sont utilisés. Retirez une connexion ou ajoutez un badge (avenant) dans « Mon abonnement ».`;
}

/** Abonnement en ligne de l'espace (Mon périmètre) : ce qui est facturé et ce que l'équipe compte aujourd'hui. */
export async function etatAbonnement(sb: SupabaseClient, wsId: string, nbAgents: number) {
  const [{ data: w }, conn] = await Promise.all([
    sb.from("studio_workspaces").select("abonnement_statut, abonnement_fin, abonnement_agents, abonnement_connecteurs, abonnement_mensuel, entete, contrat, contrat_choix").eq("id", wsId).maybeSingle(),
    facturationEspace(sb, wsId),
  ]);
  const enCours = Boolean(w?.abonnement_statut && stripe.STATUTS_EN_COURS.includes(String(w.abonnement_statut)) && w.abonnement_statut !== "incomplete");
  return {
    // Grille des contrats : choix en vigueur (Stage par défaut) ; ancienne_grille = abonné facturé par agent.
    contrat: w?.contrat ? contrats.normaliser(w.contrat_choix ?? { contrat: w.contrat }) : null,
    ancienne_grille: enCours && !w?.contrat,
    statut: w?.abonnement_statut ?? null, fin: w?.abonnement_fin ?? null, mensuel_ht: w?.abonnement_mensuel ?? null,
    factures: { agents: w?.abonnement_agents ?? null, connecteurs: w?.abonnement_connecteurs ?? null },
    actuels: { agents: nbAgents, connecteurs: conn.erreur ? null : conn.nb_factures },
    prix_connecteur: conn.tarif.prix, test: stripe.modeTest(),
    // La Réunion : 8,5 % fixe ; ailleurs : TVA calculée par Stripe selon l'adresse (null).
    tva_pourcent: !stripe.TAXE_AUTOMATIQUE || stripe.tvaReunion((w?.entete as Record<string, string> | null)?.code_postal) ? stripe.TVA_POURCENT : null,
    estimation_ht: Math.round((stripe.montantAgents(nbAgents) + (conn.erreur ? 0 : conn.nb_factures * conn.tarif.prix)) * 100) / 100,
    // Ce qu'un agent de plus ajoute à l'abonnement (tarif dégressif).
    agent_suivant_ht: Math.round((stripe.montantAgents(nbAgents + 1) - stripe.montantAgents(nbAgents)) * 100) / 100,
    premier_agent_ht: stripe.PALIERS_AGENTS[0] / 100, dernier_palier_ht: stripe.PALIERS_AGENTS[stripe.PALIERS_AGENTS.length - 1] / 100,
  };
}

export async function agentsDuWorkspace(sb: SupabaseClient, ws: Session["ws"]) {
  const [{ data: agents }, { data: reglages }] = await Promise.all([
    sb.from("studio_agents").select("id, prenom, metier, accroche, description, prompt_systeme, demandes, super_pouvoirs, minutes_par_tache, couleur, offres, ordre, modele, photo")
      .eq("actif", true).order("ordre"),
    sb.from("studio_workspace_agents").select("agent_id, actif, consignes, modele").eq("workspace_id", ws.id),
  ]);
  const parAgent = new Map((reglages ?? []).map((r) => [r.agent_id, r]));
  // L'essai gratuit donne les agents de la formule Essentiel (aucun agent ne liste « essai » dans ses offres).
  const offre = ws.offre === "essai" ? "essentiel" : ws.offre;
  return (agents ?? [])
    // L'orchestratrice (Léa) est le point d'entrée de tous les espaces : toujours présente, jamais facturée.
    .filter((a) => equipe.estOrchestrateur(a.id) || ((a.offres as string[]).includes(offre) && parAgent.get(a.id)?.actif !== false))
    .map((a) => ({
      ...a,
      // Conformité Qualiopi : super-pouvoirs ajoutés à Nora dans l'espace de l'organisme seulement (qualiopi.ts).
      super_pouvoirs: [...((a.super_pouvoirs ?? []) as SuperPouvoir[]), ...pouvoirsQualiopi(ws.id, a.id as string)],
      consignes: parAgent.get(a.id)?.consignes ?? "",
      // Priorité : cet agent pour ce client > ce client > cet agent (le défaut global vient de `parametres`).
      modele_effectif: autorise(parAgent.get(a.id)?.modele) ?? autorise(ws.modele) ?? autorise(a.modele as string | null),
    }));
}

export function debutMois(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function compterDemandesMois(sb: SupabaseClient, wsId: string): Promise<number> {
  const { count } = await sb.from("studio_messages").select("id", { count: "exact", head: true })
    .eq("workspace_id", wsId).eq("role", "user").eq("hors_quota", false).gte("created_at", debutMois());
  return count ?? 0;
}

export async function construireMe(sb: SupabaseClient, s: Session) {
  const agents = await agentsDuWorkspace(sb, s.ws);
  const minutesParAgent = new Map(agents.map((a) => [a.id, a.minutes_par_tache as number]));
  const [demandesMois, { data: reponses }, { data: credentials }, { data: conversations }, { count: nbRessources }, etat, { count: aValider }] = await Promise.all([
    compterDemandesMois(sb, s.ws.id),
    // Réponses utiles (non notées « à revoir ») : base du temps gagné affiché.
    sb.from("studio_messages").select("agent_id, created_at, retour")
      .eq("workspace_id", s.ws.id).eq("role", "assistant").or("retour.is.null,retour.eq.1")
      // Un relais vers un collègue (demande hors périmètre) n'a fait gagner aucun temps.
      .not("content", "like", "%[[RELAIS:%").limit(20000),
    sb.from("studio_credentials").select("doit_changer").eq("user_id", s.user.id).maybeSingle(),
    sb.from("studio_conversations").select("id, agent_id, titre, updated_at")
      .eq("workspace_id", s.ws.id).eq("user_id", s.user.id).order("updated_at", { ascending: false }).limit(8),
    sb.from("studio_documents").select("id", { count: "exact", head: true }).eq("workspace_id", s.ws.id).eq("actif", true),
    etatEspace(sb, s.ws.id),
    sb.from("studio_livrables").select("id", { count: "exact", head: true }).eq("workspace_id", s.ws.id).eq("statut", "a_valider"),
  ]);
  // Guide de prise en main : lu à part, pour ne rien casser tant que la colonne n'existe pas (null = inconnu).
  const { data: tuto, error: eTuto } = await sb.from("studio_users").select("tutoriel_vu_le").eq("id", s.user.id).maybeSingle();
  const mois = debutMois();
  let minutesTotal = 0, minutesMois = 0, reponsesMois = 0;
  for (const r of reponses ?? []) {
    const m = minutesParAgent.get(String(r.agent_id)) ?? 15;
    minutesTotal += m;
    if (String(r.created_at) >= mois) { minutesMois += m; reponsesMois++; }
  }
  return {
    user: {
      ...s.user, doit_changer: credentials?.doit_changer ?? false,
      cgv_a_accepter: await cgv.chargerCgv(sb).then((c) => Boolean(c && c.version !== s.user.cgv_version)),
      tutoriel_vu: eTuto ? null : Boolean((tuto as { tutoriel_vu_le?: string | null } | null)?.tutoriel_vu_le),
    },
    essai: essai.enEssai(s.ws) ? { fin: s.ws.essai_fin, jours_restants: essai.joursRestants(s.ws), termine: essai.essaiTermine(s.ws) } : null,
    workspace: { ...s.ws, suspendu: etat.suspendu },
    // Le gabarit (consigne détaillée) des super-pouvoirs reste côté serveur.
    agents: agents.map(({ prompt_systeme: _p, offres: _o, consignes: _c, modele: _m, modele_effectif: _me, super_pouvoirs, ...a }) => ({
      ...a,
      super_pouvoirs: ((super_pouvoirs ?? []) as SuperPouvoir[]).map(({ gabarit: _g, ...sp }) => sp),
    })),
    stats: {
      demandes_mois: demandesMois, quota_mois: s.ws.quota_messages_mois,
      reponses_mois: reponsesMois, minutes_gagnees_mois: minutesMois, minutes_gagnees_total: minutesTotal,
      ressources_actives: nbRessources ?? 0, livrables_a_valider: aValider ?? 0,
    },
    conversations: conversations ?? [],
  };
}

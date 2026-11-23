// Gouvernance du Studio (reprise du paquet « plateforme multi-tenant », vague 1) :
// onboarding public → provisionnement depuis le CRM, suspension (kill switch),
// plafond de dépense IA par jour, journal d'audit chaîné, livrables à valider.
// Tout est cloisonné par l'espace : celui de la session, ou celui désigné par
// un manager du CRM. Les tables sont écrites en service role uniquement.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { hasherMotDePasse } from "./securite.ts";
import { nettoyerHtml } from "./html.ts";
import { AGENTS_CATALOGUE, ficheEntreprise, scorer, validerReponses, type Reponses } from "./questionnaire.ts";
import { journaliser, verifierChaine, type LigneJournal } from "./journal.ts";
import * as courriel from "./courriel.ts";
import * as harnais from "./harnais.ts";
import * as contrats from "./contrats.ts";
import { apercuAction, executerAction, modifierAction, titreAction, type ActionLivrable } from "./outils.ts";
import { deciderLivrable as decider, raisonRefus, RAISONS_REFUS } from "./livrables.ts";
import type { Refus } from "./contexte.ts";

export { journaliser };

type Config = Record<string, string>;

export async function chargerConfig(sb: SupabaseClient, cles: string[]): Promise<Config> {
  const { data } = await sb.from("studio_config").select("cle, valeur").in("cle", cles);
  return Object.fromEntries((data ?? []).map((r) => [r.cle, String(r.valeur ?? "")]));
}

const nombreOuNull = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Garde : suspension et plafond de dépense (avant toute mission qui coûte)
// ─────────────────────────────────────────────────────────────────────────────

/** Début du jour à La Réunion (UTC+4, sans heure d'été), en ISO UTC. */
export function debutJourReunion(maintenant = new Date()): string {
  const local = new Date(maintenant.getTime() + 4 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 4 * 3_600_000).toISOString();
}

/** Dépense IA du jour de l'espace, en euros (réponses + médias, coût réel OpenRouter). */
export async function depenseJour(sb: SupabaseClient, wsId: string): Promise<number> {
  const depuis = debutJourReunion();
  const [{ data: msgs }, { data: medias }, cfg] = await Promise.all([
    sb.from("studio_messages").select("cout").eq("workspace_id", wsId).gte("created_at", depuis).not("cout", "is", null).limit(5000),
    sb.from("studio_medias").select("cout").eq("workspace_id", wsId).gte("created_at", depuis).not("cout", "is", null).limit(1000),
    chargerConfig(sb, ["taux_usd_eur"]),
  ]);
  const usd = [...(msgs ?? []), ...(medias ?? [])].reduce((t, r) => t + (Number(r.cout) || 0), 0);
  return usd * (Number(cfg.taux_usd_eur) || 0.92);
}

/** État de gouvernance de l'espace (colonnes absentes = migration non appliquée → rien ne bloque). */
export async function etatEspace(sb: SupabaseClient, wsId: string) {
  const { data, error } = await sb.from("studio_workspaces")
    .select("suspendu, suspendu_le, suspendu_par, budget_ia_jour_eur").eq("id", wsId).maybeSingle();
  if (error || !data) return { suspendu: false, suspendu_le: null, suspendu_par: null, budget_ia_jour_eur: null as number | null };
  return {
    suspendu: data.suspendu === true, suspendu_le: data.suspendu_le as string | null,
    suspendu_par: data.suspendu_par as string | null, budget_ia_jour_eur: nombreOuNull(data.budget_ia_jour_eur),
  };
}

/** Refus motivé si l'espace est suspendu ou a atteint son plafond du jour ; null sinon. */
export async function garde(sb: SupabaseClient, wsId: string): Promise<{ message: string; statut: number } | null> {
  const e = await etatEspace(sb, wsId);
  if (e.suspendu) {
    return { statut: 423, message: "Les agents de votre espace sont suspendus. Le propriétaire peut les relancer depuis « Mon périmètre »." };
  }
  if (e.budget_ia_jour_eur != null && (await depenseJour(sb, wsId)) >= e.budget_ia_jour_eur) {
    return { statut: 429, message: "Le plafond de dépense IA du jour est atteint : les agents reprennent demain. Contactez Aissociate pour le relever." };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding public → demande dans le CRM
// ─────────────────────────────────────────────────────────────────────────────

export type ResultatOnboarding = { ok: true; id: string; essai?: boolean; identifiants_envoyes?: boolean; deja_client?: boolean };

/** Contrôle quotidien du parcours (controle.ts) : pas de lead dans le CRM, e-mail capturé au lieu d'être envoyé. */
export type ModeControle = { courriel: (m: { a: string; objet: string; html: string; texte: string }) => void };

/** Demandes acceptées par adresse IP et par 24 h (un essai ouvre un espace et envoie un e-mail : pas d'envoi en rafale). */
export const DEMANDES_PAR_IP_JOUR = 3;

export async function soumettreOnboarding(sb: SupabaseClient, body: Record<string, unknown>, origine: string, site = "", controle?: ModeControle, ip: string | null = null): Promise<ResultatOnboarding | { erreur: string; statut: number }> {
  // Champ piège invisible : un robot le remplit, un humain non. Réponse muette.
  if (String(body.site_web_entreprise ?? "").trim()) return { ok: true, id: "" };
  const cfg = await chargerConfig(sb, ["onboarding_ouvert"]);
  if (cfg.onboarding_ouvert === "false") return { erreur: "Les inscriptions sont momentanément fermées. Écrivez-nous à contact@aissociate.re.", statut: 403 };

  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erreur: "Adresse e-mail invalide.", statut: 400 };
  const contact = String(body.contact_nom ?? "").trim().slice(0, 120);
  if (!contact) return { erreur: "Indiquez votre nom.", statut: 400 };
  const telephone = String(body.telephone ?? "").trim().slice(0, 40) || null;
  if (body.accord !== true) return { erreur: "Votre accord est nécessaire pour traiter la demande.", statut: 400 };

  const reponses = (body.reponses ?? {}) as Reponses;
  const invalide = validerReponses(reponses);
  if (invalide) return { erreur: invalide, statut: 400 };

  // Une demande par e-mail toutes les 10 minutes, 5 par jour.
  const { data: recentes } = await sb.from("studio_onboarding").select("created_at")
    .ilike("email", email).gte("created_at", new Date(Date.now() - 86_400_000).toISOString()).limit(10);
  if ((recentes ?? []).length >= 5 || (recentes ?? []).some((r) => Date.now() - new Date(r.created_at).getTime() < 600_000)) {
    return { erreur: "Nous avons déjà reçu votre demande : nous revenons vers vous très vite.", statut: 429 };
  }

  if (ip && !controle) {
    // Colonne absente (migration studio_autonomie non appliquée) : la limite est simplement ignorée.
    const { count, error: eIp } = await sb.from("studio_onboarding").select("id", { count: "exact", head: true })
      .eq("ip", ip).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if (!eIp && (count ?? 0) >= DEMANDES_PAR_IP_JOUR) {
      return { erreur: "Plusieurs demandes viennent d'être envoyées depuis cette connexion. Réessayez demain ou écrivez-nous à contact@aissociate.re.", statut: 429 };
    }
  }

  const s = scorer(reponses);
  const entreprise = String(reponses.A1 ?? "").trim().slice(0, 200);
  const agents = (reponses.agents as string[]) ?? [];
  const ligne = {
    entreprise, contact_nom: contact, email, telephone, agents, reponses,
    score: s.score, lecture: s.lecture, drapeaux: s.drapeaux,
  };
  let { data, error } = await sb.from("studio_onboarding").insert(ip && !controle ? { ...ligne, ip } : ligne).select("id").single();
  if (error && /\bip\b/.test(error.message)) ({ data, error } = await sb.from("studio_onboarding").insert(ligne).select("id").single());
  if (error || !data) return { erreur: `Enregistrement impossible : ${error?.message ?? "réponse vide"}`, statut: 500 };

  // Lead dans le CRM, comme les formulaires du site (trigger lead_to_contact).
  const [prenom, ...reste] = contact.split(/\s+/);
  if (!controle) {
    const libelles = new Map(AGENTS_CATALOGUE.map((a) => [a.id, a.libelle.split(" —")[0]]));
    await sb.from("contact_requests").insert({
      first_name: reste.length ? prenom : null, last_name: reste.length ? reste.join(" ") : contact,
      email, phone: telephone, company: entreprise || null, request_type: "Studio IA (questionnaire d'onboarding)",
      message: [
        `Questionnaire d'onboarding complété : score ${s.score}/100 (${s.lecture}).`,
        `Agents souhaités : ${agents.map((a) => libelles.get(a) ?? a).join(", ")}`,
        s.drapeaux.length ? `Points d'attention : ${s.drapeaux.join(", ")}` : "",
        `Demande à traiter dans CRM › Studio IA clients › Demandes. [onboarding:${data.id}]`,
      ].filter(Boolean).join("\n"),
      source: origine, status: "new",
    }).then(({ error: e }) => { if (e) console.error("[studio] lead onboarding:", e.message); });
  }

  return { ok: true, id: data.id, ...(await essaiAutomatique(sb, data.id, site, controle)) };
}

/**
 * Essai gratuit ouvert dès le questionnaire (réglage `essai_auto`) : espace créé avec les agents
 * demandés, mot de passe provisoire envoyé par e-mail. Un échec d'envoi laisse l'espace créé :
 * le CRM le voit (identifiants_envoyes_le vide) et peut régénérer le mot de passe.
 */
async function essaiAutomatique(sb: SupabaseClient, demandeId: string, site: string, controle?: ModeControle): Promise<{ essai: boolean; identifiants_envoyes?: boolean; deja_client?: boolean }> {
  const cfg = await chargerConfig(sb, ["essai_auto", "essai_jours"]);
  if (cfg.essai_auto !== "true" || !site) return { essai: false };
  const jours = Math.min(60, Math.max(1, Math.round(Number(cfg.essai_jours) || 7)));
  // Depuis le 23/11/2026 : contrat Stage gratuit, sans limite de durée (contrats.ts), au lieu de l'essai.
  const p = await provisionner(sb, { demande_id: demandeId, offre: "stage" }, null);
  if ("erreur" in p) {
    console.error("[studio] essai automatique:", p.erreur);
    return { essai: false, deja_client: String(p.erreur).includes("déjà un accès") };
  }
  try {
    const m = courriel.mailIdentifiants({
      prenom: p.prenom, entreprise: p.nom.replace(/^Démo — /, ""), email: p.email, motDePasse: p.mot_de_passe,
      site, finEssai: p.essai_fin, jours,
    });
    if (controle) controle.courriel({ a: p.email, ...m });
    else await courriel.envoyer(sb, { a: p.email, ...m });
    await sb.from("studio_onboarding").update({ identifiants_envoyes_le: new Date().toISOString() }).eq("id", demandeId);
    await journaliser(sb, { wsId: p.workspace_id, acteur: "systeme", action: "identifiants_envoyes", detail: { email: p.email, essai_jours: jours } });
    return { essai: true, identifiants_envoyes: true };
  } catch (e) {
    console.error("[studio] envoi des identifiants:", e instanceof Error ? e.message : String(e));
    return { essai: true, identifiants_envoyes: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provisionnement (CRM) : demande → espace prêt, identifiants du propriétaire
// ─────────────────────────────────────────────────────────────────────────────

/** Mot de passe provisoire lisible (sans 0/O ni 1/l), conforme à motDePasseValide. */
export function motDePasseProvisoire(): string {
  const lettres = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ", chiffres = "23456789";
  const tirage = crypto.getRandomValues(new Uint32Array(12));
  const corps = [...tirage.slice(0, 8)].map((n) => lettres[n % lettres.length]).join("");
  const fin = [...tirage.slice(8)].map((n) => chiffres[n % chiffres.length]).join("");
  return `${corps.slice(0, 4)}-${corps.slice(4)}-${fin}`;
}

export async function provisionner(sb: SupabaseClient, body: Record<string, unknown>, managerId: string | null, options: { essaiJours?: number } = {}) {
  const { data: d } = await sb.from("studio_onboarding").select("*").eq("id", String(body.demande_id ?? "")).maybeSingle();
  if (!d) return { erreur: "Demande introuvable", statut: 404 };
  if (d.statut === "provisionnee" && d.workspace_id) return { erreur: "Cet espace a déjà été créé.", statut: 400 };

  const cfg = await chargerConfig(sb, ["defaut_budget_ia_jour_eur", "defaut_quota_messages_mois", "defaut_quota_images_mois", "defaut_quota_videos_mois"]);
  const agents = (Array.isArray(body.agents) ? body.agents : d.agents).map(String)
    .filter((a: string) => AGENTS_CATALOGUE.some((c) => c.id === a));
  if (!agents.length) return { erreur: "Choisissez au moins un agent.", statut: 400 };

  const reponses = (d.reponses ?? {}) as Reponses;
  // « stage » : contrat Stage gratuit de la grille (formule Essentiel pour le choix des agents).
  const stage = String(body.offre) === "stage";
  const offre = stage ? "essentiel" : ["essai", "essentiel", "pro", "sur_mesure"].includes(String(body.offre)) ? String(body.offre) : "sur_mesure";
  const essaiFin = offre === "essai" ? new Date(Date.now() + (options.essaiJours ?? 7) * 86_400_000).toISOString() : null;
  const droitsStage = contrats.droits(contrats.CHOIX_STAGE);
  const { data: ws, error } = await sb.from("studio_workspaces").insert({
    nom: String(body.nom ?? d.entreprise).trim().slice(0, 120) || d.entreprise,
    offre, secteur: String(reponses.A2 ?? "").slice(0, 120) || null,
    contexte_entreprise: ficheEntreprise(reponses),
    ...(stage ? {
      contrat: "stage", contrat_choix: contrats.CHOIX_STAGE, connecteurs_max: droitsStage.connecteurs_max,
      max_utilisateurs: droitsStage.max_utilisateurs, stockage_go: droitsStage.stockage_go, astreinte: false,
    } : {}),
    quota_messages_mois: stage ? droitsStage.quota_messages_mois : nombreOuNull(cfg.defaut_quota_messages_mois) ?? 300,
    quota_images_mois: nombreOuNull(cfg.defaut_quota_images_mois) ?? 30,
    quota_videos_mois: nombreOuNull(cfg.defaut_quota_videos_mois) ?? 5,
    budget_ia_jour_eur: nombreOuNull(cfg.defaut_budget_ia_jour_eur),
    abonnement_mensuel: nombreOuNull(body.abonnement_mensuel),
    essai_fin: essaiFin,
    created_by: managerId,
  }).select("id, nom").single();
  if (error) return { erreur: error.message, statut: 400 };

  // Agents : ceux de la formule ouverts, les autres fermés (visibles « hors formule »).
  await sb.from("studio_workspace_agents").insert(
    AGENTS_CATALOGUE.map((a) => ({ workspace_id: ws.id, agent_id: a.id, actif: agents.includes(a.id) })),
  );

  // Propriétaire : l'auteur de la demande, mot de passe provisoire à changer.
  const motDePasse = motDePasseProvisoire();
  const [prenom, ...reste] = String(d.contact_nom ?? "").split(/\s+/);
  const { data: u, error: eu } = await sb.from("studio_users").insert({
    workspace_id: ws.id, email: String(d.email).toLowerCase(), role: "proprietaire",
    prenom: prenom || null, nom: reste.join(" ") || null,
  }).select("id").single();
  if (eu) {
    // L'e-mail a déjà un accès (un seul espace par e-mail) : on défait l'espace créé.
    await sb.from("studio_workspaces").delete().eq("id", ws.id);
    return { erreur: eu.code === "23505" ? "Cet e-mail a déjà un accès au Studio : utilisez une autre adresse." : eu.message, statut: 400 };
  }
  await sb.from("studio_credentials").insert({ user_id: u.id, password_hash: await hasherMotDePasse(motDePasse), doit_changer: true });
  await sb.from("studio_onboarding").update({ statut: "provisionnee", workspace_id: ws.id, traite_par: managerId }).eq("id", d.id);
  // Harnais métier généré par l'IA à partir du secteur (A2), en arrière-plan (harnais.ts).
  await harnais.apresCreation(sb, ws.id, String(d.email), String(reponses.A2 ?? "").trim() || null)
    .catch((e) => console.error("[studio] harnais à la création :", e instanceof Error ? e.message : String(e)));
  await journaliser(sb, {
    wsId: ws.id, acteur: "crm", action: "espace_cree",
    detail: { demande: d.id, agents, score: d.score, drapeaux: d.drapeaux },
  });
  return {
    ok: true as const, workspace_id: ws.id, nom: String(ws.nom), email: String(d.email).toLowerCase(), mot_de_passe: motDePasse,
    prenom: prenom || null, essai_fin: essaiFin,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suspension (propriétaire ou CRM)
// ─────────────────────────────────────────────────────────────────────────────

export async function suspendre(sb: SupabaseClient, wsId: string, suspendu: boolean, par: string) {
  const { error } = await sb.from("studio_workspaces").update({
    suspendu, suspendu_le: suspendu ? new Date().toISOString() : null, suspendu_par: suspendu ? par : null,
  }).eq("id", wsId);
  if (error) return { erreur: error.message };
  await journaliser(sb, { wsId, acteur: par, action: suspendu ? "suspension" : "reprise" });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Journal
// ─────────────────────────────────────────────────────────────────────────────

export async function lireJournal(sb: SupabaseClient, wsId: string, limite = 200) {
  const { data } = await sb.from("studio_journal").select("id, acteur, agent_id, action, detail, created_at")
    .eq("workspace_id", wsId).order("id", { ascending: false }).limit(limite);
  return data ?? [];
}

export async function verifierJournal(sb: SupabaseClient, wsId: string) {
  const { data } = await sb.from("studio_journal").select("*").eq("workspace_id", wsId).order("id").limit(50000);
  return await verifierChaine((data ?? []) as LigneJournal[]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Livrables à valider : a_valider → valide | refuse → publie
// ─────────────────────────────────────────────────────────────────────────────

export async function soumettreLivrable(sb: SupabaseClient, wsId: string, acteur: string, messageId: string) {
  const { data: m } = await sb.from("studio_messages")
    .select("id, content, agent_id, conversation_id, studio_conversations!inner(titre)")
    .eq("id", messageId).eq("workspace_id", wsId).eq("role", "assistant").maybeSingle();
  if (!m) return { erreur: "Réponse introuvable", statut: 404 };
  const { data: deja } = await sb.from("studio_livrables").select("id, statut").eq("message_id", m.id).maybeSingle();
  if (deja) return { ok: true, id: deja.id, statut: deja.statut };
  const titre = (m.studio_conversations as unknown as { titre: string }).titre || "Livrable";
  const { data, error } = await sb.from("studio_livrables").insert({
    workspace_id: wsId, message_id: m.id, conversation_id: m.conversation_id, agent_id: m.agent_id,
    titre: titre.slice(0, 200), contenu: String(m.content), soumis_par: acteur,
  }).select("id, statut").single();
  if (error) return { erreur: error.message, statut: 400 };
  await journaliser(sb, { wsId, acteur, agentId: m.agent_id, action: "livrable_soumis", detail: { livrable: data.id, titre } });
  return { ok: true, id: data.id, statut: data.statut };
}

/** Décision du propriétaire (livrables.ts) : seul appel d'executerAction de tout le Studio. */
export function deciderLivrable(sb: SupabaseClient, wsId: string, decideur: { acteur: string; proprietaire: boolean }, body: Record<string, unknown>) {
  return decider(sb, wsId, decideur, body, {
    executer: (action, livrableId) => executerAction(sb, wsId, action as ActionLivrable, livrableId),
    journaliser: (e) => journaliser(sb, { wsId, ...e }),
  });
}

const VERSIONS_MAX = 20;

/**
 * Modification d'un livrable par un utilisateur de l'espace, avant publication.
 * La version précédente est conservée (20 dernières) ; toute modification repasse
 * le livrable « à valider » : ce qui part est toujours la version validée.
 * Livrable porteur d'une action : les champs (destinataires, horaires…) sont revalidés.
 */
export async function modifierLivrable(sb: SupabaseClient, wsId: string, acteur: string, body: Record<string, unknown>) {
  const { data: l } = await sb.from("studio_livrables").select("id, statut, titre, contenu, agent_id, action, versions, format")
    .eq("id", String(body.id ?? "")).eq("workspace_id", wsId).maybeSingle();
  if (!l) return { erreur: "Livrable introuvable", statut: 404 };
  if (l.statut === "publie") return { erreur: "Un livrable publié ne se modifie plus.", statut: 400 };

  const champs = (body.champs ?? {}) as Record<string, unknown>;
  const maj: Record<string, unknown> = {};
  if (l.action) {
    const action = modifierAction(l.action as ActionLivrable, champs);
    if ("erreur" in action) return { erreur: action.erreur, statut: 400 };
    Object.assign(maj, { action, titre: titreAction(action), contenu: apercuAction(action), resultat: null });
  } else {
    // Document HTML : renettoyé à chaque enregistrement (édition WYSIWYG ou agent).
    const contenu = l.format === "html" ? nettoyerHtml(String(champs.contenu ?? "")) : String(champs.contenu ?? "").slice(0, 200_000);
    if (!contenu.trim()) return { erreur: "Le contenu ne peut pas être vide.", statut: 400 };
    maj.contenu = contenu;
    maj.titre = String(champs.titre ?? "").trim().slice(0, 200) || l.titre;
  }
  if (maj.contenu === l.contenu && maj.titre === l.titre) return { ok: true, inchange: true };

  const versions = [
    { titre: l.titre, contenu: l.contenu, action: l.action ?? null, par: acteur, le: new Date().toISOString() },
    ...((l.versions ?? []) as unknown[]),
  ].slice(0, VERSIONS_MAX);
  const { error } = await sb.from("studio_livrables").update({
    ...maj, versions, statut: "a_valider", decide_par: null, decide_le: null,
  }).eq("id", l.id);
  if (error) return { erreur: error.message, statut: 400 };
  await journaliser(sb, { wsId, acteur, agentId: l.agent_id, action: "livrable_modifie", detail: { livrable: l.id, titre: maj.titre ?? l.titre, version: versions.length + 1 } });
  return { ok: true };
}

export async function listerLivrables(sb: SupabaseClient, wsId: string) {
  const colonnes = "id, titre, contenu, statut, agent_id, conversation_id, soumis_par, decide_par, decide_le, commentaire, created_at, type_action:action->>type, action, resultat, versions, dossier_id, format";
  const lire = (c: string) => sb.from("studio_livrables").select(c).eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(200);
  // Colonnes des migrations récentes (refus_raison, confie_par) : si l'une manque, la liste reste lisible.
  for (const c of [`${colonnes}, refus_raison, confie_par`, `${colonnes}, refus_raison`]) {
    const { data, error } = await lire(c);
    if (!error) return data ?? [];
  }
  return (await lire(colonnes)).data ?? [];
}

/** Derniers refus du propriétaire pour cet agent (60 jours, 5 au plus), rendus à l'agent dans son contexte. */
export async function refusRecents(sb: SupabaseClient, wsId: string, agentId: string): Promise<Refus[]> {
  const { data, error } = await sb.from("studio_livrables").select("titre, refus_raison, commentaire, decide_le")
    .eq("workspace_id", wsId).eq("agent_id", agentId).eq("statut", "refuse")
    .gte("decide_le", new Date(Date.now() - 60 * 86_400_000).toISOString())
    .order("decide_le", { ascending: false }).limit(5);
  if (error) return [];
  return (data ?? []).filter((r) => raisonRefus(r.refus_raison)).map((r) => ({
    titre: String(r.titre), raison: RAISONS_REFUS[raisonRefus(r.refus_raison)!],
    // Le commentaire automatique des décisions par e-mail n'apprend rien à l'agent.
    commentaire: r.commentaire && r.commentaire !== "Décision reçue par e-mail" ? String(r.commentaire) : null,
    date: String(r.decide_le).slice(0, 10),
  }));
}

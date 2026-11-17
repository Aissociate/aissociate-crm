// Gouvernance du Studio (reprise du paquet « plateforme multi-tenant », vague 1) :
// onboarding public → provisionnement depuis le CRM, suspension (kill switch),
// plafond de dépense IA par jour, journal d'audit chaîné, livrables à valider.
// Tout est cloisonné par l'espace : celui de la session, ou celui désigné par
// un manager du CRM. Les tables sont écrites en service role uniquement.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { hasherMotDePasse } from "./securite.ts";
import { AGENTS_CATALOGUE, ficheEntreprise, scorer, validerReponses, type Reponses } from "./questionnaire.ts";
import { journaliser, verifierChaine, type LigneJournal } from "./journal.ts";
import { apercuAction, executerAction, modifierAction, titreAction, type ActionLivrable } from "./outils.ts";

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

export async function soumettreOnboarding(sb: SupabaseClient, body: Record<string, unknown>, origine: string): Promise<{ ok: true; id: string } | { erreur: string; statut: number }> {
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

  const s = scorer(reponses);
  const entreprise = String(reponses.A1 ?? "").trim().slice(0, 200);
  const agents = (reponses.agents as string[]) ?? [];
  const { data, error } = await sb.from("studio_onboarding").insert({
    entreprise, contact_nom: contact, email, telephone, agents, reponses,
    score: s.score, lecture: s.lecture, drapeaux: s.drapeaux,
  }).select("id").single();
  if (error) return { erreur: `Enregistrement impossible : ${error.message}`, statut: 500 };

  // Lead dans le CRM, comme les formulaires du site (trigger lead_to_contact).
  const [prenom, ...reste] = contact.split(/\s+/);
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

  return { ok: true, id: data.id };
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

export async function provisionner(sb: SupabaseClient, body: Record<string, unknown>, managerId: string | null) {
  const { data: d } = await sb.from("studio_onboarding").select("*").eq("id", String(body.demande_id ?? "")).maybeSingle();
  if (!d) return { erreur: "Demande introuvable", statut: 404 };
  if (d.statut === "provisionnee" && d.workspace_id) return { erreur: "Cet espace a déjà été créé.", statut: 400 };

  const cfg = await chargerConfig(sb, ["defaut_budget_ia_jour_eur", "defaut_quota_messages_mois", "defaut_quota_images_mois", "defaut_quota_videos_mois"]);
  const agents = (Array.isArray(body.agents) ? body.agents : d.agents).map(String)
    .filter((a: string) => AGENTS_CATALOGUE.some((c) => c.id === a));
  if (!agents.length) return { erreur: "Choisissez au moins un agent.", statut: 400 };

  const reponses = (d.reponses ?? {}) as Reponses;
  const offre = ["essentiel", "pro", "sur_mesure"].includes(String(body.offre)) ? String(body.offre) : "sur_mesure";
  const { data: ws, error } = await sb.from("studio_workspaces").insert({
    nom: String(body.nom ?? d.entreprise).trim().slice(0, 120) || d.entreprise,
    offre, secteur: String(reponses.A2 ?? "").slice(0, 120) || null,
    contexte_entreprise: ficheEntreprise(reponses),
    quota_messages_mois: nombreOuNull(cfg.defaut_quota_messages_mois) ?? 300,
    quota_images_mois: nombreOuNull(cfg.defaut_quota_images_mois) ?? 30,
    quota_videos_mois: nombreOuNull(cfg.defaut_quota_videos_mois) ?? 5,
    budget_ia_jour_eur: nombreOuNull(cfg.defaut_budget_ia_jour_eur),
    abonnement_mensuel: nombreOuNull(body.abonnement_mensuel),
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
  await journaliser(sb, {
    wsId: ws.id, acteur: "crm", action: "espace_cree",
    detail: { demande: d.id, agents, score: d.score, drapeaux: d.drapeaux },
  });
  return { ok: true, workspace_id: ws.id, nom: ws.nom, email: String(d.email).toLowerCase(), mot_de_passe: motDePasse };
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

const TRANSITIONS: Record<string, string[]> = { a_valider: ["valide", "refuse"], refuse: ["a_valider"], valide: ["publie", "a_valider"], publie: [] };

export async function deciderLivrable(sb: SupabaseClient, wsId: string, acteur: string, body: Record<string, unknown>) {
  const statut = String(body.statut ?? "");
  const { data: l } = await sb.from("studio_livrables").select("id, statut, titre, agent_id, action")
    .eq("id", String(body.id ?? "")).eq("workspace_id", wsId).maybeSingle();
  if (!l) return { erreur: "Livrable introuvable", statut: 404 };
  if (!TRANSITIONS[l.statut]?.includes(statut)) return { erreur: `Passage « ${l.statut} » → « ${statut} » impossible.`, statut: 400 };
  const commentaire = String(body.commentaire ?? "").trim().slice(0, 1000) || null;
  const { error } = await sb.from("studio_livrables").update({
    statut, commentaire, decide_par: acteur, decide_le: new Date().toISOString(),
  }).eq("id", l.id);
  if (error) return { erreur: error.message, statut: 400 };
  await journaliser(sb, { wsId, acteur, agentId: l.agent_id, action: `livrable_${statut}`, detail: { livrable: l.id, titre: l.titre, commentaire } });

  // Livrable porteur d'une action (ex. créer un document dans le Drive) : le « VALIDÉ »
  // déclenche l'exécution. Réussite → publié avec le lien ; échec → reste validé, erreur notée.
  if (statut === "valide" && l.action) {
    const r = await executerAction(sb, wsId, l.action as ActionLivrable, String(l.id));
    if (r.ok) {
      await sb.from("studio_livrables").update({ statut: "publie", resultat: { id: r.id, lien: r.lien } }).eq("id", l.id);
      await journaliser(sb, { wsId, acteur: "systeme", agentId: l.agent_id, action: "action_executee", detail: { livrable: l.id, titre: l.titre, lien: r.lien } });
      return { ok: true, execute: true, lien: r.lien };
    }
    await sb.from("studio_livrables").update({ resultat: { erreur: r.erreur } }).eq("id", l.id);
    await journaliser(sb, { wsId, acteur: "systeme", agentId: l.agent_id, action: "action_echec", detail: { livrable: l.id, titre: l.titre, erreur: r.erreur } });
    return { ok: true, execute: false, erreur_action: r.erreur };
  }
  return { ok: true };
}

const VERSIONS_MAX = 20;

/**
 * Modification d'un livrable par un utilisateur de l'espace, avant publication.
 * La version précédente est conservée (20 dernières) ; toute modification repasse
 * le livrable « à valider » : ce qui part est toujours la version validée.
 * Livrable porteur d'une action : les champs (destinataires, horaires…) sont revalidés.
 */
export async function modifierLivrable(sb: SupabaseClient, wsId: string, acteur: string, body: Record<string, unknown>) {
  const { data: l } = await sb.from("studio_livrables").select("id, statut, titre, contenu, agent_id, action, versions")
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
    const contenu = String(champs.contenu ?? "").slice(0, 200_000);
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
  const { data } = await sb.from("studio_livrables")
    .select("id, titre, contenu, statut, agent_id, conversation_id, soumis_par, decide_par, decide_le, commentaire, created_at, type_action:action->>type, action, resultat, versions")
    .eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(200);
  return data ?? [];
}

// Contrôle quotidien du parcours client du Studio IA.
//
// Chaque jour (pg_cron, action controle_cron) ou à la demande (CRM, admin_controle), un client
// fictif parcourt le Studio de bout en bout, par les mêmes portes qu'un vrai client :
// questionnaire → espace en Stage gratuit et e-mail d'identifiants → connexion → nouveau mot de passe →
// CGV → Stage en cours → ajout d'un agent → un badge d'accès la première semaine du Stage, aucun ensuite → contrat et
// recharge (Stripe) → confirmation de paiement (webhook signé) → déblocage → mot de passe oublié. S'ajoutent la configuration, les pages
// publiques, les services externes (Stripe, SMTP, OpenRouter, Zernio) et l'activité réelle
// des dernières 24 h (identifiants non envoyés, webhooks non livrés, tâches en erreur).
//
// Un contrôle en échec est rejoué une fois (20 s plus tard) : « confirmé » s'il échoue encore,
// « intermittent » sinon. Un problème confirmé déclenche un e-mail (constat, cause probable,
// solution préconisée) aux destinataires de studio_config `controle_destinataires`.
// Chaque passage est consigné dans job_runs (fonction « studio-controle »).
//
// Le client fictif ne laisse aucune trace : pas de lead dans le CRM, e-mail capturé (non envoyé),
// espace, demande et client Stripe de test supprimés à la fin. En mode Stripe live (compte
// partagé avec d'autres projets), aucune session de paiement n'est créée : seuls les prix,
// le webhook et les livraisons sont vérifiés.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { soumettreOnboarding } from "./gouvernance.ts";
import * as courriel from "./courriel.ts";
import * as stripe from "./stripe.ts";
import * as contrats from "./contrats.ts";
import * as cgv from "./cgv.ts";
import * as zernio from "./zernio.ts";
import * as recharges from "./recharges.ts";
import { AGENTS_CATALOGUE } from "./questionnaire.ts";
import { nouveauJeton, sha256 } from "./securite.ts";
import { bilan, ENTREPRISE, enEchec, fusionner, mailAlerte, motDePasseDuMail, reponsesFactices, type Resultat } from "./controle_rapport.ts";

export type { Niveau, Resultat } from "./controle_rapport.ts";

export const FONCTION_JOB = "studio-controle";
const SITE = "https://aissociate.re";
const DOMAINE_TEST = "controle.aissociate.re";
const LOGS = "Supabase › Edge Functions › studio › Logs (à l'heure du contrôle)";

class Echec extends Error {
  constructor(public diagnostic: string, public solution: string, public niveau: "alerte" | "erreur" = "erreur", public constat = "") {
    super(diagnostic);
  }
}
/** Échec d'un contrôle : constat, cause probable, solution préconisée. */
function echec(constat: string, diagnostic: string, solution: string, niveau: "alerte" | "erreur" = "erreur"): never {
  throw new Echec(diagnostic, solution, niveau, constat);
}
type Issue = string | { niveau: "ok" | "alerte" | "ignore"; detail: string; diagnostic?: string; solution?: string };

async function controler(res: Resultat[], etape: string, id: string, titre: string, f: () => Promise<Issue>) {
  const debut = Date.now();
  try {
    const r = await f();
    res.push(typeof r === "string"
      ? { id, etape, titre, niveau: "ok", detail: r, duree_ms: Date.now() - debut }
      : { id, etape, titre, ...r, duree_ms: Date.now() - debut });
  } catch (e) {
    if (e instanceof Echec) {
      res.push({ id, etape, titre, niveau: e.niveau, detail: e.constat || e.diagnostic, diagnostic: e.diagnostic, solution: e.solution, duree_ms: Date.now() - debut });
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      if (LIMITE_APPELS.test(msg)) {
        res.push({
          id, etape, titre, niveau: "alerte", detail: msg, duree_ms: Date.now() - debut,
          diagnostic: "Supabase a limité les appels du contrôle vers la fonction studio (même trace). Ce n'est pas une panne du parcours client : l'étape n'a pas pu être testée.",
          solution: "Rien à faire si cela reste ponctuel. Si cela se répète, réduire le nombre d'appels du contrôle (controle.ts).",
        });
        return;
      }
      res.push({
        id, etape, titre, niveau: "erreur", detail: msg, duree_ms: Date.now() - debut,
        diagnostic: `Erreur inattendue pendant le contrôle : ${msg}`,
        solution: `Consulter ${LOGS}. Si l'erreur vient d'un service externe (délai dépassé, réseau), elle disparaît souvent au contrôle suivant.`,
      });
    }
  }
}

// ─── Outils ──────────────────────────────────────────────────────────────────

const urlFonction = () => `${Deno.env.get("SUPABASE_URL")}/functions/v1/studio`;

const LIMITE_APPELS = /Rate limit exceeded.*?Retry after (\d+)\s*ms/i;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST vers la fonction déployée. Supabase limite les appels d'une fonction vers elle-même au sein
 * d'une même trace : on attend le délai indiqué puis on réessaie (deux fois au plus).
 */
async function poster(entetes: Record<string, string>, corps: string): Promise<Response> {
  for (let essai = 0; ; essai++) {
    try {
      const r = await fetch(urlFonction(), { method: "POST", headers: entetes, body: corps, signal: AbortSignal.timeout(45_000) });
      if (r.status !== 429 || essai >= 2) return r;
      await r.body?.cancel();
      await pause(Math.min(30_000, (Number(r.headers.get("retry-after")) || 20) * 1000));
    } catch (e) {
      const m = LIMITE_APPELS.exec(e instanceof Error ? e.message : String(e));
      if (!m || essai >= 2) throw e;
      await pause(Math.min(30_000, Number(m[1]) + 500));
    }
  }
}

/** Appel de la fonction déployée, comme le navigateur d'un client. */
async function studio(action: string, corps: Record<string, unknown> = {}): Promise<{ statut: number; data: Record<string, unknown> }> {
  const r = await poster({ "Content-Type": "application/json", Origin: SITE, "User-Agent": "Aissociate-controle-parcours" }, JSON.stringify({ action, ...corps }));
  const data = await r.json().catch(() => ({})) as Record<string, unknown>;
  return { statut: r.status, data };
}
const erreurDe = (d: Record<string, unknown>) => String(d.error ?? "sans message");

/** Événement Stripe signé avec STRIPE_WEBHOOK_SECRET, posté sur la fonction (comme Stripe). */
async function webhook(evt: Record<string, unknown>): Promise<{ statut: number; data: Record<string, unknown> }> {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const corps = JSON.stringify(evt);
  const t = Math.floor(Date.now() / 1000);
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${corps}`)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  const r = await poster({ "Content-Type": "application/json", "Stripe-Signature": `t=${t},v1=${sig}` }, corps);
  return { statut: r.status, data: await r.json().catch(() => ({})) as Record<string, unknown> };
}

// ─── Parcours d'un client fictif ─────────────────────────────────────────────

type Parcours = {
  email: string; ts: number; demandeId?: string; wsId?: string; mail?: { objet: string; texte: string; html: string };
  motDePasse?: string; token?: string; essaiJours: number; stripeClient?: string | null;
};

async function parcours(sb: SupabaseClient, res: Resultat[]) {
  const E = "Parcours d'un client (Stage → contrat)";
  const ts = Date.now();
  const p: Parcours = { email: `parcours-${ts}@${DOMAINE_TEST}`, ts, essaiJours: 7 };
  const prerequis = (ok: unknown, quoi: string): Issue | null => ok ? null : { niveau: "ignore", detail: `Non testé : ${quoi} a échoué.` };

  try {
    await controler(res, E, "parcours.questionnaire", "Questionnaire → espace en Stage", async () => {
      const { data: cfg } = await sb.from("studio_config").select("cle, valeur").in("cle", ["essai_auto", "essai_jours", "onboarding_ouvert"]);
      const c = Object.fromEntries((cfg ?? []).map((x) => [x.cle, String(x.valeur)]));
      if (c.onboarding_ouvert === "false") return { niveau: "alerte", detail: "Les inscriptions sont fermées (studio_config onboarding_ouvert = false) : le questionnaire refuse toute demande.", diagnostic: "Inscriptions fermées volontairement ?", solution: "Si ce n'est pas voulu : CRM › Studio IA clients › Réglages, rouvrir les inscriptions (onboarding_ouvert = true)." };
      if (c.essai_auto !== "true") return { niveau: "alerte", detail: "L'essai automatique est désactivé (essai_auto ≠ true) : le questionnaire crée une simple demande, sans espace.", diagnostic: "Essai automatique désactivé.", solution: "Si ce n'est pas voulu : passer studio_config essai_auto à true." };
      p.essaiJours = Math.min(60, Math.max(1, Math.round(Number(c.essai_jours) || 7)));
      const r = await soumettreOnboarding(sb, { email: p.email, contact_nom: "Contrôle Parcours", accord: true, reponses: reponsesFactices() },
        "controle-quotidien", SITE, { courriel: (m) => { p.mail = m; } });
      if ("erreur" in r) echec(`Le questionnaire a été refusé (${r.statut}) : ${r.erreur}`, "Le questionnaire public n'accepte plus une demande valide (règle de validation modifiée, table studio_onboarding inaccessible ?).", `Vérifier questionnaire.ts / validerReponses et ${LOGS}.`);
      p.demandeId = r.id;
      if (!r.essai) echec("La demande est enregistrée mais aucun espace d'essai n'a été ouvert.", "Le provisionnement automatique a échoué (provisionner) : agents introuvables, contrainte de base de données ou e-mail déjà utilisé.", `Chercher « [studio] essai automatique » dans ${LOGS}. Les demandes concernées restent dans CRM › Studio IA clients › Demandes et peuvent être provisionnées à la main.`);
      const { data: d } = await sb.from("studio_onboarding").select("workspace_id, statut, identifiants_envoyes_le").eq("id", r.id).single();
      p.wsId = d?.workspace_id ?? undefined;
      const { data: w } = await sb.from("studio_workspaces").select("offre, essai_fin, actif, contrat, connecteurs_max").eq("id", p.wsId ?? "").maybeSingle();
      const { data: u } = await sb.from("studio_users").select("role, actif").eq("workspace_id", p.wsId ?? "").maybeSingle();
      if (!w || !u) echec("Espace ou propriétaire introuvable après le provisionnement.", "Le provisionnement est incomplet.", `Vérifier provisionner (gouvernance.ts) et ${LOGS}.`);
      if (w.contrat !== "stage" || w.essai_fin || w.connecteurs_max !== 0) echec(`Espace créé avec le contrat « ${w.contrat} », fin d'essai ${w.essai_fin ?? "absente"}, ${w.connecteurs_max} badge(s).`, "L'espace n'est pas créé en Stage gratuit (contrats.ts).", "Vérifier provisionner (offre « stage ») dans gouvernance.ts et la migration studio_contrats.");
      if (u.role !== "proprietaire" || !u.actif) echec(`Propriétaire créé avec le rôle « ${u.role} », actif = ${u.actif}.`, "Le compte du client n'a pas les bons droits.", "Vérifier provisionner (insertion studio_users).");
      if (!d?.identifiants_envoyes_le) echec("L'envoi des identifiants n'est pas noté sur la demande.", "L'e-mail d'identifiants n'a pas été préparé.", "Vérifier essaiAutomatique (gouvernance.ts).");
      return "Espace en Stage gratuit créé, propriétaire actif.";
    });

    await controler(res, E, "parcours.mail", "E-mail d'identifiants", async () => {
      const pre = prerequis(p.wsId, "le questionnaire"); if (pre) return pre;
      if (!p.mail) echec("Aucun e-mail d'identifiants n'a été produit.", "essaiAutomatique n'a pas appelé l'envoi.", "Vérifier essaiAutomatique (gouvernance.ts).");
      p.motDePasse = motDePasseDuMail(p.mail.texte) ?? undefined;
      if (!p.motDePasse) echec("L'e-mail ne contient pas de mot de passe provisoire lisible.", "Le gabarit de l'e-mail a changé.", "Vérifier mailIdentifiants (courriel.ts).");
      if (!p.mail.texte.includes(`${SITE}/studio/connexion`)) echec("L'e-mail ne contient pas le lien de connexion.", "Adresse du site mal transmise au gabarit.", "Vérifier mailIdentifiants et origineSure (index.ts).");
      return `« ${p.mail.objet} » : lien de connexion et mot de passe provisoire présents (envoi réel vérifié par le contrôle SMTP).`;
    });

    await controler(res, E, "parcours.connexion", "Connexion avec les identifiants reçus", async () => {
      const pre = prerequis(p.motDePasse, "l'e-mail d'identifiants"); if (pre) return pre;
      const r = await studio("login", { email: p.email, password: p.motDePasse });
      if (r.statut !== 200 || !r.data.token) echec(`Connexion refusée (HTTP ${r.statut}) : ${erreurDe(r.data)}`, "Le mot de passe envoyé au client ne lui permet pas de se connecter.", `Vérifier hasherMotDePasse / verifierMotDePasse (securite.ts) et ${LOGS}. Les clients en essai concernés : régénérer leur mot de passe depuis le CRM.`);
      p.token = String(r.data.token);
      const me = r.data as { user?: { doit_changer?: boolean } };
      if (!me.user?.doit_changer) echec("Connexion réussie mais le changement de mot de passe n'est pas demandé.", "Le mot de passe provisoire n'est pas marqué « à changer ».", "Vérifier provisionner (studio_credentials.doit_changer).", "alerte");
      return "Connexion réussie ; le changement du mot de passe provisoire est bien demandé.";
    });

    await controler(res, E, "parcours.mot_de_passe", "Choix d'un mot de passe personnel", async () => {
      const pre = prerequis(p.token, "la connexion"); if (pre) return pre;
      const nouveau = `Controle-${crypto.randomUUID().slice(0, 8)}-${p.ts % 97}9`;
      const r = await studio("change_password", { token: p.token, ancien: p.motDePasse, nouveau });
      if (r.statut !== 200) echec(`Changement refusé (HTTP ${r.statut}) : ${erreurDe(r.data)}`, "Le client ne peut pas remplacer son mot de passe provisoire.", `Vérifier l'action change_password (index.ts) et ${LOGS}.`);
      const l = await studio("login", { email: p.email, password: nouveau });
      if (l.statut !== 200 || !l.data.token) echec(`Connexion avec le nouveau mot de passe refusée (HTTP ${l.statut}).`, "Le nouveau mot de passe n'est pas enregistré correctement.", "Vérifier change_password (index.ts).");
      p.token = String(l.data.token);
      return "Mot de passe remplacé, reconnexion réussie.";
    });

    await controler(res, E, "parcours.cgv", "Acceptation des CGV et du DPA", async () => {
      const pre = prerequis(p.token, "la connexion"); if (pre) return pre;
      const textes = await cgv.chargerCgv(sb);
      if (!textes) return { niveau: "alerte", detail: "Aucun texte configuré : l'acceptation n'est pas demandée.", diagnostic: "studio_config cgv_livrables est vide ou pointe vers des livrables supprimés.", solution: "Renseigner cgv_livrables avec les identifiants des livrables CGV et DPA de l'espace Aissociate." };
      const bloque = await studio("conversations", { token: p.token });
      if (bloque.statut !== 403 || !bloque.data.cgv) echec(`Avant acceptation, l'accès aux agents répond HTTP ${bloque.statut} au lieu de 403.`, "Le client peut utiliser le Studio sans avoir accepté les CGV.", "Vérifier le garde CGV juste après chargerSession (index.ts).");
      const lu = await studio("cgv", { token: p.token });
      const docs = (lu.data.documents ?? []) as { titre: string; contenu: string }[];
      if (lu.statut !== 200 || !docs.length || docs.some((d) => !d.contenu?.trim())) echec(`Textes à accepter : HTTP ${lu.statut}, ${docs.length} document(s).`, "Les CGV ou le DPA ne s'affichent pas (livrable vide ou supprimé).", "Vérifier studio_config cgv_livrables et les livrables de l'espace Aissociate.");
      const ok = await studio("cgv_accepter", { token: p.token, version: lu.data.version });
      if (ok.statut !== 200) echec(`Acceptation refusée (HTTP ${ok.statut}) : ${erreurDe(ok.data)}`, "Le client ne peut pas accepter les conditions.", "Vérifier cgv_accepter (index.ts) et cgv.accepter.");
      const apres = await studio("conversations", { token: p.token });
      if (apres.statut !== 200) echec(`Après acceptation, l'accès aux agents répond HTTP ${apres.statut} : ${erreurDe(apres.data)}`, "L'acceptation n'est pas prise en compte.", "Vérifier cgv.accepter (studio_users.cgv_version).");
      const crochets = docs.filter((d) => /\[[^\]\n]{1,120}\]/.test(d.contenu)).map((d) => d.titre);
      if (crochets.length) return { niveau: "alerte", detail: `Parcours CGV fonctionnel, mais des champs entre crochets restent à compléter dans : ${crochets.join(", ")}.`, diagnostic: "Texte juridique incomplet.", solution: "Compléter les champs entre crochets dans les livrables (espace Aissociate)." };
      return `Accès bloqué avant acceptation, ${docs.length} document(s) affiché(s), accès ouvert après acceptation.`;
    });

    await controler(res, E, "parcours.essai", "Stage en cours", async () => {
      const pre = prerequis(p.token, "la connexion"); if (pre) return pre;
      const me = await studio("me", { token: p.token });
      const ws = me.data.workspace as { contrat?: string } | undefined;
      if (me.statut !== 200 || ws?.contrat !== "stage") echec(`Le Studio n'indique pas le contrat Stage (HTTP ${me.statut}, contrat « ${ws?.contrat} »).`, "L'espace n'est pas reconnu comme Stage.", "Vérifier SELECT_WS / versSession (index.ts).");
      const agents = (me.data.agents ?? []) as { id: string }[];
      if (!agents.some((a) => a.id === AGENTS_CATALOGUE[0].id)) echec(`Agents visibles pendant l'essai : ${agents.map((a) => a.id).join(", ") || "aucun"} (demandé : ${AGENTS_CATALOGUE[0].id}).`, "Le client en essai ne voit pas l'agent qu'il a choisi : il ne peut rien tester.", "Vérifier agentsDuWorkspace (index.ts, offre « essai » → agents Essentiel) et studio_agents.offres / studio_workspace_agents.");
      return `Stage en cours, ${agents.length} agent(s) visible(s).`;
    });

    await controler(res, E, "parcours.agent", "Ajout d'un agent par le client", async () => {
      const pre = prerequis(p.token, "la connexion"); if (pre) return pre;
      const id = AGENTS_CATALOGUE[1].id;
      const r = await studio("agent_ajouter", { token: p.token, agent_id: id });
      if (r.statut !== 200) echec(`Ajout refusé (HTTP ${r.statut}) : ${erreurDe(r.data)}`, "Le propriétaire ne peut plus ajouter un agent à son équipe depuis « Mon périmètre ».", `Vérifier l'action agent_ajouter (index.ts), studio_agents.offres et ${LOGS}.`);
      const me = await studio("me", { token: p.token });
      const agents = (me.data.agents ?? []) as { id: string }[];
      if (!agents.some((a) => a.id === id)) echec(`Agent ajouté mais absent de l'équipe (${agents.map((a) => a.id).join(", ")}).`, "L'ajout n'est pas pris en compte.", "Vérifier agent_ajouter (studio_workspace_agents) et agentsDuWorkspace.");
      return `Agent ajouté, ${agents.length} agents dans l'équipe.`;
    });

    await controler(res, E, "parcours.connecteur", "Stage : un badge d'accès la première semaine, aucun ensuite", async () => {
      const pre = prerequis(p.token, "la connexion"); if (pre) return pre;
      const connecter = (type: string, adresse: string) => studio("connecteur_enregistrer", { token: p.token, type, infos: { adresse: `${adresse}@${DOMAINE_TEST}` }, accord: true });
      const nettoyer = () => sb.from("studio_connecteurs").delete().eq("workspace_id", p.wsId);
      const zernioKo = (r: { statut: number; data: Record<string, unknown> }) => { if (r.statut === 503) echec(`Contrôle impossible (HTTP 503) : ${erreurDe(r.data)}`, "Les connecteurs de l'espace n'ont pas pu être comptés (Zernio indisponible ?).", "Voir le contrôle Zernio ci-dessous.", "alerte"); };
      const verifier = "Vérifier refusConnecteurEssai (etats.ts), contrats.badgesEffectifs et facturationEspace (facturation.ts).";

      // Première semaine : un outil accepté, le deuxième refusé.
      const un = await connecter("outlook", "premier");
      zernioKo(un);
      if (un.statut !== 200) { await nettoyer(); echec(`Premier connecteur en Stage : HTTP ${un.statut} (${erreurDe(un.data)}).`, "Le badge d'accès offert la première semaine du Stage n'est pas accordé.", verifier); }
      await sb.from("studio_connecteurs").update({ statut: "connecte" }).eq("workspace_id", p.wsId);
      const deux = await connecter("google", "second");
      await nettoyer();
      zernioKo(deux);
      if (deux.statut === 200) echec("Un deuxième connecteur a été accepté en Stage.", "La limite d'un seul badge offert n'est plus appliquée.", verifier);
      if (deux.statut !== 402) echec(`Deuxième connecteur en Stage : HTTP ${deux.statut} au lieu de 402 (${erreurDe(deux.data)}).`, "Réponse inattendue du Studio.", `Vérifier connecteur_enregistrer (index.ts) et ${LOGS}.`, "alerte");

      // Semaine passée (espace vieilli de 8 jours, puis remis à sa date) : plus aucun badge.
      const { data: w } = await sb.from("studio_workspaces").select("created_at").eq("id", p.wsId).single();
      await sb.from("studio_workspaces").update({ created_at: new Date(Date.now() - (contrats.BADGE_DECOUVERTE_JOURS + 1) * 86_400_000).toISOString() }).eq("id", p.wsId);
      const apres = await connecter("outlook", "apres");
      await nettoyer();
      await sb.from("studio_workspaces").update({ created_at: w?.created_at }).eq("id", p.wsId);
      zernioKo(apres);
      if (apres.statut === 200) echec("Un connecteur a été accepté en Stage après la première semaine.", "Le badge offert ne prend pas fin au bout de 7 jours.", verifier);
      if (apres.statut !== 402) echec(`Connecteur après la première semaine : HTTP ${apres.statut} au lieu de 402 (${erreurDe(apres.data)}).`, "Réponse inattendue du Studio.", `Vérifier connecteur_enregistrer (index.ts) et ${LOGS}.`, "alerte");
      return "Stage : un connecteur accepté la première semaine, le deuxième refusé (402), aucun après 7 jours (402).";
    });

    await controler(res, E, "parcours.recharge", "Page de paiement d'une recharge (Stripe)", async () => {
      const pre = prerequis(p.token, "la connexion"); if (pre) return pre;
      if (!stripe.stripeConfigure()) echec("STRIPE_SECRET_KEY absente : le client ne peut pas payer en ligne.", "Paiement en ligne non configuré.", "Supabase › Edge Functions › Secrets : poser STRIPE_SECRET_KEY.");
      if (!stripe.modeTest()) return { niveau: "ignore", detail: "Stripe en mode live (compte partagé) : le contrôle ne crée pas de session de paiement. Prix et webhook sont vérifiés plus bas." };
      const r = await studio("recharge_acheter", { token: p.token, pack: 0 });
      if (r.statut === 403) return "Recharges en ligne fermées pour les nouveaux espaces (réglage) : rien à payer.";
      if (r.statut !== 200 || !String(r.data.url ?? "").startsWith("https://checkout.stripe.com")) echec(`Recharge : HTTP ${r.statut} (${erreurDe(r.data)}).`, "La page de paiement des recharges ne s'ouvre pas.", `Vérifier sessionRecharge (stripe.ts), la clé Stripe et ${LOGS}.`);
      return "Page de paiement Stripe de la recharge créée (mode test).";
    });

    await controler(res, E, "parcours.abonnement", "Page de paiement d'un contrat (Stripe)", async () => {
      const pre = prerequis(p.token, "la connexion"); if (pre) return pre;
      if (!stripe.stripeConfigure()) echec("STRIPE_SECRET_KEY absente : le client ne peut pas s'abonner en ligne.", "Paiement en ligne non configuré.", "Supabase › Edge Functions › Secrets : poser STRIPE_SECRET_KEY.");
      if (!stripe.modeTest()) return { niveau: "ignore", detail: "Stripe en mode live (compte partagé) : le contrôle ne crée pas de session de paiement. Prix et webhook sont vérifiés plus bas." };
      const a = await studio("contrat_souscrire", { token: p.token, choix: { contrat: "plein", badges: 1 } });
      if (a.statut !== 200 || !String(a.data.url ?? "").startsWith("https://checkout.stripe.com")) echec(`Contrat Temps plein : HTTP ${a.statut} (${erreurDe(a.data)}).`, "Un client en Stage ne peut pas ouvrir la page de paiement de son contrat.", `Vérifier sessionContrat (stripe.ts), la clé Stripe et ${LOGS}.`);
      return "Page de paiement Stripe du contrat créée (mode test).";
    });

    await controler(res, E, "parcours.webhook", "Confirmation de paiement (webhook) et déblocage", async () => {
      const pre = prerequis(p.token, "la connexion"); if (pre) return pre;
      if (!Deno.env.get("STRIPE_WEBHOOK_SECRET")) echec("STRIPE_WEBHOOK_SECRET absent : aucun paiement ne serait pris en compte.", "Webhook Stripe non configuré.", "Stripe › Développeurs › Webhooks : copier le secret de signature dans le secret Supabase STRIPE_WEBHOOK_SECRET.");
      const { data: w0 } = await sb.from("studio_workspaces").select("stripe_client").eq("id", p.wsId).single();
      p.stripeClient = w0?.stripe_client ?? null;
      const fin = Math.floor(Date.now() / 1000) + 30 * 86_400;
      const r = await webhook({
        id: `evt_controle_${p.ts}`, type: "customer.subscription.created",
        data: { object: {
          id: `sub_controle_${p.ts}`, object: "subscription", customer: p.stripeClient ?? `cus_controle_${p.ts}`, status: "active",
          current_period_end: fin, metadata: { app: "studio", workspace_id: p.wsId },
          items: { data: [{ id: `si_controle_${p.ts}`, quantity: 1, current_period_end: fin, price: { lookup_key: contrats.clePrix("contrat_plein", false), unit_amount: 14900 } }] },
        } },
      });
      if (r.statut === 401) echec("Le Studio refuse un événement signé avec son propre secret.", "Vérification de signature défaillante.", "Vérifier verifierSignature (stripe.ts).");
      if (r.statut !== 200) echec(`Événement d'abonnement : HTTP ${r.statut} (${erreurDe(r.data)}).`, "Le Studio ne sait plus enregistrer un abonnement payé.", `Vérifier traiterEvenement / enregistrerAbonnement (stripe.ts) et ${LOGS}.`);
      const { data: w } = await sb.from("studio_workspaces").select("offre, abonnement_statut, contrat, connecteurs_max, quota_messages_mois").eq("id", p.wsId).single();
      if (w?.abonnement_statut !== "active" || w?.offre !== "essentiel") echec(`Après paiement : offre « ${w?.offre} », abonnement « ${w?.abonnement_statut} ».`, "L'abonnement payé n'est pas reporté sur l'espace.", "Vérifier enregistrerAbonnement (stripe.ts).");
      if (w?.contrat !== "plein" || w?.connecteurs_max !== 6 || w?.quota_messages_mois !== 3033) echec(`Après paiement du Temps plein : contrat « ${w?.contrat} », ${w?.connecteurs_max} badge(s), quota ${w?.quota_messages_mois}.`, "Les droits du contrat payé ne sont pas appliqués à l'espace.", "Vérifier appliquerContrat (stripe.ts) et contrats.droits.");
      const debloque = await studio("conversations", { token: p.token });
      if (debloque.statut !== 200) echec(`Abonné, l'accès aux agents répond encore HTTP ${debloque.statut}.`, "Un client qui a payé reste bloqué.", "Vérifier essai.enEssai (statuts ABONNEMENT_PAYE) dans essai.ts.");

      const avant = await recharges.solde(sb, p.wsId!);
      const evtRecharge = {
        id: `evt_controle_r_${p.ts}`, type: "checkout.session.completed",
        data: { object: { id: `cs_controle_${p.ts}`, mode: "payment", payment_status: "paid", metadata: { app: "studio", workspace_id: p.wsId, nature: "recharge", credits: "10", prix_ht: "10", acteur: "controle" } } },
      };
      const r1 = await webhook(evtRecharge), r2 = await webhook(evtRecharge);
      const apres = await recharges.solde(sb, p.wsId!);
      if (r1.statut !== 200 || apres - avant !== 10) echec(`Recharge payée : HTTP ${r1.statut}, solde ${avant} → ${apres} (attendu +10).`, "Une recharge payée n'est pas créditée.", "Vérifier traiterEvenement (branche recharge) et la table studio_recharges.");
      if (r2.statut !== 200) echec(`Événement de recharge rejoué : HTTP ${r2.statut}.`, "Un événement envoyé deux fois par Stripe provoque une erreur.", "Vérifier l'index unique studio_recharges.stripe_ref.", "alerte");
      return "Contrat payé → droits du Temps plein appliqués ; recharge payée créditée une seule fois (événement rejoué ignoré).";
    });
    await controler(res, E, "parcours.mot_de_passe_oublie", "Mot de passe oublié (lien de réinitialisation)", async () => {
      const pre = prerequis(p.wsId && p.token, "la connexion"); if (pre) return pre;
      // Le lien est posé directement (l'e-mail réel partirait vers une adresse fictive) ; l'envoi est couvert par le contrôle SMTP.
      const { data: u } = await sb.from("studio_users").select("id").eq("workspace_id", p.wsId).maybeSingle();
      const jeton = nouveauJeton();
      const { error } = await sb.from("studio_reinitialisations").insert({ user_id: u?.id, jeton_hash: await sha256(jeton), expire_le: new Date(Date.now() + 600_000).toISOString() });
      if (error) echec(`Table des liens de réinitialisation inaccessible : ${error.message}`, "La migration studio_autonomie n'est pas appliquée : « Mot de passe oublié ? » ne fonctionne pas.", "Appliquer supabase/migrations/20261118220000_studio_autonomie.sql.");
      const demande = await studio("mdp_oublie", { email: `inconnu-${p.ts}@${DOMAINE_TEST}` });
      if (demande.statut !== 200) echec(`Demande de lien : HTTP ${demande.statut}.`, "Le formulaire « Mot de passe oublié ? » est en panne.", `Vérifier l'action mdp_oublie (index.ts) et ${LOGS}.`);
      const nouveau = `Reinit-${crypto.randomUUID().slice(0, 8)}-4k`;
      const r = await studio("mdp_reinitialiser", { jeton, nouveau });
      if (r.statut !== 200) echec(`Nouveau mot de passe refusé (HTTP ${r.statut}) : ${erreurDe(r.data)}`, "Le lien reçu par e-mail ne permet pas de changer le mot de passe.", "Vérifier l'action mdp_reinitialiser (index.ts).");
      const rejoue = await studio("mdp_reinitialiser", { jeton, nouveau });
      if (rejoue.statut === 200) echec("Le même lien a servi deux fois.", "Le lien de réinitialisation n'est pas à usage unique.", "Vérifier utilise_le dans mdp_reinitialiser.");
      const ancienne = await studio("me", { token: p.token });
      if (ancienne.statut !== 401) echec("L'ancienne session reste ouverte après la réinitialisation.", "Les sessions ne sont pas fermées au changement de mot de passe.", "Vérifier la suppression de studio_sessions dans mdp_reinitialiser.", "alerte");
      const l = await studio("login", { email: p.email, password: nouveau });
      if (l.statut !== 200) echec(`Connexion avec le nouveau mot de passe : HTTP ${l.statut}.`, "Le mot de passe réinitialisé n'est pas enregistré.", "Vérifier mdp_reinitialiser (studio_credentials).");
      return "Lien à usage unique accepté, anciennes sessions fermées, connexion avec le nouveau mot de passe.";
    });
  } finally {
    await controler(res, E, "parcours.nettoyage", "Suppression du client fictif", async () => {
      const notes: string[] = [];
      if (p.stripeClient && stripe.modeTest() && p.stripeClient.startsWith("cus_")) {
        try { await stripe.appel("DELETE", `/customers/${p.stripeClient}`); notes.push("client Stripe de test supprimé"); }
        catch (e) { notes.push(`client Stripe non supprimé (${e instanceof Error ? e.message : e})`); }
      }
      if (p.wsId) await sb.from("studio_workspaces").delete().eq("id", p.wsId);
      await sb.from("studio_onboarding").delete().ilike("email", `%@${DOMAINE_TEST}`);
      // Restes d'un contrôle interrompu.
      await sb.from("studio_workspaces").delete().eq("nom", ENTREPRISE).lt("created_at", new Date(Date.now() - 600_000).toISOString());
      const { count } = await sb.from("studio_users").select("id", { count: "exact", head: true }).ilike("email", `%@${DOMAINE_TEST}`);
      if (count) echec(`${count} compte(s) de test subsistent.`, "Le nettoyage a échoué.", `Supprimer les espaces nommés « ${ENTREPRISE} » dans le CRM.`, "alerte");
      return ["Espace, demande et compte fictifs supprimés", ...notes].join(" ; ") + ".";
    });
  }
}

// ─── Configuration, pages publiques, services, activité réelle ───────────────

async function configuration(sb: SupabaseClient, res: Resultat[]) {
  const E = "Configuration";
  await controler(res, E, "config.secrets", "Secrets de la fonction", async () => {
    // STUDIO_CLE_CHIFFREMENT est facultatif (repli sur la clé service role, securite.ts) ;
    // la clé OpenRouter peut venir de CRM › Paramètres › IA (contrôle ext.openrouter).
    const requis: [string, string][] = [
      ["STRIPE_SECRET_KEY", "pas de paiement en ligne"], ["STRIPE_WEBHOOK_SECRET", "les paiements ne sont pas pris en compte"],
      ["ZERNIO_API_KEY", "pas de messagerie ni de réseaux sociaux"],
    ];
    const manquants = requis.filter(([k]) => !Deno.env.get(k));
    if (manquants.length) echec(`Secret(s) absent(s) : ${manquants.map(([k, effet]) => `${k} (${effet})`).join(" ; ")}.`, "Secret supprimé ou jamais posé.", "Supabase › Edge Functions › Secrets : poser les secrets manquants (aucun redéploiement nécessaire).");
    return `${requis.length} secrets présents.`;
  });
  await controler(res, E, "config.crons", "Tâches planifiées du Studio (pg_cron)", async () => {
    const { data, error } = await sb.rpc("studio_controle_crons");
    if (error) echec(`Lecture de pg_cron impossible : ${error.message}`, "La fonction studio_controle_crons est absente.", "Appliquer la migration 20261118210000_studio_controle.sql.", "alerte");
    const jobs = (data ?? []) as { jobname: string; active: boolean; dernier_statut: string | null; dernier_lancement: string | null; dernier_message: string | null }[];
    const taches = jobs.find((j) => j.jobname === "studio-taches");
    if (!taches || !taches.active) echec("Le job studio-taches est absent ou désactivé : les tâches planifiées des clients ne tournent plus.", "Job pg_cron supprimé ou désactivé.", "Rejouer la migration 20261117160000_studio_taches.sql (bloc cron.schedule).");
    const age = taches.dernier_lancement ? Date.now() - new Date(taches.dernier_lancement).getTime() : Infinity;
    if (age > 2 * 3_600_000) echec(`Dernier lancement de studio-taches : ${taches.dernier_lancement ?? "jamais"}.`, "pg_cron ne déclenche plus le job horaire.", "Vérifier l'extension pg_cron et le secret Vault project_url (Supabase › Database › Cron).");
    if (taches.dernier_statut === "failed") echec(`Dernier lancement de studio-taches en échec : ${taches.dernier_message ?? ""}`, "L'appel HTTP du job échoue.", "Vérifier le secret Vault project_url et l'extension pg_net.");
    return `studio-taches actif, dernier lancement ${new Date(taches.dernier_lancement!).toLocaleString("fr-FR", { timeZone: "Indian/Reunion" })}.`;
  });
}

async function pagesPubliques(res: Resultat[]) {
  const E = "Pages publiques";
  await controler(res, E, "site.pages", "Site : questionnaire, connexion, offre", async () => {
    const pages = ["/studio/demarrer", "/studio/connexion", "/agents-ia"];
    const r = await Promise.all(pages.map(async (c) => {
      try { const x = await fetch(`${SITE}${c}`, { signal: AbortSignal.timeout(20_000) }); await x.body?.cancel(); return [c, x.status] as const; }
      catch (e) { return [c, e instanceof Error ? e.message : String(e)] as const; }
    }));
    const ko = r.filter(([, s]) => s !== 200);
    if (ko.length) echec(`Pages en erreur : ${ko.map(([c, s]) => `${c} → ${s}`).join(", ")}.`, "Le site ne sert plus ces pages (déploiement Netlify en échec, domaine, redirections).", "Netlify › Deploys : vérifier le dernier déploiement ; contrôler public/_redirects (ordre des règles).");
    return `${pages.length} pages répondent (200).`;
  });
  await controler(res, E, "api.public", "API publique : tarif et questionnaire", async () => {
    const t = await studio("tarif_public");
    if (t.statut !== 200 || typeof t.data.prix !== "number") echec(`tarif_public : HTTP ${t.statut}.`, "La page /agents-ia n'affiche plus le tarif des connecteurs ; la fonction studio est peut-être en panne.", `Vérifier le déploiement de la fonction studio et ${LOGS}.`);
    const q = await studio("onboarding_soumettre", {});
    if (q.statut !== 400) echec(`Questionnaire vide : HTTP ${q.statut} au lieu de 400.`, "Le point d'entrée du questionnaire ne valide plus les demandes.", `Vérifier soumettreOnboarding et ${LOGS}.`);
    return "Tarif servi, questionnaire joignable (demande vide refusée comme prévu).";
  });
}

async function services(sb: SupabaseClient, res: Resultat[]) {
  const E = "Services externes";
  await controler(res, E, "ext.smtp", "Envoi des e-mails (SMTP)", async () => {
    const comptes = await courriel.verifierSmtp(sb);
    const ok = comptes.filter((c) => c.ok);
    if (!ok.length) echec(`Aucune connexion SMTP : ${comptes.map((c) => `${c.compte} → ${c.erreur}`).join(" ; ")}.`, "Les identifiants d'essai ne partent plus : mot de passe de la boîte changé, serveur injoignable.", "Mettre à jour le mot de passe SMTP (CRM › Paramètres › E-mail, ou secrets SMTP_* / STUDIO_SMTP_*), puis régénérer les identifiants des clients en attente.");
    const ko = comptes.filter((c) => !c.ok);
    if (ko.length) return { niveau: "alerte", detail: `Envoi possible par ${ok.map((c) => c.compte).join(", ")}, mais ${ko.map((c) => `${c.compte} → ${c.erreur}`).join(" ; ")}.`, diagnostic: "Un compte de la chaîne d'envoi est refusé : les e-mails partent par le compte de secours, parfois avec un autre expéditeur.", solution: "Corriger le mot de passe du compte refusé (secrets STUDIO_SMTP_USERNAME / STUDIO_SMTP_PASSWORD)." };
    return `Connexion SMTP réussie : ${ok.map((c) => c.compte).join(", ")}.`;
  });

  await controler(res, E, "ext.stripe", "Stripe : clé, prix, webhook", async () => {
    if (!stripe.stripeConfigure()) echec("STRIPE_SECRET_KEY absente.", "Paiement en ligne non configuré.", "Poser STRIPE_SECRET_KEY dans les secrets de la fonction.");
    const compte = await stripe.appel<{ id: string; charges_enabled?: boolean }>("GET", "/account").catch((e) => echec(`Clé refusée par Stripe : ${e.message}`, "Clé Stripe révoquée, expirée ou erronée.", "Stripe › Développeurs › Clés API : régénérer la clé et mettre à jour STRIPE_SECRET_KEY."));
    const notes: string[] = [`compte ${compte.id} en mode ${stripe.modeTest() ? "test" : "live"}`];
    const prix = await stripe.appel<{ data: unknown[] }>("GET", "/prices", { lookup_keys: [contrats.clePrix("contrat_plein", false)], active: true, limit: 1 });
    notes.push(prix.data.length ? "prix des contrats en place" : "prix des contrats créés au premier abonnement");
    const points = await stripe.appel<{ data: { url: string; status: string; enabled_events: string[] }[] }>("GET", "/webhook_endpoints", { limit: 100 });
    const nous = points.data.filter((w) => w.url.startsWith(urlFonction()));
    if (!nous.length) echec(`${notes.join(", ")} ; aucun webhook ne pointe vers ${urlFonction()}.`, "Stripe ne prévient pas le Studio des paiements : abonnements et recharges ne sont jamais pris en compte.", "Stripe › Développeurs › Webhooks : créer un point de terminaison vers l'URL de la fonction studio, puis copier son secret dans STRIPE_WEBHOOK_SECRET.");
    const actif = nous.find((w) => w.status === "enabled");
    if (!actif) echec("Le webhook du Studio est désactivé dans Stripe.", "Stripe a désactivé le point de terminaison (trop d'échecs) ou il a été désactivé à la main.", "Stripe › Webhooks : réactiver le point de terminaison, après avoir vérifié STRIPE_WEBHOOK_SECRET.");
    const attendus = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
    const manquants = actif.enabled_events.includes("*") ? [] : attendus.filter((e) => !actif.enabled_events.includes(e));
    if (manquants.length) echec(`Événements non abonnés : ${manquants.join(", ")}.`, "Une partie des paiements n'est pas transmise au Studio.", "Stripe › Webhooks › point de terminaison du Studio : ajouter les événements manquants.");
    return `${notes.join(", ")}, webhook actif.`;
  });

  await controler(res, E, "ext.stripe_livraisons", "Stripe : événements livrés au Studio (24 h)", async () => {
    if (!stripe.stripeConfigure()) return { niveau: "ignore", detail: "Stripe non configuré." };
    const depuis = Math.floor(Date.now() / 1000) - 86_400;
    const l = await stripe.appel<{ data: { id: string; type: string; data: { object: { metadata?: Record<string, string> } } }[] }>("GET", "/events", { delivery_success: false, "created[gte]": depuis, limit: 100 });
    const nos = l.data.filter((e) => e.data?.object?.metadata?.app === "studio");
    if (nos.length) echec(`${nos.length} événement(s) Studio non livré(s) : ${nos.slice(0, 5).map((e) => `${e.type} (${e.id})`).join(", ")}.`, "Stripe n'arrive pas à remettre les événements : le plus souvent, STRIPE_WEBHOOK_SECRET ne correspond pas au secret de signature du webhook (Supabase répond 401), ou la fonction était en panne.", "Stripe › Webhooks › point de terminaison du Studio › « Afficher » le secret de signature, le recopier dans STRIPE_WEBHOOK_SECRET ; Stripe renverra seul les événements en attente (ou « Renvoyer » depuis le tableau de bord).");
    return "Aucun événement Studio en échec de livraison.";
  });

  await controler(res, E, "ext.openrouter", "IA des agents (OpenRouter)", async () => {
    // Même source que le Studio (cleOpenRouter, index.ts) : secret, sinon CRM › Paramètres › IA.
    const { data: ai } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const cle = Deno.env.get("OPENROUTER_API_KEY")?.trim() || String((ai?.valeur as Record<string, string> | null)?.openrouter_key ?? "").trim();
    if (!cle) echec("Aucune clé OpenRouter (ni secret OPENROUTER_API_KEY, ni CRM › Paramètres › IA).", "Les agents ne peuvent plus répondre.", "Renseigner la clé dans CRM › Paramètres › IA (ou le secret OPENROUTER_API_KEY).");
    const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${cle}` }, signal: AbortSignal.timeout(20_000) });
    if (r.status === 401) echec("Clé OpenRouter refusée (401).", "Clé révoquée ou supprimée.", "openrouter.ai › Keys : créer une clé et mettre à jour OPENROUTER_API_KEY.");
    if (!r.ok) echec(`OpenRouter répond HTTP ${r.status}.`, "Service OpenRouter perturbé.", "Vérifier status.openrouter.ai ; rien à faire si l'incident est général.", "alerte");
    const d = ((await r.json()) as { data?: { limit_remaining?: number | null } }).data ?? {};
    if (d.limit_remaining != null && d.limit_remaining < 5) echec(`Crédit restant sur la clé : ${d.limit_remaining.toFixed(2)} $.`, "Les agents vont s'arrêter faute de crédit.", "openrouter.ai › Credits : recharger le compte (ou relever la limite de la clé).", d.limit_remaining <= 0 ? "erreur" : "alerte");
    return d.limit_remaining != null ? `Clé valide, ${d.limit_remaining.toFixed(2)} $ de crédit restant.` : "Clé valide (sans plafond).";
  });

  await controler(res, E, "ext.zernio", "Messageries et réseaux sociaux (Zernio)", async () => {
    if (!zernio.zernioConfigure()) echec("ZERNIO_API_KEY absente.", "Aucune messagerie ni réseau social ne peut être connecté.", "Poser ZERNIO_API_KEY dans les secrets de la fonction.");
    try { await zernio.appel("/profiles?externalId=controle-parcours"); }
    catch (e) { echec(`Zernio refuse l'appel : ${e instanceof Error ? e.message : e}`, "Clé Zernio révoquée ou service indisponible : les clients ne peuvent plus connecter ni utiliser leur messagerie.", "zernio.com › API keys : vérifier la clé et mettre à jour ZERNIO_API_KEY ; consulter l'état du service Zernio."); }
    return "API Zernio joignable, clé acceptée.";
  });
}

async function activiteReelle(sb: SupabaseClient, res: Resultat[]) {
  const E = "Activité réelle (24 h)";
  await controler(res, E, "reel.identifiants", "Identifiants envoyés aux nouveaux clients", async () => {
    const depuis = new Date(Date.now() - 86_400_000).toISOString();
    const { data } = await sb.from("studio_onboarding").select("email, created_at").not("workspace_id", "is", null)
      .is("traite_par", null).is("identifiants_envoyes_le", null).gte("created_at", depuis).not("email", "ilike", `%@${DOMAINE_TEST}`);
    if (data?.length) echec(`${data.length} client(s) en essai n'ont pas reçu leurs identifiants : ${data.map((d) => d.email).join(", ")}.`, "L'envoi de l'e-mail a échoué (SMTP refusé ou injoignable) : ces clients ne peuvent pas se connecter.", "Corriger le SMTP (voir le contrôle SMTP), puis CRM › Studio IA clients › espace du client › régénérer le mot de passe et le lui transmettre.");
    return "Tous les essais ouverts depuis 24 h ont reçu leurs identifiants.";
  });
  await controler(res, E, "reel.taches", "Tâches planifiées des clients", async () => {
    const depuis = new Date(Date.now() - 86_400_000).toISOString();
    const { data } = await sb.from("studio_taches").select("titre, dernier_compte_rendu, workspace_id").eq("dernier_statut", "erreur").gte("derniere_execution", depuis).limit(20);
    if (data?.length) echec(`${data.length} tâche(s) en erreur : ${data.slice(0, 5).map((t) => `« ${t.titre} » (${String(t.dernier_compte_rendu ?? "").slice(0, 100)})`).join(" ; ")}.`, "Des tâches confiées aux agents échouent (connecteur déconnecté, quota atteint, erreur IA).", "CRM › Studio IA clients › espace concerné › Tâches : lire le compte rendu ; reconnecter le connecteur ou relever le quota si besoin.", "alerte");
    return "Aucune tâche en erreur.";
  });
}

// ─── Passage complet, vérification, alerte ───────────────────────────────────

export async function passage(sb: SupabaseClient): Promise<Resultat[]> {
  const res: Resultat[] = [];
  await configuration(sb, res);
  await pagesPubliques(res);
  await parcours(sb, res);
  await services(sb, res);
  await activiteReelle(sb, res);
  return res;
}

/** Passage complet : contrôles, rejeu des échecs, journal (job_runs), e-mail si problème confirmé ou rétabli. */
export async function executer(sb: SupabaseClient, options: { envoyer?: boolean } = {}): Promise<{ resultats: Resultat[]; bilan: ReturnType<typeof bilan>; mail: boolean }> {
  const debut = new Date();
  let res = await passage(sb);
  if (res.some(enEchec)) {
    await new Promise((r) => setTimeout(r, 20_000));
    res = fusionner(res, await passage(sb));
  }
  const b = bilan(res);
  const { data: precedent } = await sb.from("job_runs").select("ok").eq("fonction", FONCTION_JOB).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const probleme = b.erreurs + b.alertes > 0;
  const retabli = !probleme && precedent?.ok === false;
  let mail = false;
  if ((probleme || retabli) && options.envoyer !== false) {
    const { data: cfg } = await sb.from("studio_config").select("valeur").eq("cle", "controle_destinataires").maybeSingle();
    const destinataires = String(cfg?.valeur ?? "").split(/[,;\s]+/).filter((x) => x.includes("@"));
    const m = mailAlerte(res, debut);
    try {
      await courriel.envoyer(sb, { a: (destinataires.length ? destinataires : [courriel.ADRESSE_STUDIO]).join(", "), ...m });
      mail = true;
    } catch (e) {
      console.error("[studio] alerte du contrôle non envoyée :", e instanceof Error ? e.message : String(e));
    }
  }
  await sb.from("job_runs").insert({
    fonction: FONCTION_JOB, started_at: debut.toISOString(), finished_at: new Date().toISOString(), ok: b.erreurs === 0,
    message: probleme ? `${b.erreurs} erreur(s), ${b.alertes} alerte(s)${mail ? ", alerte envoyée" : ""}` : `${b.ok} contrôles réussis${b.intermittents ? `, ${b.intermittents} incident(s) passager(s)` : ""}`,
    detail: { bilan: b, resultats: res, mail },
  });
  return { resultats: res, bilan: b, mail };
}

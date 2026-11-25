// Edge Function PUBLIQUE (verify_jwt=false) — Studio IA, espace agentique des
// entreprises clientes. Module isolé : voir src/studio/README.md.
//
// Les clients ne sont PAS des utilisateurs Supabase Auth (la RLS du CRM ouvre
// certaines lectures à tout `authenticated`). Authentification maison :
// `login` renvoie un jeton opaque ; toutes les autres actions client le
// fournissent dans `token` et sont cloisonnées à l'espace de la session.
// Toute la donnée est lue en service role, TOUJOURS filtrée par workspace_id.
//
// Actions (POST JSON { action, ... }) :
//   login {email, password}                       → {token, ...me}
//   logout | me | change_password {ancien, nouveau}
//   bug_signaler {description, titre?, priorite?, contexte?, capture? (PNG base64)} → ticket dans le CRM (onglet Développement)
//   conversations {agent_id?} | messages {conversation_id} | conversation_delete {conversation_id}
//   chat {agent_id, message, conversation_id?}    → flux SSE (meta, delta, done, error)
//   retour {message_id, valeur: 1|-1|0} | epingler {message_id, epingle} | creations
//   chat avec un super-pouvoir « media » → JSON {media:{id,…}} (image ou vidéo, voir medias.ts)
//   media_statut {id} | medias (galerie des visuels et vidéos prêts)
//   entete | entete_update {entete} | entete_logo {fichier base64, type} ou {supprimer:true}   (papier à en-tête)
//   bureau_etat | bureau_connecter {quoi: google|microsoft|email, reconnecter?} | bureau_deconnecter {compte_id}
//   drive_choisir {compte_id} | connexion_invitation {cible?, email?}   (messagerie, agenda, fichiers via Zernio)
// Public : invitation_ouvrir {jeton}                → lien Zernio pour l'espace de l'invitation
//   connecteurs | connecteur_enregistrer {type, infos, secret?, accord} | connecteur_supprimer {type}
//   calendrier {du?, au?} | rappel_creer {titre, quand, note?} | rappel_fait {id, fait} | rappel_supprimer {id}  (calendrier par défaut, calendrier.ts)
//   acces_connecteurs | acces_connecteur_regler {cle, agents: string[] | null, nom?}  (connecteur réservé à certains agents)
//   ressources | ressource_add {titre, contenu, type, format?, taille?}
//   fichier_deposer {jeton, index, total, morceau(base64), nom, type?} → fichier gardé tel quel dans « Mes ressources » (fichiers.ts)
//   ressource_toggle {id, actif, confirmer? (requis pour activer une ressource sensible)} | ressource_delete {id}
//   (ressource_add range désactivés RIB / IBAN, pièces d'identité et bulletins de paie : sensible.ts)
//   contexte_update {contexte_entreprise}          (propriétaire)
// Administration (JWT CRM d'un manager dans Authorization) :
//   admin_create_user {workspace_id, email, prenom?, nom?, role?, password}
//   admin_set_password {user_id, password}
//   admin_modeles                                   → catalogue OpenRouter trié par constructeur
//   admin_rapport {workspace_id, mois}              → rapport mensuel de valeur + en-tête du client
// Client : rapport {mois?: "AAAA-MM"}               → rapport mensuel de valeur (sans aucun coût)
// Gouvernance (gouvernance.ts) :
//   public  onboarding_soumettre {contact_nom, email, telephone?, accord, reponses}
//   client  perimetre | suspendre {suspendu} (propriétaire) | journal
//           livrables | livrable_soumettre {message_id} | livrable_decider {id, statut, commentaire?, raison (refus : trop_long | mauvais_ton | pas_le_moment | autre)} (propriétaire)
//           livrable_modifier {id, champs} (version précédente gardée, repasse à valider)
//           aujourdhui → { decisions, faits, minutes_semaine, a_venir } (écran d'accueil : faits.ts)
//           equipe → { etats: { [agent]: { decisions, au_travail } }, connexions } (« Mon équipe »)
//   client  responsables → { responsables, max, actifs } | responsable_inviter {email, prenom?, nom?}
//           responsable_retirer {id} | responsable_reactiver {id}   (propriétaire ; limite = contrat, responsables.ts)
//   chat {…, pouvoir, mission: true} : mission guidée, la réponse est soumise d'office comme livrable à valider
//   admin   admin_provisionner {demande_id, agents?, offre?, nom?, abonnement_mensuel?} → identifiants provisoires
//           admin_suspendre {workspace_id, suspendu} | admin_journal {workspace_id} (lignes + vérification de la chaîne)
//   Toute mission (chat, média) est refusée si l'espace est suspendu ou a atteint son plafond IA du jour.
// Canal e-mail de liaison (liaison.ts, liaison_traitement.ts, agentmail.ts) :
//   webhook AgentMail signé Svix (en-têtes svix-*) sur cette même URL → traitement en arrière-plan
//   client  liaison                                → adresse, agent par défaut, derniers e-mails reçus
//   admin   admin_liaison {workspace_id, activer, username?, agent?} → crée / active / coupe la boîte
// Tâches planifiées (taches.ts) :
//   client  taches | tache_enregistrer {id?, titre, agent_id, consigne, heures[], jours[], actif} | tache_supprimer {id}
//           tache_lancer {id}                       (écriture : propriétaire)
// Routines (routines.ts, refonte §3.4 et §3.5) — une tâche planifiée vue comme une chaîne d'étapes :
//   client  routines → {routines: [étapes, « En clair », historique…], installees} | routine_modeles → galerie et outils reliés
//           routine_regler {id, reglages?, heures?, jours?, actif?} | routine_essayer {id} (passage à blanc)
//           routine_activer {id} (fin de l'essai) | routine_supprimer {id}
//           routine_proposer {demande} → chaîne proposée par Léa et sa question | routine_creer {modele | proposition, reponse?, saisie?}
//           (écriture : propriétaire ; une routine créée démarre en essai 7 jours, puis une décision « la mettre en route ? »)
//   cron    taches_cron relance aussi une fois, une heure plus tard, un passage en échec (reprise_prevue)
//   cron    controle_cron {cle} (pg_cron quotidien) → contrôle du parcours client, alerte e-mail si problème (controle.ts)
//   admin   admin_harnais {workspace_id} → (re)génère le harnais métier de l'espace par l'IA, en arrière-plan (harnais.ts)
//   cron    ameliorations_cron {cle} (pg_cron quotidien) → propositions d'amélioration tirées des conversations, déposées dans CRM › Développement (ameliorations.ts)
//   cron    taches_cron {cle} (pg_cron horaire) → tache_executer {cle, id} par tâche échue, chacune dans sa propre instance
// Veille, contacts et mailings (veille.ts, mailing.ts) :
//   client  flux | flux_ajouter {url} | flux_basculer {id, actif} | flux_supprimer {id} | flux_actualiser
//           contacts {recherche?} | contact_ajouter {email, prenom?, nom?, listes?} | contacts_importer {lignes[], listes?, consentement:true}
//           contact_supprimer {id} | contact_desinscrire {id}          (écriture des contacts : propriétaire)
//   cron    envois_traiter {cle, id} : un lot d'une campagne validée (relancé jusqu'à épuisement ou plafond du jour)
//   public  desinscription {jeton} ; POST …/studio?desinscription=<jeton> (désinscription en un clic des messageries)
//
// ⚠ En-têtes HTTP sortants : ASCII uniquement (ByteString), cf. Edge Function agent.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { calculFactice, hasherMotDePasse, motDePasseValide, nouveauJeton, sha256, verifierMotDePasse } from "./securite.ts";
import { statutMedia, supprimerMedia, urlSignee } from "./medias.ts";
import { HARNESS_PERIMETRE_DEFAUT, HARNESS_REGLES_DEFAUT } from "./contexte.ts";
import { connecteursActifs, enregistrerConnecteur, listerConnecteurs } from "./connecteurs.ts";
import * as veille from "./veille.ts";
import * as mailing from "./mailing.ts";
import * as bureau from "./bureau.ts";
import { creerInvitation, ouvrirInvitation } from "./invitations.ts";
import { egaliteSure } from "./taches.ts";
import { deciderLivrable, depenseJour, etatEspace, garde, journaliser, lireJournal, listerLivrables, modifierLivrable, provisionner, motDePasseProvisoire, soumettreLivrable, soumettreOnboarding, suspendre, verifierJournal } from "./gouvernance.ts";
import * as responsables from "./responsables.ts";
import { creerBoite, secretsWebhook } from "./agentmail.ts";
import { verifierSvix } from "./liaison.ts";
import { traiterMail, type MessageRecu } from "./liaison_traitement.ts";
import * as zernio from "./zernio.ts";
import * as applications from "./applications.ts";
import { facturationEspace, facturationEspaces, tarifConnecteurs } from "./facturation.ts";
import * as stripe from "./stripe.ts";
import * as controle from "./controle.ts";
import * as ameliorations from "./ameliorations.ts";
import * as harnais from "./harnais.ts";
import * as courriel from "./courriel.ts";
import * as essai from "./essai.ts";
import * as contrats from "./contrats.ts";
import * as cgv from "./cgv.ts";
import * as dossiers from "./dossiers.ts";
import { colonneSensibleAbsente, detecterSensible, DOSSIER_SENSIBLE, messageSensible } from "./sensible.ts";
import { aVenir, faitsSemaine, type LigneFait } from "./faits.ts";
import { etatsAgents } from "./livrables.ts";
import * as recharges from "./recharges.ts";
import * as equipe from "./equipe.ts";
import * as consignes from "./consignes.ts";
import * as lots from "./lots.ts";
import * as mcpClient from "./mcp_client.ts";
import * as apiClient from "./api_client.ts";
import * as accesAgents from "./acces.ts";
import * as calendrier from "./calendrier.ts";
import * as fichiers from "./fichiers.ts";
import { origineSure, etatConnexions, rapportEspace, corsHeaders, json, SESSION_JOURS, ECHECS_MAX, ECHECS_FENETRE_MIN, MODELES_STUDIO, MODELE_DEFAUT, autorise, DOC_MAX, type Piece, type Session, SELECT_WS, versSession, acteurDe, chargerSession } from "./socle.ts";
import { desinscrire, relancerEnvois, etatVeille, etatContacts, etatLiaison, refusConnecteurEssai, etatAbonnement, agentsDuWorkspace, debutMois, compterDemandesMois, construireMe } from "./etats.ts";
import { chat, executeurMail } from "./chat.ts";
import { cleCron, declencherTache, executerTache, tachesEchues, type EtapeLot, declencherLot, executerEtapeLot, listerTaches, enregistrerTache, listerRoutines, lireRoutine, reglerRoutine, galerieRoutines, proposerRoutine, creerRoutine } from "./planification.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Administration (depuis le CRM, manager connecté)
// ─────────────────────────────────────────────────────────────────────────────

/** Identifiant du manager CRM appelant, ou null. */
async function estManager(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await db.auth.getUser();
  if (!u?.user) return null;
  const { data } = await db.rpc("is_manager");
  return data === true ? u.user.id : null;
}

/** Clé OpenRouter du CRM : secret de la fonction, sinon Paramètres › IA. */
async function cleOpenRouter(sb: SupabaseClient): Promise<string> {
  const env = Deno.env.get("OPENROUTER_API_KEY");
  if (env?.trim()) return env.trim();
  const { data } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
  return String((data?.valeur as Record<string, string> | null)?.openrouter_key ?? "").trim();
}

/** Catalogue OpenRouter restreint à MODELES_STUDIO, avec la clé du CRM, pour les sélecteurs de l'admin. */
async function listerModeles(sb: SupabaseClient): Promise<Response> {
  const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
  const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
  const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
  const resp = await fetch("https://openrouter.ai/api/v1/models", {
    headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : {},
  });
  if (!resp.ok) return json({ error: `OpenRouter ${resp.status}` }, 502);
  const { data } = await resp.json() as { data: Record<string, unknown>[] };
  const parMillion = (x: unknown) => {
    const n = Number(x);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 1_000_000 * 100) / 100 : null;
  };
  const modeles = (data ?? [])
    .filter((m) => MODELES_STUDIO.includes(String(m.id)))
    .map((m) => {
      const id = String(m.id);
      const nom = String(m.name ?? id);
      const prix = (m.pricing ?? {}) as { prompt?: string; completion?: string };
      return {
        id,
        // « Anthropic: Claude Sonnet 4.5 » → constructeur « Anthropic », nom « Claude Sonnet 4.5 ».
        constructeur: nom.includes(":") ? nom.split(":")[0].trim() : id.split("/")[0],
        nom: nom.includes(":") ? nom.split(":").slice(1).join(":").trim() : nom,
        contexte: Number(m.context_length) || null,
        prix_entree: parMillion(prix.prompt),
        prix_sortie: parMillion(prix.completion),
      };
    })
    .sort((a, b) => a.constructeur.localeCompare(b.constructeur, "fr") || a.nom.localeCompare(b.nom, "fr"));
  return json({ defaut: autorise(ai.model_studio) ?? MODELE_DEFAUT, modeles });
}

async function admin(sb: SupabaseClient, action: string, body: Record<string, unknown>, managerId: string): Promise<Response> {
  if (action === "admin_modeles") return await listerModeles(sb);
  // Contrôle du parcours client à la demande (l'e-mail d'alerte part seulement si demandé).
  if (action === "admin_controle") return json(await controle.executer(sb, { envoyer: body.envoyer === true }));
  // Serveur MCP d'un client : on vérifie qu'il répond et ce qu'il expose avant de le passer en « Connecté ».
  if (action === "admin_tester_mcp") {
    const s = await mcpClient.serveurDeLEspace(sb, null, String(body.id ?? "")).catch(() => null);
    if (!s) return json({ error: "Serveur MCP introuvable ou jeton illisible" }, 404);
    return json(await mcpClient.tester(s));
  }
  // Harnais métier : (re)génération par l'IA, en arrière-plan ; le CRM relit harnais_statut.
  if (action === "admin_harnais") {
    const wsId = String(body.workspace_id ?? "");
    const { data: w, error } = await sb.from("studio_workspaces").select("id, secteur, harnais_statut, harnais_maj").eq("id", wsId).maybeSingle();
    if (error) return json({ error: "Migration des harnais métier non appliquée ?" }, 400);
    if (!w) return json({ error: "Espace introuvable" }, 404);
    if (!String(w.secteur ?? "").trim()) return json({ error: "Renseignez d'abord le secteur d'activité de l'espace." }, 400);
    if (w.harnais_statut === "en_cours" && w.harnais_maj && Date.now() - new Date(String(w.harnais_maj)).getTime() < 30 * 60_000) {
      return json({ error: "Une génération est déjà en cours pour cet espace." }, 409);
    }
    await sb.from("studio_workspaces").update({ harnais_statut: "en_cours", harnais_maj: new Date().toISOString(), harnais_erreur: null }).eq("id", wsId);
    harnais.lancer(sb, wsId, { verrouPose: true });
    return json({ ok: true, harnais_statut: "en_cours" });
  }
  if (action === "admin_tester_api") {
    const a = await apiClient.apiDeLEspace(sb, null, String(body.id ?? "")).catch(() => null);
    if (!a) return json({ error: "API introuvable ou clé illisible" }, 404);
    return json(await apiClient.tester(a));
  }
  if (action === "admin_liaison") {
    const wsId = String(body.workspace_id ?? "");
    const { data: w } = await sb.from("studio_workspaces").select("id, nom, liaison_inbox_id").eq("id", wsId).maybeSingle();
    if (!w) return json({ error: "Espace introuvable" }, 404);
    if (body.activer === true && !w.liaison_inbox_id) {
      try {
        const b = await creerBoite({ wsId, nom: w.nom, username: body.username ? String(body.username) : undefined });
        const { error } = await sb.from("studio_workspaces").update({ liaison_inbox_id: b.inbox_id, liaison_email: b.email.toLowerCase() }).eq("id", wsId);
        if (error) return json({ error: error.message }, 400);
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : String(e) }, 502);
      }
    }
    const maj: Record<string, unknown> = {};
    if (typeof body.activer === "boolean") maj.liaison_actif = body.activer;
    if (body.agent !== undefined) maj.liaison_agent = body.agent ? String(body.agent) : null;
    if (Object.keys(maj).length) {
      const { error } = await sb.from("studio_workspaces").update(maj).eq("id", wsId);
      if (error) return json({ error: error.message }, 400);
      if (typeof body.activer === "boolean") {
        await journaliser(sb, { wsId, acteur: "crm", action: body.activer ? "liaison_activee" : "liaison_coupee" });
      }
    }
    return json(await etatLiaison(sb, wsId, true));
  }
  if (action === "admin_provisionner") {
    const r = await provisionner(sb, body, managerId);
    return "erreur" in r ? json({ error: r.erreur }, r.statut) : json(r);
  }
  if (action === "admin_suspendre" || action === "admin_journal") {
    const wsId = String(body.workspace_id ?? "");
    const { data: w } = await sb.from("studio_workspaces").select("id").eq("id", wsId).maybeSingle();
    if (!w) return json({ error: "Espace introuvable" }, 404);
    if (action === "admin_suspendre") {
      const r = await suspendre(sb, wsId, body.suspendu === true, "crm");
      return "erreur" in r ? json({ error: r.erreur }, 400) : json({ ok: true, ...(await etatEspace(sb, wsId)) });
    }
    const [lignes, verification, depense] = await Promise.all([lireJournal(sb, wsId, 500), verifierJournal(sb, wsId), depenseJour(sb, wsId)]);
    return json({ lignes, verification, depense_jour_eur: depense });
  }
  if (action === "admin_connexions") {
    return json(await etatConnexions(String(body.workspace_id ?? "")));
  }
  if (action === "admin_facturation_connecteurs") {
    return json(await facturationEspaces(sb));
  }
  if (action === "admin_invitation") {
    const wsId = String(body.workspace_id ?? "");
    const { data: w } = await sb.from("studio_workspaces").select("id").eq("id", wsId).maybeSingle();
    if (!w) return json({ error: "Espace introuvable" }, 404);
    const inv = await creerInvitation(sb, {
      wsId, cible: body.cible ? String(body.cible) : null,
      email: body.email ? String(body.email) : null, creePar: "crm", origine: origineSure(String(body.origine ?? "")),
    });
    return json(inv);
  }
  if (action === "admin_rapport") {
    const wsId = String(body.workspace_id ?? "");
    const { data: w } = await sb.from("studio_workspaces").select("*").eq("id", wsId).maybeSingle();
    if (!w) return json({ error: "Espace introuvable" }, 404);
    return json({
      rapport: await rapportEspace(sb, wsId, body.mois), nom: w.nom, entete: w.entete ?? {},
      logo_url: w.logo_chemin ? await urlSignee(sb, String(w.logo_chemin)) : null,
    });
  }
  if (action === "admin_harness_defaut") {
    return json({ regles: HARNESS_REGLES_DEFAUT, perimetre: HARNESS_PERIMETRE_DEFAUT });
  }
  const password = String(body.password ?? "");
  const invalide = motDePasseValide(password);
  if (invalide) return json({ error: invalide }, 400);

  if (action === "admin_create_user") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail invalide" }, 400);
    const { data: ws } = await sb.from("studio_workspaces").select("max_utilisateurs").eq("id", String(body.workspace_id)).maybeSingle();
    if (!ws) return json({ error: "Espace introuvable" }, 404);
    const { count } = await sb.from("studio_users").select("id", { count: "exact", head: true }).eq("workspace_id", String(body.workspace_id)).eq("actif", true);
    if ((count ?? 0) >= ws.max_utilisateurs) {
      return json({ error: `Limite de ${ws.max_utilisateurs} utilisateurs atteinte pour cet espace (modifiable dans la fiche de l'espace).` }, 400);
    }
    const { data: u, error } = await sb.from("studio_users").insert({
      workspace_id: String(body.workspace_id), email,
      prenom: body.prenom ? String(body.prenom) : null, nom: body.nom ? String(body.nom) : null,
      role: body.role === "proprietaire" ? "proprietaire" : "membre",
    }).select("id").single();
    if (error) {
      return json({ error: error.code === "23505" ? "Cet e-mail a déjà un accès au Studio." : error.message }, 400);
    }
    await sb.from("studio_credentials").insert({ user_id: u.id, password_hash: await hasherMotDePasse(password), doit_changer: true });
    return json({ ok: true, id: u.id });
  }

  // admin_set_password : nouveau mot de passe provisoire + déconnexion de toutes les sessions.
  const userId = String(body.user_id ?? "");
  const { error } = await sb.from("studio_credentials").upsert({
    user_id: userId, password_hash: await hasherMotDePasse(password), doit_changer: true, updated_at: new Date().toISOString(),
  });
  if (error) return json({ error: error.message }, 400);
  await sb.from("studio_sessions").delete().eq("user_id", userId);
  return json({ ok: true });
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const brut = await req.text();

    // ── Désinscription en un clic (en-tête List-Unsubscribe-Post des messageries) ──
    const jetonDesinscription = new URL(req.url).searchParams.get("desinscription");
    if (jetonDesinscription) {
      await desinscrire(sb, jetonDesinscription);
      return json({ ok: true });
    }

    // ── Webhook Stripe (paiements du Studio), signé Stripe-Signature ──
    if (req.headers.get("stripe-signature")) {
      const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
      if (!secret) return json({ error: "Webhook non configuré" }, 503);
      if (!(await stripe.verifierSignature(secret, req.headers.get("stripe-signature"), brut))) return json({ error: "Signature invalide" }, 401);
      const evt = JSON.parse(brut);
      try {
        console.log(`[studio] stripe ${evt.type} ${evt.id} : ${await stripe.traiterEvenement(sb, evt)}`);
        return json({ ok: true });
      } catch (e) {
        // 500 : Stripe renverra l'événement plus tard.
        console.error("[studio] stripe:", e instanceof Error ? e.message : String(e));
        return json({ error: "Traitement impossible" }, 500);
      }
    }

    // ── Webhook AgentMail (canal e-mail de liaison), signé Svix ──
    if (req.headers.get("svix-id")) {
      const ok = await verifierSvix(secretsWebhook(), {
        id: req.headers.get("svix-id"), horodatage: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature"),
      }, brut);
      if (!secretsWebhook().length) return json({ error: "Webhook non configuré" }, 503);
      if (!ok) return json({ error: "Signature invalide" }, 401);
      const evt = JSON.parse(brut) as { event_type?: string; event_id?: string; message?: MessageRecu };
      if (evt.event_type === "message.received" && evt.message?.inbox_id && evt.message.message_id) {
        // Réponse immédiate (AgentMail réessaie sinon) ; la mission continue en arrière-plan.
        const travail = traiterMail(sb, String(evt.event_id ?? evt.message.message_id), evt.message, executeurMail(sb), async (wsId) => {
          const { data: w } = await sb.from("studio_workspaces").select(SELECT_WS).eq("id", wsId).single();
          return (await agentsDuWorkspace(sb, versSession("mail", {}, w as Record<string, unknown>).ws)).map((a) => ({ id: String(a.id), prenom: String(a.prenom) }));
        })
          .catch((e) => console.error("[studio] liaison:", e instanceof Error ? e.message : String(e)));
        (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(travail);
      }
      return json({ ok: true });
    }

    let body: Record<string, unknown>;
    try { body = JSON.parse(brut || "{}") as Record<string, unknown>; } catch { body = {}; }
    const action = String(body.action ?? "");

    // ── Tâches planifiées (pg_cron, puis une instance par tâche) : clé du déclencheur obligatoire ──
    if (action === "taches_cron" || action === "tache_executer" || action === "envois_traiter" || action === "controle_cron" || action === "ameliorations_cron" || action === "lot_etape") {
      const cle = await cleCron(sb);
      if (!cle || typeof body.cle !== "string" || body.cle.length !== cle.length || !(await egaliteSure(body.cle, cle))) {
        return json({ error: "Non autorisé" }, 401);
      }
      if (action === "taches_cron") {
        return json({ lancees: await tachesEchues(sb, cle), campagnes: await relancerEnvois(sb), harnais: await harnais.rattraper(sb) });
      }
      if (action === "controle_cron") {
        const travail = controle.executer(sb).catch((e) => console.error("[studio] contrôle du parcours :", e instanceof Error ? e.message : String(e)));
        (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(travail);
        return json({ ok: true });
      }
      if (action === "lot_etape") {
        const etape = body.etape as EtapeLot | undefined;
        if (!etape || !Array.isArray(etape.ids) || typeof etape.ws !== "string") return json({ error: "Étape invalide" }, 400);
        const travail = executerEtapeLot(sb, cle, { ...etape, echecs: Array.isArray(etape.echecs) ? etape.echecs : [] })
          .catch((e) => console.error("[studio] lot:", e instanceof Error ? e.message : String(e)));
        (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(travail);
        return json({ ok: true });
      }
      if (action === "ameliorations_cron") {
        const travail = ameliorations.executer(sb);
        (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(travail);
        return json({ ok: true });
      }
      if (action === "envois_traiter") {
        const id = String(body.id ?? "");
        const travail = (async () => {
          const r = await mailing.traiterLot(sb, id, async (wsId) => {
            const b = bureau.boitePour(await bureau.boitesEspace(wsId), "email");
            if (!b) throw new Error("Aucune messagerie connectée");
            return {
              plafondJour: bureau.plafondJour(b), bloquante: bureau.erreurBloquante, lisible: bureau.messageErreur,
              envoyer: (m) => bureau.envoyerMessageMailing(b.id, m),
            };
          });
          if (r.restants && !r.plafond) await mailing.declencherEnvois(sb, id);
        })().catch((e) => console.error("[studio] envois:", e instanceof Error ? e.message : String(e)));
        (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(travail);
        return json({ ok: true });
      }
      const travail = executerTache(sb, String(body.id ?? ""), {
        essai: body.essai === true, manuel: body.manuel === true, tentative: body.tentative === 2 ? 2 : 1,
      })
        .catch((e) => console.error("[studio] tâche:", e instanceof Error ? e.message : String(e)));
      (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(travail);
      return json({ ok: true });
    }

    // ── Administration CRM ──
    if (["admin_create_user", "admin_set_password", "admin_modeles", "admin_harness_defaut", "admin_rapport", "admin_connexions",
      "admin_invitation", "admin_provisionner", "admin_suspendre", "admin_journal", "admin_liaison", "admin_facturation_connecteurs", "admin_controle", "admin_tester_mcp", "admin_tester_api", "admin_harnais"].includes(action)) {
      const managerId = await estManager(req);
      if (!managerId) return json({ error: "Réservé aux managers du CRM" }, 403);
      return await admin(sb, action, body, managerId);
    }

    // ── Tarif public des connecteurs (page /agents-ia) : prix et types inclus, rien d'autre ──
    if (action === "tarif_public") {
      return json(await tarifConnecteurs(sb));
    }

    // ── Questionnaire d'onboarding public (/studio/demarrer) ──
    if (action === "onboarding_soumettre") {
      const depuis = body.depuis ? ` (depuis ${String(body.depuis).slice(0, 60)})` : "";
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
      const r = await soumettreOnboarding(sb, body, `/studio/demarrer${depuis}`, origineSure(req), undefined, ip);
      return "erreur" in r ? json({ error: r.erreur }, r.statut) : json(r);
    }

    if (action === "desinscription") {
      const r = await desinscrire(sb, String(body.jeton ?? ""));
      return r ? json({ ok: true, entreprise: r }) : json({ error: "Lien de désinscription invalide." }, 404);
    }

    // ── Connexion ──
    // ── Invitation publique « connectez votre application » (sans session : l'espace vient de l'invitation) ──
    if (action === "invitation_ouvrir") {
      const r = await ouvrirInvitation(sb, body.jeton, origineSure(req));
      if (!r) return json({ error: "Ce lien a expiré ou n'est plus valide. Demandez-en un nouveau." }, 404);
      return json(r);
    }

    // ── Mot de passe oublié : lien à usage unique envoyé par e-mail (réponse identique que le compte existe ou non) ──
    if (action === "mdp_oublie") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const { data: u } = await sb.from("studio_users").select("id, prenom, actif").eq("email", email).maybeSingle();
        if (u?.actif) {
          const { count } = await sb.from("studio_reinitialisations").select("id", { count: "exact", head: true })
            .eq("user_id", u.id).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
          if ((count ?? 0) < 3) {
            const jetonReinit = nouveauJeton();
            const { error } = await sb.from("studio_reinitialisations").insert({
              user_id: u.id, jeton_hash: await sha256(jetonReinit), expire_le: new Date(Date.now() + 3_600_000).toISOString(),
            });
            if (error) console.error("[studio] mot de passe oublié :", error.message);
            else {
              await courriel.envoyer(sb, { a: email, ...courriel.mailReinitialisation({ prenom: u.prenom, lien: `${origineSure(req)}/studio/mot-de-passe/${jetonReinit}` }) })
                .catch((e) => console.error("[studio] e-mail de réinitialisation :", e instanceof Error ? e.message : String(e)));
            }
          }
        }
      }
      return json({ ok: true });
    }
    if (action === "mdp_reinitialiser") {
      const nouveau = String(body.nouveau ?? "");
      const invalide = motDePasseValide(nouveau);
      if (invalide) return json({ error: invalide }, 400);
      const { data: r } = await sb.from("studio_reinitialisations").select("id, user_id, expire_le, utilise_le")
        .eq("jeton_hash", await sha256(String(body.jeton ?? ""))).maybeSingle();
      if (!r || r.utilise_le || new Date(r.expire_le) < new Date()) {
        return json({ error: "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau depuis la page de connexion." }, 400);
      }
      await sb.from("studio_credentials").update({ password_hash: await hasherMotDePasse(nouveau), doit_changer: false }).eq("user_id", r.user_id);
      await sb.from("studio_reinitialisations").update({ utilise_le: new Date().toISOString() }).eq("id", r.id);
      // Toutes les sessions ouvertes sont fermées : seul le nouveau mot de passe permet d'entrer.
      await sb.from("studio_sessions").delete().eq("user_id", r.user_id);
      const { data: u } = await sb.from("studio_users").select("workspace_id, email").eq("id", r.user_id).maybeSingle();
      if (u) {
        await sb.from("studio_login_echecs").delete().eq("email", u.email);
        await journaliser(sb, { wsId: u.workspace_id, acteur: `client:${u.email}`, action: "mot_de_passe_reinitialise" });
      }
      return json({ ok: true });
    }

    if (action === "login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !password) return json({ error: "E-mail et mot de passe requis" }, 400);
      const depuis = new Date(Date.now() - ECHECS_FENETRE_MIN * 60_000).toISOString();
      const { count } = await sb.from("studio_login_echecs").select("id", { count: "exact", head: true })
        .eq("email", email).gte("created_at", depuis);
      if ((count ?? 0) >= ECHECS_MAX) {
        return json({ error: `Trop de tentatives. Réessayez dans ${ECHECS_FENETRE_MIN} minutes.` }, 429);
      }
      const { data: u } = await sb.from("studio_users").select("id, actif, studio_credentials(password_hash)")
        .eq("email", email).maybeSingle(); // e-mails stockés en minuscules (admin_create_user)
      const cred = u?.studio_credentials as unknown as { password_hash: string } | { password_hash: string }[] | null;
      const hash = Array.isArray(cred) ? cred[0]?.password_hash : cred?.password_hash;
      const ok = hash ? await verifierMotDePasse(password, hash) : (await calculFactice(password), false);
      if (!u || !ok || !u.actif) {
        await sb.from("studio_login_echecs").insert({ email });
        return json({ error: "Identifiants incorrects ou accès désactivé." }, 401);
      }
      const token = nouveauJeton();
      await sb.from("studio_sessions").insert({
        user_id: u.id, token_hash: await sha256(token),
        expires_at: new Date(Date.now() + SESSION_JOURS * 86_400_000).toISOString(),
        user_agent: (req.headers.get("User-Agent") ?? "").slice(0, 300),
      });
      await sb.from("studio_users").update({ last_login_at: new Date().toISOString() }).eq("id", u.id);
      await sb.from("studio_login_echecs").delete().eq("email", email);
      const s = await chargerSession(sb, token);
      if (!s) return json({ error: "Votre espace est inactif ou expiré. Contactez Aissociate." }, 403);
      return json({ token, ...(await construireMe(sb, s)) });
    }

    // ── Actions client : session obligatoire ──
    const s = await chargerSession(sb, body.token);
    if (!s) return json({ error: "Session expirée", session: false }, 401);

    // CGV non acceptées (ou modifiées depuis) : rien d'autre que les accepter.
    const textesCgv = await cgv.chargerCgv(sb);
    if (textesCgv && s.user.cgv_version !== textesCgv.version && !["me", "logout", "change_password", "cgv", "cgv_accepter", "bug_signaler"].includes(action)) {
      return json({ error: "Acceptez les conditions générales pour accéder à votre Studio.", cgv: true }, 403);
    }
    if (essai.essaiTermine(s.ws) && !essai.ACTIONS_APRES_ESSAI.has(action)) {
      return json({ error: essai.MESSAGE_FIN, essai_termine: true }, 402);
    }

    switch (action) {
      case "me":
        return json(await construireMe(sb, s));

      case "cgv": {
        const c = await cgv.chargerCgv(sb);
        return json({ version: c?.version ?? null, documents: c?.documents ?? [], acceptees: !c || s.user.cgv_version === c.version });
      }

      case "cgv_accepter": {
        const c = await cgv.chargerCgv(sb);
        if (!c) return json({ ok: true });
        if (String(body.version ?? "") !== c.version) return json({ error: "Les conditions ont été mises à jour : relisez-les avant d'accepter." }, 409);
        await cgv.accepter(sb, s.user.id, c.version, {
          ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
          user_agent: (req.headers.get("User-Agent") ?? "").slice(0, 300), documents: c.documents.map((d) => d.titre),
        });
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "cgv_acceptees", detail: { version: c.version, documents: c.documents.map((d) => d.titre) } });
        return json({ ok: true });
      }

      // Guide de prise en main vu (ou passé) : il ne s'affiche plus tout seul.
      case "tutoriel_vu":
        await sb.from("studio_users").update({ tutoriel_vu_le: new Date().toISOString() }).eq("id", s.user.id);
        return json({ ok: true });

      case "logout":
        await sb.from("studio_sessions").delete().eq("id", s.sessionId);
        return json({ ok: true });

      // Bug signalé depuis le Studio : même liste que les bugs du CRM (onglet Développement).
      // Les clients n'ont pas de profil CRM : le ticket est rattaché au premier administrateur,
      // l'espace et l'auteur réels figurent dans le titre et la description.
      case "bug_signaler": {
        const description = String(body.description ?? "").trim().slice(0, 4000);
        if (!description) return json({ error: "Décrivez le problème en quelques mots." }, 400);
        const priorites = ["faible", "normale", "haute", "critique"];
        const priorite = priorites.includes(String(body.priorite)) ? String(body.priorite) : "normale";
        const contexte = String(body.contexte ?? "").slice(0, 4000);
        const { data: admin } = await sb.from("profiles").select("id").eq("is_admin", true)
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (!admin) return json({ error: "Signalement indisponible pour le moment." }, 503);

        let captureUrl: string | null = null;
        let captureEchouee = false;
        if (body.capture) {
          try {
            const octets = Uint8Array.from(atob(String(body.capture)), (c) => c.charCodeAt(0));
            const png = octets.length > 8 && octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47;
            if (!png || octets.length > 6_000_000) throw new Error("capture refusée");
            // Chemin imprévisible : le bucket `screenshots` est public, comme pour les bugs du CRM.
            const chemin = `studio/${s.ws.id}/${crypto.randomUUID()}.png`;
            const { error } = await sb.storage.from("screenshots").upload(chemin, octets, { contentType: "image/png" });
            if (error) throw new Error(error.message);
            captureUrl = sb.storage.from("screenshots").getPublicUrl(chemin).data.publicUrl;
          } catch (e) {
            captureEchouee = true;
            console.error("[studio] capture du bug :", e instanceof Error ? e.message : String(e));
          }
        }
        const titreSaisi = String(body.titre ?? "").trim() || description.split("\n")[0];
        const auteur = [[s.user.prenom, s.user.nom].filter(Boolean).join(" "), s.user.email].filter(Boolean).join(" · ");
        const { error } = await sb.from("tickets").insert({
          type: "bug",
          titre: `[Studio · ${s.ws.nom}] ${titreSaisi}`.slice(0, 200),
          description: `${description}\n\n— Studio —\nEspace : ${s.ws.nom}\nSignalé par : ${auteur}${contexte ? `\n${contexte}` : ""}`,
          priorite,
          created_by: admin.id,
          screenshot_url: captureUrl,
        });
        if (error) return json({ error: `Envoi impossible : ${error.message}` }, 500);
        await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), action: "bug_signale", detail: { titre: titreSaisi.slice(0, 120) } });
        return json({ ok: true, capture_echouee: captureEchouee });
      }

      case "change_password": {
        const nouveau = String(body.nouveau ?? "");
        const invalide = motDePasseValide(nouveau);
        if (invalide) return json({ error: invalide }, 400);
        const { data: c } = await sb.from("studio_credentials").select("password_hash").eq("user_id", s.user.id).single();
        if (!c || !(await verifierMotDePasse(String(body.ancien ?? ""), c.password_hash))) {
          return json({ error: "Mot de passe actuel incorrect." }, 400);
        }
        await sb.from("studio_credentials").update({
          password_hash: await hasherMotDePasse(nouveau), doit_changer: false, updated_at: new Date().toISOString(),
        }).eq("user_id", s.user.id);
        // Les autres appareils sont déconnectés.
        await sb.from("studio_sessions").delete().eq("user_id", s.user.id).neq("id", s.sessionId);
        return json({ ok: true });
      }

      case "conversations": {
        let q = sb.from("studio_conversations").select("id, agent_id, titre, updated_at")
          .eq("workspace_id", s.ws.id).eq("user_id", s.user.id).order("updated_at", { ascending: false }).limit(50);
        if (typeof body.agent_id === "string") q = q.eq("agent_id", body.agent_id);
        const { data } = await q;
        return json({ conversations: data ?? [] });
      }

      case "messages": {
        const { data: conv } = await sb.from("studio_conversations").select("id, agent_id, titre, generation_depuis")
          .eq("id", String(body.conversation_id)).eq("workspace_id", s.ws.id).eq("user_id", s.user.id).maybeSingle();
        if (!conv) return json({ error: "Conversation introuvable" }, 404);
        const { generation_depuis, ...c } = conv;
        const en_cours = Boolean(generation_depuis && Date.now() - Date.parse(generation_depuis) < 180_000);
        const { data } = await sb.from("studio_messages").select("id, role, content, retour, epingle, created_at, media_id, pieces")
          .eq("conversation_id", c.id).order("created_at");
        // Médias : état à jour (une vidéo en cours avance à chaque consultation) + URL signée.
        const avecMedias = (data ?? []).some((m) => m.media_id);
        const cle = avecMedias ? await cleOpenRouter(sb) : "";
        const messages = await Promise.all((data ?? []).map(async ({ media_id, pieces, ...m }) => ({
          ...m, media: media_id ? await statutMedia(sb, cle, s.ws.id, media_id) : null,
          pieces: ((pieces ?? []) as Piece[]).map((x) => ({ nom: x.nom, format: x.format, taille: x.taille })),
        })));
        return json({ conversation: c, messages, en_cours });
      }

      // ── Messagerie, agenda et fichiers (Zernio) : toujours l'espace de la session ──
      case "bureau_etat":
        return json(await etatConnexions(s.ws.id));

      case "bureau_connecter": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const quoi = String(body.quoi ?? "");
        if (quoi !== "google" && quoi !== "microsoft" && quoi !== "email") return json({ error: "Messagerie inconnue" }, 400);
        if (!body.reconnecter) { const refus = await refusConnecteurEssai(sb, s); if (refus) return json({ error: refus }, 402); }
        const lien = await bureau.lienConnexion({
          wsId: s.ws.id, wsNom: s.ws.nom, quoi, retour: `${origineSure(req)}/studio/connecteurs?boite=${quoi}`,
          reconnecter: body.reconnecter ? String(body.reconnecter) : null,
        });
        return json({ lien });
      }

      case "bureau_deconnecter": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const b = await bureau.deconnecterBoite(s.ws.id, String(body.compte_id ?? ""));
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "connexion_retiree", detail: { integration: `zernio:${b.fournisseur}`, compte: b.adresse || b.nom } });
        return json(await etatConnexions(s.ws.id));
      }

      case "drive_choisir": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const lien = await bureau.lienChoixFichiers(s.ws.id, String(body.compte_id ?? ""), `${origineSure(req)}/studio/connecteurs?drive=1`);
        return json({ lien });
      }

      case "connexion_invitation": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        { const refus = await refusConnecteurEssai(sb, s); if (refus) return json({ error: refus }, 402); }
        return json(await creerInvitation(sb, {
          wsId: s.ws.id, cible: body.cible ? String(body.cible) : null,
          email: body.email ? String(body.email) : null, creePar: `studio:${s.user.id}`, origine: origineSure(req),
        }));
      }

      // ── Réseaux sociaux (Zernio) : un profil Zernio par espace ──
      case "reseaux_etat": {
        if (!zernio.zernioConfigure()) return json({ configure: false, comptes: [] });
        return json({ configure: true, comptes: await zernio.comptesEspace(s.ws.id) });
      }

      case "reseaux_connecter": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        if (!zernio.estReseau(body.reseau)) return json({ error: "Réseau inconnu" }, 400);
        if (!body.reconnecter) { const refus = await refusConnecteurEssai(sb, s); if (refus) return json({ error: refus }, 402); }
        const retour = `${origineSure(req)}/studio/connecteurs?reseau=${body.reseau}`;
        const lien = await zernio.lienConnexionReseau({
          wsId: s.ws.id, wsNom: s.ws.nom, reseau: body.reseau, retour,
          reconnecter: body.reconnecter ? String(body.reconnecter) : null,
        }).catch((e) => { throw new Error(bureau.messageErreur(e)); });
        return json({ lien });
      }

      case "reseaux_deconnecter": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const c = await zernio.deconnecterCompte(s.ws.id, String(body.compte_id ?? ""));
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "connexion_retiree", detail: { integration: `zernio:${c.reseau}`, compte: c.nom } });
        return json({ configure: true, comptes: await zernio.comptesEspace(s.ws.id) });
      }

      // ── Autres applications en un clic (Zernio) : vidéo, messageries, publicité, boutique, CRM… ──
      case "apps_etat": {
        if (!zernio.zernioConfigure()) return json({ configure: false, comptes: [] });
        return json({ configure: true, comptes: await applications.comptesApplications(s.ws.id) });
      }

      case "apps_connecter": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        if (!applications.estApplication(body.app)) return json({ error: "Application inconnue" }, 400);
        if (!body.reconnecter) { const refus = await refusConnecteurEssai(sb, s); if (refus) return json({ error: refus }, 402); }
        const boutique = body.app === "shopify" ? applications.boutiqueShopify(body.boutique) : null;
        if (body.app === "shopify" && !boutique) return json({ error: "Adresse de boutique Shopify invalide (ex. ma-boutique.myshopify.com)." }, 400);
        const lien = await applications.lienConnexionApplication({
          wsId: s.ws.id, wsNom: s.ws.nom, app: body.app, retour: `${origineSure(req)}/studio/connecteurs?app=${body.app}`,
          reconnecter: body.reconnecter ? String(body.reconnecter) : null, boutique,
        }).catch((e) => { throw new Error(bureau.messageErreur(e)); });
        return json({ lien });
      }

      case "apps_deconnecter": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const c = await applications.deconnecterApplication(s.ws.id, String(body.compte_id ?? ""));
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "connexion_retiree", detail: { integration: `zernio:${c.app}`, compte: c.nom } });
        return json({ configure: true, comptes: await applications.comptesApplications(s.ws.id) });
      }

      case "connecteurs":
        return json({ connecteurs: await listerConnecteurs(sb, s.ws.id) });

      case "connecteur_enregistrer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        if (essai.enEssai(s.ws) || s.ws.connecteurs_max != null) {
          // Mise à jour d'un connecteur déjà présent : permise ; nouveau connecteur : limité (essai, badges du contrat).
          const { data: deja } = await sb.from("studio_connecteurs").select("id").eq("workspace_id", s.ws.id).eq("type", String(body.type ?? "")).maybeSingle();
          if (!deja) { const refus = await refusConnecteurEssai(sb, s); if (refus) return json({ error: refus }, 402); }
        }
        const r = await enregistrerConnecteur(sb, s.ws.id, s.user.id, body);
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "connecteur_enregistre", detail: { type: String(body.type ?? "") } });
        return json({ ok: true, connecteurs: await listerConnecteurs(sb, s.ws.id) });
      }

      case "connecteur_supprimer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        await sb.from("studio_connecteurs").delete().eq("workspace_id", s.ws.id).eq("type", String(body.type ?? ""));
        // Un connecteur recréé plus tard sous le même nom repart ouvert à toute l'équipe.
        await accesAgents.reglerAcces(sb, s.ws.id, String(body.type ?? ""), null);
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "connecteur_supprime", detail: { type: String(body.type ?? "") } });
        return json({ ok: true, connecteurs: await listerConnecteurs(sb, s.ws.id) });
      }

      // ── Connecteurs réservés à certains agents (acces.ts) : pas de réglage = toute l'équipe ──
      case "acces_connecteurs":
        return json({ acces: Object.fromEntries(await accesAgents.chargerAcces(sb, s.ws.id)) });

      case "acces_connecteur_regler": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        if (!accesAgents.cleValide(body.cle)) return json({ error: "Connecteur inconnu" }, 400);
        const equipeIds = (await agentsDuWorkspace(sb, s.ws)).map((a) => String(a.id));
        const agentsChoisis = accesAgents.agentsRetenus(body.agents, equipeIds);
        if (agentsChoisis && !Array.isArray(agentsChoisis)) return json({ error: agentsChoisis.erreur }, 400);
        const r = await accesAgents.reglerAcces(sb, s.ws.id, body.cle, agentsChoisis);
        if (r.erreur) return json({ error: r.erreur }, 500);
        await journaliser(sb, {
          wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "connecteur_agents",
          detail: { connecteur: body.cle, nom: String(body.nom ?? "").slice(0, 120), agents: agentsChoisis ?? "toute l'équipe" },
        });
        return json({ acces: Object.fromEntries(await accesAgents.chargerAcces(sb, s.ws.id)) });
      }

      case "media_statut": {
        const media = await statutMedia(sb, await cleOpenRouter(sb), s.ws.id, String(body.id ?? ""));
        if (!media) return json({ error: "Média introuvable" }, 404);
        return json({ media });
      }

      case "medias": {
        // Galerie « Contenus » : visuels et vidéos prêts de tout l'espace.
        const { data } = await sb.from("studio_medias").select("id, type, agent_id, user_id, prompt, chemin, mime, created_at, conversation_id, dossier_id")
          .eq("workspace_id", s.ws.id).eq("statut", "pret").not("chemin", "is", null).order("created_at", { ascending: false }).limit(60);
        const medias = await Promise.all((data ?? []).map(async ({ chemin, ...m }) => ({
          ...m, url: chemin ? await urlSignee(sb, chemin) : null,
        })));
        return json({ medias });
      }

      case "media_supprimer": {
        // Le propriétaire, ou la personne qui a demandé le visuel.
        const id = String(body.id ?? "");
        if (s.user.role !== "proprietaire") {
          const { data: m } = await sb.from("studio_medias").select("user_id").eq("id", id).eq("workspace_id", s.ws.id).maybeSingle();
          if (!m || m.user_id !== s.user.id) return json({ error: "Seul le propriétaire de l'espace, ou la personne qui l'a demandé, peut supprimer ce visuel." }, 403);
        }
        const r = await supprimerMedia(sb, s.ws.id, id);
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), action: "media_supprime", detail: { media: id, type: r.type, prompt: r.prompt.slice(0, 120) } });
        return json({ ok: true });
      }

      case "conversation_delete": {
        await sb.from("studio_conversations").delete()
          .eq("id", String(body.conversation_id)).eq("workspace_id", s.ws.id).eq("user_id", s.user.id);
        return json({ ok: true });
      }

      case "chat":
        return await chat(sb, s, body);

      case "chat_consigne": {
        // Consigne ajoutée pendant qu'un agent réfléchit : lue par la génération en cours entre deux tours.
        const texte = String(body.texte ?? "").trim().slice(0, consignes.LONGUEUR_MAX);
        if (!texte) return json({ error: "Consigne vide." }, 400);
        const { data: conv } = await sb.from("studio_conversations").select("id, agent_id, generation_depuis")
          .eq("id", String(body.conversation_id ?? "")).eq("workspace_id", s.ws.id).eq("user_id", s.user.id).maybeSingle();
        if (!conv) return json({ error: "Conversation introuvable." }, 404);
        if (!conv.generation_depuis) return json({ error: "La réponse est déjà terminée : envoyez votre consigne comme nouveau message." }, 409);
        const { error } = await sb.from("studio_messages").insert({
          conversation_id: conv.id, workspace_id: s.ws.id, agent_id: conv.agent_id, role: "user",
          content: consignes.PREFIXE + texte, hors_quota: true, // précise la demande en cours, n'en compte pas une nouvelle
        });
        return error ? json({ error: error.message }, 400) : json({ ok: true });
      }

      case "chat_arreter": {
        await sb.from("studio_conversations").update({ arret_demande: new Date().toISOString() })
          .eq("id", String(body.conversation_id ?? "")).eq("workspace_id", s.ws.id).eq("user_id", s.user.id);
        return json({ ok: true });
      }

      case "retour":
      case "epingler": {
        const maj = action === "retour"
          ? { retour: body.valeur === 1 || body.valeur === -1 ? body.valeur : null }
          : { epingle: body.epingle === true };
        const { error } = await sb.from("studio_messages").update(maj)
          .eq("id", String(body.message_id)).eq("workspace_id", s.ws.id).eq("role", "assistant");
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "creations": {
        const { data } = await sb.from("studio_messages")
          .select("id, agent_id, content, created_at, conversation_id, studio_conversations!inner(titre, user_id)")
          .eq("workspace_id", s.ws.id).eq("epingle", true).order("created_at", { ascending: false }).limit(100);
        return json({
          creations: (data ?? []).map((m) => ({
            id: m.id, agent_id: m.agent_id, content: m.content, created_at: m.created_at, conversation_id: m.conversation_id,
            titre: (m.studio_conversations as unknown as { titre: string }).titre,
          })),
        });
      }

      case "ressources": {
        const colonnes = "id, titre, type, format, taille, actif, created_at, created_by, dossier_id, studio_users(prenom, nom)";
        const lire = (c: string) => sb.from("studio_documents").select(c).eq("workspace_id", s.ws.id).order("created_at", { ascending: false });
        let { data, error } = await lire(`${colonnes}, sensible`);
        if (colonneSensibleAbsente(error)) ({ data, error } = await lire(colonnes));
        return json({ ressources: data ?? [] });
      }

      case "ressource_get": {
        const { data } = await sb.from("studio_documents").select("id, titre, type, format, contenu, actif")
          .eq("id", String(body.id)).eq("workspace_id", s.ws.id).maybeSingle();
        if (!data) return json({ error: "Ressource introuvable" }, 404);
        // Fichier transmis tel quel : lien de téléchargement temporaire.
        const f = fichiers.fichierStocke(data.contenu, String(data.titre));
        return json({ ressource: { ...data, lien: f ? await urlSignee(sb, f.chemin) : null } });
      }

      case "ressource_add": {
        const titre = String(body.titre ?? "").trim().slice(0, 200);
        const contenu = String(body.contenu ?? "").slice(0, DOC_MAX);
        if (!titre || !contenu.trim()) return json({ error: "Titre et contenu requis" }, 400);
        let dossierAjout = (await dossiers.dossierDeLEspace(sb, s.ws.id, body.dossier_id)) || null;
        // RIB, pièce d'identité, bulletin de paie : rangé désactivé, les agents ne le lisent pas
        // tant que le client ne l'a pas activé lui-même (sensible.ts).
        const sensible = detecterSensible(titre, contenu);
        if (sensible && !dossierAjout) {
          const d = await dossiers.assurerChemin(sb, s.ws.id, DOSSIER_SENSIBLE, "Studio");
          if (!("erreur" in d)) dossierAjout = d.id;
        }
        const ligne = {
          workspace_id: s.ws.id, titre, contenu, created_by: s.user.id, dossier_id: dossierAjout,
          type: body.type === "fichier" ? "fichier" : "note",
          format: body.format ? String(body.format).slice(0, 10) : null,
          taille: Number.isFinite(Number(body.taille)) ? Number(body.taille) : null,
          ...(sensible ? { actif: false } : {}),
        };
        const inserer = (l: Record<string, unknown>) => sb.from("studio_documents").insert(l).select("id").single();
        let { data, error } = await inserer(sensible ? { ...ligne, sensible: sensible.type } : ligne);
        if (colonneSensibleAbsente(error)) ({ data, error } = await inserer(ligne));
        if (error || !data) return json({ error: error?.message ?? "Enregistrement impossible" }, 400);
        if (sensible) {
          await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "ressource_sensible", detail: { titre, nature: sensible.type } });
        }
        return json({ ok: true, id: data.id, sensible: sensible ? { type: sensible.type, message: messageSensible(sensible) } : null });
      }

      // ── Dossiers : ressources, livrables et médias ──
      case "dossiers": {
        const [liste, nb] = await Promise.all([dossiers.listerDossiers(sb, s.ws.id), dossiers.comptes(sb, s.ws.id)]);
        return json({ dossiers: liste, comptes: Object.fromEntries(nb) });
      }

      case "dossier_creer": {
        const parent = await dossiers.dossierDeLEspace(sb, s.ws.id, body.parent_id);
        if (parent === false) return json({ error: "Dossier parent introuvable" }, 404);
        const nom = dossiers.segments(String(body.nom ?? ""));
        if (!nom || nom.length !== 1) return json({ error: "Nom de dossier invalide (sans « / », 80 caractères au plus)." }, 400);
        const chemin = [parent ? dossiers.cheminDe(await dossiers.listerDossiers(sb, s.ws.id), parent) : "", nom[0]].filter(Boolean).join("/");
        const r = await dossiers.assurerChemin(sb, s.ws.id, chemin, s.user.prenom ?? s.user.email);
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "dossier_cree", detail: { dossier: chemin } });
        return json({ ok: true, id: r.id });
      }

      case "dossier_renommer": {
        const r = await dossiers.renommer(sb, s.ws.id, String(body.id ?? ""), String(body.nom ?? ""));
        return "erreur" in r ? json({ error: r.erreur }, 400) : json(r);
      }

      case "dossier_deplacer": {
        const parent = await dossiers.dossierDeLEspace(sb, s.ws.id, body.parent_id);
        if (parent === false) return json({ error: "Dossier parent introuvable" }, 404);
        const r = await dossiers.deplacer(sb, s.ws.id, String(body.id ?? ""), parent);
        return "erreur" in r ? json({ error: r.erreur }, 400) : json(r);
      }

      case "dossier_supprimer": {
        const r = await dossiers.supprimer(sb, s.ws.id, String(body.id ?? ""));
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "dossier_supprime", detail: { id: String(body.id) } });
        return json(r);
      }

      case "ranger": {
        const quoi = String(body.quoi ?? "") as dossiers.Element;
        if (!(quoi in dossiers.TABLES)) return json({ error: "Type d'élément inconnu" }, 400);
        const dossier = await dossiers.dossierDeLEspace(sb, s.ws.id, body.dossier_id);
        if (dossier === false) return json({ error: "Dossier introuvable" }, 404);
        const r = await dossiers.ranger(sb, s.ws.id, quoi, String(body.id ?? ""), dossier);
        return "erreur" in r ? json({ error: r.erreur }, 400) : json(r);
      }

      case "ressource_toggle": {
        if (body.actif === true) {
          // Une ressource sensible ne s'active qu'en connaissance de cause (confirmer: true), et c'est tracé.
          const { data: doc } = await sb.from("studio_documents").select("titre, sensible")
            .eq("id", String(body.id)).eq("workspace_id", s.ws.id).maybeSingle();
          if (doc?.sensible) {
            if (body.confirmer !== true) return json({ error: "Cette ressource contient des données sensibles : confirmez pour la rendre lisible par vos agents." }, 409);
            await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "ressource_sensible_activee", detail: { titre: doc.titre, nature: doc.sensible } });
          }
        }
        await sb.from("studio_documents").update({ actif: body.actif === true })
          .eq("id", String(body.id)).eq("workspace_id", s.ws.id);
        return json({ ok: true });
      }

      case "ressource_delete": {
        const { data: d } = await sb.from("studio_documents").select("titre, contenu").eq("id", String(body.id)).eq("workspace_id", s.ws.id).maybeSingle();
        await sb.from("studio_documents").delete().eq("id", String(body.id)).eq("workspace_id", s.ws.id);
        // Fichier transmis tel quel : il quitte aussi le stockage.
        const f = d ? fichiers.fichierStocke(d.contenu, String(d.titre)) : null;
        if (f?.chemin.startsWith(`${s.ws.id}/`)) await sb.storage.from("studio-medias").remove([f.chemin]).catch(() => undefined);
        return json({ ok: true });
      }

      // Gestion groupée (lots.ts) : activer, désactiver, ranger ou supprimer plusieurs ressources d'un coup.
      case "ressources_lot": {
        const op = lots.opGestion(body.op);
        if (!op) return json({ error: "Opération inconnue" }, 400);
        const ids = lots.idsValides(body.ids, lots.GESTION_MAX);
        if ("erreur" in ids) return json({ error: ids.erreur }, 400);
        const { data: docs } = await sb.from("studio_documents").select("id, titre, contenu, sensible, actif")
          .eq("workspace_id", s.ws.id).in("id", ids);
        const trouves = (docs ?? []) as { id: string; titre: string; contenu: string; sensible?: string | null; actif: boolean }[];
        if (!trouves.length) return json({ error: "Ressources introuvables" }, 404);
        const cibles = trouves.map((d) => d.id);
        if (op === "activer") {
          // Les sensibles ne s'activent qu'en connaissance de cause, comme une par une.
          const sensibles = trouves.filter((d) => d.sensible && !d.actif);
          if (sensibles.length && body.confirmer !== true) {
            return json({ error: "Certaines ressources contiennent des données sensibles : confirmez pour les rendre lisibles par vos agents.", sensibles: sensibles.map((d) => d.titre) }, 409);
          }
          for (const d of sensibles) {
            await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "ressource_sensible_activee", detail: { titre: d.titre, nature: d.sensible } });
          }
        }
        if (op === "activer" || op === "desactiver") {
          const { error } = await sb.from("studio_documents").update({ actif: op === "activer" }).eq("workspace_id", s.ws.id).in("id", cibles);
          if (error) return json({ error: error.message }, 400);
        } else if (op === "ranger") {
          const dossier = await dossiers.dossierDeLEspace(sb, s.ws.id, body.dossier_id);
          if (dossier === false) return json({ error: "Dossier introuvable" }, 404);
          for (const id of cibles) {
            const r = await dossiers.ranger(sb, s.ws.id, "ressource", id, dossier);
            if ("erreur" in r) return json({ error: r.erreur }, 400);
          }
        } else {
          const { error } = await sb.from("studio_documents").delete().eq("workspace_id", s.ws.id).in("id", cibles);
          if (error) return json({ error: error.message }, 400);
          // Fichiers transmis tels quels : ils quittent aussi le stockage.
          const chemins = trouves.map((d) => fichiers.fichierStocke(d.contenu, d.titre)?.chemin)
            .filter((c): c is string => Boolean(c?.startsWith(`${s.ws.id}/`)));
          if (chemins.length) await sb.storage.from("studio-medias").remove(chemins).catch(() => undefined);
        }
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "ressources_lot", detail: { op, nombre: cibles.length } });
        return json({ ok: true, nombre: cibles.length });
      }

      // Documents confiés à un agent (lots.ts) : la chaîne d'étapes tourne côté serveur, les résultats arrivent dans « Aujourd'hui ».
      case "lot_lancer": {
        const agents = await agentsDuWorkspace(sb, s.ws);
        const d = lots.demandeLot(body, agents.map((a) => String(a.id)));
        if ("erreur" in d) return json({ error: d.erreur }, 400);
        const { data: docs } = await sb.from("studio_documents").select("id, titre, actif, sensible")
          .eq("workspace_id", s.ws.id).in("id", d.ids);
        const trouves = (docs ?? []) as Pick<lots.DocLot, "id" | "titre" | "actif" | "sensible">[];
        const lisibles = d.ids.filter((id) => trouves.some((x) => x.id === id && lots.lisible(x)));
        const ecartes = trouves.filter((x) => !lots.lisible(x)).map((x) => x.titre);
        if (!lisibles.length) return json({ error: "Aucun document lisible : un document sensible doit d'abord être activé pour être confié à un agent." }, 400);
        const refus = await garde(sb, s.ws.id);
        if (refus) return json({ error: refus.message, gouvernance: true }, refus.statut);
        const cle = await cleCron(sb);
        if (!cle) return json({ error: "Traitement en lot indisponible pour le moment. Contactez Aissociate." }, 503);
        await declencherLot(cle, { ws: s.ws.id, user: s.user.id, agent: d.agent_id, consigne: d.consigne, mode: d.mode, ids: lisibles, index: 0, echecs: [] });
        await journaliser(sb, {
          wsId: s.ws.id, acteur: `client:${s.user.email}`, agentId: d.agent_id, action: "lot_lance",
          detail: { mode: d.mode, documents: lisibles.length, ecartes: ecartes.length, consigne: d.consigne.slice(0, 300) },
        });
        return json({ ok: true, nombre: lisibles.length, ecartes });
      }

      // Fichier joint au chat que le navigateur ne lit pas : gardé tel quel (fichiers.ts), rangé dans « Mes ressources ».
      case "fichier_deposer": {
        // Envoyé en morceaux (fichiers.MORCEAU) : les premiers sont mis de côté, le dernier recolle le tout.
        const nom = String(body.nom ?? "").trim().slice(0, 200) || "fichier";
        let morceau: Uint8Array;
        try { morceau = Uint8Array.from(atob(String(body.morceau ?? "")), (c) => c.charCodeAt(0)); }
        catch { return json({ error: "Fichier illisible." }, 400); }
        const refusMorceau = fichiers.controleMorceau({ jeton: body.jeton, index: body.index, total: body.total, taille: morceau.length });
        if (refusMorceau) return json({ error: refusMorceau }, 400);
        const jeton = String(body.jeton), index = Number(body.index), total = Number(body.total);
        const stock = sb.storage.from("studio-medias");
        if (index < total - 1) {
          const { error: e } = await stock.upload(fichiers.cheminMorceau(s.ws.id, jeton, index), morceau, { contentType: "application/octet-stream", upsert: true });
          return e ? json({ error: `Stockage : ${e.message}` }, 500) : json({ ok: true, recu: index + 1 });
        }
        const parties: Uint8Array[] = [];
        for (let i = 0; i < total - 1; i++) {
          const { data: blob } = await stock.download(fichiers.cheminMorceau(s.ws.id, jeton, i));
          if (!blob) return json({ error: "Envoi incomplet : renvoyez le fichier." }, 400);
          parties.push(new Uint8Array(await blob.arrayBuffer()));
        }
        parties.push(morceau);
        const octets = new Uint8Array(parties.reduce((n, p) => n + p.length, 0));
        parties.reduce((pos, p) => { octets.set(p, pos); return pos + p.length; }, 0);
        if (total > 1) await stock.remove(Array.from({ length: total - 1 }, (_, i) => fichiers.cheminMorceau(s.ws.id, jeton, i))).catch(() => undefined);
        if (octets.length > fichiers.TAILLE_MAX) return json({ error: `« ${nom} » dépasse ${fichiers.tailleLisible(fichiers.TAILLE_MAX)}.` }, 400);
        // Casier du contrat (contrats.ts) : total des fichiers déposés de l'espace.
        if (s.ws.stockage_go != null) {
          const { data: docs } = await sb.from("studio_documents").select("taille").eq("workspace_id", s.ws.id).eq("type", "fichier");
          const occupe = (docs ?? []).reduce((t, d) => t + (Number(d.taille) || 0), 0);
          if (occupe + octets.length > s.ws.stockage_go * 1e9) {
            return json({ error: `Votre casier de ${s.ws.stockage_go} Go est plein. Supprimez des fichiers ou ajoutez une armoire d'archives dans « Mon abonnement ».` }, 402);
          }
        }
        const mime = fichiers.mimeDe(nom, body.type as string);
        const chemin = fichiers.cheminFichier(s.ws.id, crypto.randomUUID(), nom);
        const { error: eStock } = await sb.storage.from("studio-medias").upload(chemin, octets, { contentType: mime, upsert: false });
        if (eStock) return json({ error: `Stockage : ${eStock.message}` }, 500);
        // Titre unique dans l'espace : c'est par lui que les agents désignent le fichier.
        const { data: memes } = await sb.from("studio_documents").select("titre").eq("workspace_id", s.ws.id).like("titre", `${nom.replace(/[%_\\]/g, "")}%`).limit(50);
        const pris = new Set((memes ?? []).map((x) => String(x.titre)));
        let titre = nom;
        for (let i = 2; pris.has(titre); i++) titre = nom.replace(/(\.[^.]+)?$/, ` (${i})$1`);
        const dossierAjout = (await dossiers.dossierDeLEspace(sb, s.ws.id, body.dossier_id)) || null;
        const { data, error } = await sb.from("studio_documents").insert({
          workspace_id: s.ws.id, titre, type: "fichier", format: (nom.split(".").pop() ?? "").slice(0, 10) || null, taille: octets.length,
          contenu: fichiers.contenuFichier({ nom: titre, chemin, mime, taille: octets.length }), created_by: s.user.id, dossier_id: dossierAjout,
        }).select("id").single();
        if (error || !data) {
          await sb.storage.from("studio-medias").remove([chemin]).catch(() => undefined);
          return json({ error: error?.message ?? "Enregistrement impossible" }, 400);
        }
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "fichier_depose", detail: { titre, taille: octets.length, mime } });
        return json({ ok: true, id: data.id, titre, piece: fichiers.textePiece(titre, octets.length, mime) });
      }

      case "rapport":
        return json({ rapport: await rapportEspace(sb, s.ws.id, body.mois) });

      // ── Gouvernance : périmètre, suspension, journal, livrables ──
      case "perimetre": {
        const [etat, depense, agents, { data: catalogue }, { data: w }, demandes, { data: medias }, credits] = await Promise.all([
          etatEspace(sb, s.ws.id), depenseJour(sb, s.ws.id), agentsDuWorkspace(sb, s.ws),
          sb.from("studio_agents").select("id, prenom, metier, photo, couleur").eq("actif", true).order("ordre"),
          sb.from("studio_workspaces").select("quota_images_mois, quota_videos_mois, max_utilisateurs").eq("id", s.ws.id).maybeSingle(),
          compterDemandesMois(sb, s.ws.id),
          sb.from("studio_medias").select("type").eq("workspace_id", s.ws.id).neq("statut", "echec").gte("created_at", debutMois()),
          recharges.etat(sb, s.ws.id),
        ]);
        const ouverts = new Set(agents.map((a) => a.id));
        return json({
          ...etat, offre: s.ws.offre, expire_le: s.ws.expire_le,
          budget_utilise_pct: etat.budget_ia_jour_eur ? Math.min(100, Math.round((depense / etat.budget_ia_jour_eur) * 100)) : null,
          agents: (catalogue ?? []).map((a) => ({ ...a, ouvert: ouverts.has(a.id), incluse: equipe.estOrchestrateur(a.id) })),
          quotas: {
            demandes: { utilise: demandes, max: s.ws.quota_messages_mois },
            images: { utilise: (medias ?? []).filter((m) => m.type === "image").length, max: w?.quota_images_mois ?? null },
            videos: { utilise: (medias ?? []).filter((m) => m.type === "video").length, max: w?.quota_videos_mois ?? null },
            utilisateurs: { max: w?.max_utilisateurs ?? null },
          },
          recharges: { ...credits, paiement_en_ligne: stripe.stripeConfigure() },
          abonnement: stripe.stripeConfigure() ? await etatAbonnement(sb, s.ws.id, equipe.nbFactures(agents)) : null,
        });
      }

      // ── Responsables de l'espace (responsables.ts) : la liste est visible de tous, la gestion réservée au propriétaire ──
      case "responsables": {
        return json({ ...(await responsables.lister(sb, s.ws.id)), proprietaire: s.user.role === "proprietaire", moi: s.user.id });
      }
      case "responsable_inviter":
      case "responsable_retirer":
      case "responsable_reactiver": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const par = [s.user.prenom, s.user.nom].filter(Boolean).join(" ") || s.user.email;
        const r = action === "responsable_inviter"
          ? await responsables.inviter(sb, {
            wsId: s.ws.id, nomEspace: String(s.ws.nom ?? ""), par, email: String(body.email ?? ""),
            prenom: body.prenom ? String(body.prenom).trim().slice(0, 80) : null, nom: body.nom ? String(body.nom).trim().slice(0, 80) : null,
            site: origineSure(req), motDePasse: motDePasseProvisoire(),
          })
          : action === "responsable_retirer"
            ? await responsables.retirer(sb, s.ws.id, String(body.id ?? ""), s.user.email)
            : await responsables.reactiver(sb, s.ws.id, String(body.id ?? ""), s.user.email);
        if ("erreur" in r) return json({ error: r.erreur }, r.statut);
        return json({ ...r, ...(await responsables.lister(sb, s.ws.id)) });
      }

      case "recharge_acheter": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        if (stripe.stripeConfigure()) {
          // Paiement en ligne : les crédits arrivent avec la confirmation de Stripe (webhook).
          const e = await recharges.etat(sb, s.ws.id);
          if (!e.achat_libre) return json({ error: "L'achat de recharges en ligne n'est pas ouvert pour cet espace. Contactez Aissociate." }, 403);
          const pack = e.packs[Number(body.pack)];
          if (!pack) return json({ error: "Recharge inconnue" }, 400);
          return json({ url: await stripe.sessionRecharge(sb, { wsId: s.ws.id, email: s.user.email, origine: origineSure(req), pack }) });
        }
        const r = await recharges.acheter(sb, s.ws.id, Number(body.pack), `client:${s.user.email}`);
        if ("erreur" in r) return json({ error: r.erreur }, r.statut);
        await journaliser(sb, {
          wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "recharge_achetee",
          detail: { credits: r.pack.credits, prix_ht: r.pack.prix },
        });
        return json({ ok: true, solde: await recharges.solde(sb, s.ws.id) });
      }

      case "abonnement_souscrire":
      case "abonnement_gerer":
      case "abonnement_resilier":
      case "abonnement_synchroniser": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        if (!stripe.stripeConfigure()) return json({ error: "Le paiement en ligne n'est pas encore ouvert. Contactez Aissociate." }, 503);
        const origine = origineSure(req);
        if (action === "abonnement_gerer") return json({ url: await stripe.sessionPortail(sb, { wsId: s.ws.id, email: s.user.email, origine }) });
        // Résiliation (fin de période payée) : portail Stripe ouvert sur l'étape de résiliation ; le webhook ramène l'espace au Stage.
        if (action === "abonnement_resilier") {
          const { data: w } = await sb.from("studio_workspaces").select("stripe_abonnement, abonnement_statut").eq("id", s.ws.id).single();
          if (!w?.stripe_abonnement || !stripe.STATUTS_EN_COURS.includes(String(w.abonnement_statut ?? ""))) return json({ error: "Aucun abonnement en cours à résilier." }, 400);
          await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "resiliation_ouverte", detail: {} });
          return json({ url: await stripe.sessionPortail(sb, { wsId: s.ws.id, email: s.user.email, origine, resilier: String(w.stripe_abonnement) }) });
        }
        // Nouvelles souscriptions : grille des contrats seulement (contrat_souscrire).
        if (action === "abonnement_souscrire") return json({ error: "Choisissez votre contrat dans « Mon abonnement »." }, 410);
        const [agents, conn] = await Promise.all([agentsDuWorkspace(sb, s.ws), facturationEspace(sb, s.ws.id)]);
        if (conn.erreur) return json({ error: "Vos connecteurs n'ont pas pu être vérifiés : réessayez dans un instant." }, 503);
        if (!equipe.nbFactures(agents)) return json({ error: "Ajoutez au moins un agent spécialiste à votre équipe avant de vous abonner (Léa, votre assistante, est incluse)." }, 400);
        if (action === "abonnement_synchroniser") {
          const a = await stripe.synchroniser(sb, s.ws.id, equipe.nbFactures(agents), conn.nb_factures, conn.tarif.prix);
          await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "abonnement_mis_a_jour", detail: { agents: a.agents, connecteurs: a.connecteurs, montant_ht: a.montant_ht } });
          return json({ ok: true });
        }
        const { data: w } = await sb.from("studio_workspaces").select("abonnement_statut").eq("id", s.ws.id).single();
        if (w?.abonnement_statut && stripe.STATUTS_EN_COURS.includes(String(w.abonnement_statut)) && w.abonnement_statut !== "incomplete") {
          return json({ error: "Un abonnement est déjà en place : gérez-le depuis « Gérer mon abonnement »." }, 409);
        }
        return json({ url: await stripe.sessionAbonnement(sb, { wsId: s.ws.id, email: s.user.email, origine, agents: equipe.nbFactures(agents), connecteurs: conn.nb_factures, prixConnecteur: conn.tarif.prix }) });
      }

      // Grille des contrats (page « Choisir mon contrat ») : souscription, changement, retour au Stage.
      case "contrat_souscrire": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const choix = contrats.normaliser(body.choix);
        const payant = contrats.bulletin(choix).payant;
        const { data: w } = await sb.from("studio_workspaces").select("abonnement_statut, stripe_abonnement").eq("id", s.ws.id).single();
        const enCours = Boolean(w?.stripe_abonnement && w.abonnement_statut && stripe.STATUTS_EN_COURS.includes(String(w.abonnement_statut)) && w.abonnement_statut !== "incomplete");
        const acteur = `client:${s.user.email}`;
        if (!payant) {
          if (enCours) return json({ error: "Pour revenir au Stage gratuit, résiliez depuis « Gérer mon abonnement » : vous y passerez à la fin de la période payée." }, 409);
          await stripe.appliquerContrat(sb, s.ws.id, choix);
          await sb.from("studio_workspaces").update({ essai_fin: null, offre: s.ws.offre === "essai" ? "essentiel" : s.ws.offre }).eq("id", s.ws.id);
          await journaliser(sb, { wsId: s.ws.id, acteur, action: "contrat_choisi", detail: { contrat: choix.contrat } });
          return json({ ok: true });
        }
        if (!stripe.stripeConfigure()) return json({ error: "Le paiement en ligne n'est pas encore ouvert. Contactez Aissociate." }, 503);
        if (enCours) {
          const a = await stripe.modifierContrat(sb, s.ws.id, choix);
          await journaliser(sb, { wsId: s.ws.id, acteur, action: "abonnement_mis_a_jour", detail: { contrat: choix, montant_ht: a.montant_ht } });
          return json({ ok: true });
        }
        return json({ url: await stripe.sessionContrat(sb, { wsId: s.ws.id, email: s.user.email, origine: origineSure(req), choix }) });
      }

      // Parcours d'intégration (490 € HT, finançable OPCO) : demande à Aissociate, sans paiement en ligne.
      case "integration_demander": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const contrat = contrats.contrat(String(body.contrat ?? s.ws.contrat ?? "stage"));
        const texte = [
          `Demande de parcours d'intégration (${contrats.INTEGRATION_HT} € HT, prise en charge OPCO possible).`,
          "", `Espace : ${s.ws.nom}`, `Demandeur : ${[s.user.prenom, s.user.nom].filter(Boolean).join(" ") || "—"} <${s.user.email}>`,
          `Contrat choisi : ${contrat.nom}`, "", "À faire : rappeler le client, proposer une date et monter le dossier OPCO.",
        ].join("\n");
        await courriel.envoyer(sb, {
          a: courriel.ADRESSE_STUDIO, objet: `Studio IA : parcours d'intégration demandé (${s.ws.nom})`, texte,
          html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${texte.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`,
        });
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "integration_demandee", detail: { contrat: contrat.id } });
        return json({ ok: true });
      }

      // Le propriétaire ouvre lui-même un agent de plus ; l'abonnement en cours suit (prorata).
      case "agent_ajouter": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const id = String(body.agent_id ?? "");
        const { data: a } = await sb.from("studio_agents").select("id, prenom, offres").eq("id", id).eq("actif", true).maybeSingle();
        const offre = s.ws.offre === "essai" ? "essentiel" : s.ws.offre;
        if (!a) return json({ error: "Agent introuvable" }, 404);
        if (!(a.offres as string[]).includes(offre)) return json({ error: "Cet agent n'est pas proposé dans votre formule. Écrivez à contact@aissociate.re." }, 403);
        const { error } = await sb.from("studio_workspace_agents").upsert({ workspace_id: s.ws.id, agent_id: id, actif: true }, { onConflict: "workspace_id,agent_id" });
        if (error) return json({ error: error.message }, 400);
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, agentId: id, action: "agent_ajoute", detail: { agent: a.prenom } });
        let abonnementMisAJour = false;
        if (stripe.stripeConfigure() && s.ws.abonnement_statut && s.ws.abonnement_statut !== "incomplete" && stripe.STATUTS_EN_COURS.includes(String(s.ws.abonnement_statut))) {
          try {
            const [agents, conn] = await Promise.all([agentsDuWorkspace(sb, s.ws), facturationEspace(sb, s.ws.id)]);
            if (!conn.erreur) {
              const ab = await stripe.synchroniser(sb, s.ws.id, equipe.nbFactures(agents), conn.nb_factures, conn.tarif.prix);
              await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "abonnement_mis_a_jour", detail: { agents: ab.agents, connecteurs: ab.connecteurs, montant_ht: ab.montant_ht } });
              abonnementMisAJour = true;
            }
          } catch (e) {
            // L'agent est ouvert ; « Mon périmètre » signale l'écart et propose de mettre l'abonnement à jour.
            console.error("[studio] abonnement après ajout d'agent :", e instanceof Error ? e.message : String(e));
          }
        }
        return json({ ok: true, abonnement_mis_a_jour: abonnementMisAJour });
      }

      case "suspendre": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const r = await suspendre(sb, s.ws.id, body.suspendu === true, `client:${s.user.email}`);
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        return json({ ok: true, ...(await etatEspace(sb, s.ws.id)) });
      }

      case "taches":
        return json(await listerTaches(sb, s.ws.id));

      // ── Veille ──
      case "flux":
        return json(await etatVeille(sb, s.ws.id));
      case "flux_ajouter": {
        const r = await veille.ajouterFlux(sb, s.ws.id, body.url);
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), agentId: null, action: "flux_ajoute", detail: { titre: r.titre } });
        return json(await etatVeille(sb, s.ws.id));
      }
      case "flux_basculer":
        await sb.from("studio_flux").update({ actif: body.actif === true }).eq("id", String(body.id ?? "")).eq("workspace_id", s.ws.id);
        return json(await etatVeille(sb, s.ws.id));
      case "flux_supprimer":
        await sb.from("studio_flux").delete().eq("id", String(body.id ?? "")).eq("workspace_id", s.ws.id);
        return json(await etatVeille(sb, s.ws.id));
      case "flux_actualiser":
        await veille.actualiserFlux(sb, s.ws.id, true);
        return json(await etatVeille(sb, s.ws.id));

      // ── Contacts ──
      case "contacts":
        return json(await etatContacts(sb, s.ws.id, body.recherche));
      case "contact_ajouter":
      case "contacts_importer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        if (body.consentement !== true) return json({ error: "Confirmez que ces personnes ont accepté de recevoir vos e-mails." }, 400);
        const lignes = action === "contact_ajouter" ? [body] : body.lignes;
        const { contacts, rejets } = mailing.contactsValides(lignes);
        if (!contacts.length) return json({ error: "Aucune adresse e-mail valide." }, 400);
        const { count } = await sb.from("studio_contacts").select("id", { count: "exact", head: true }).eq("workspace_id", s.ws.id);
        if ((count ?? 0) + contacts.length > 20_000) return json({ error: "20 000 contacts au maximum par espace." }, 400);
        const listes = mailing.nettoyerListes(body.listes);
        // Contacts déjà présents : listes fusionnées, désinscription conservée.
        const { data: existants } = await sb.from("studio_contacts").select("id, email, listes")
          .eq("workspace_id", s.ws.id).in("email", contacts.map((c) => c.email));
        const parEmail = new Map((existants ?? []).map((e) => [String(e.email), e]));
        const nouveaux = contacts.filter((c) => !parEmail.has(c.email));
        for (let i = 0; i < nouveaux.length; i += 1000) {
          const { error } = await sb.from("studio_contacts").insert(nouveaux.slice(i, i + 1000).map((c) => ({
            ...c, workspace_id: s.ws.id, listes, source: action === "contact_ajouter" ? "saisie" : "import",
          })));
          if (error) return json({ error: error.message }, 400);
        }
        if (listes.length) {
          for (const e of existants ?? []) {
            const fusion = [...new Set([...((e.listes as string[]) ?? []), ...listes])];
            if (fusion.length !== ((e.listes as string[]) ?? []).length) await sb.from("studio_contacts").update({ listes: fusion }).eq("id", e.id);
          }
        }
        await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), agentId: null, action: "contacts_importes", detail: { ajoutes: nouveaux.length, deja_presents: contacts.length - nouveaux.length, rejets, listes } });
        return json({ ...(await etatContacts(sb, s.ws.id, "")), import: { ajoutes: nouveaux.length, deja_presents: contacts.length - nouveaux.length, rejets } });
      }
      case "contact_supprimer":
      case "contact_desinscrire": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const id = String(body.id ?? "");
        if (action === "contact_supprimer") await sb.from("studio_contacts").delete().eq("id", id).eq("workspace_id", s.ws.id);
        else {
          await sb.from("studio_contacts").update({ desinscrit_le: new Date().toISOString() }).eq("id", id).eq("workspace_id", s.ws.id);
          await sb.from("studio_envois").update({ statut: "ignore" }).eq("contact_id", id).eq("statut", "a_envoyer");
        }
        return json(await etatContacts(sb, s.ws.id, body.recherche));
      }

      case "tache_enregistrer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const r = await enregistrerTache(sb, s, body);
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        return json(await listerTaches(sb, s.ws.id));
      }

      case "tache_supprimer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const { data: t } = await sb.from("studio_taches").delete().eq("id", String(body.id ?? "")).eq("workspace_id", s.ws.id).select("titre, agent_id").maybeSingle();
        if (t) await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), agentId: String(t.agent_id), action: "tache_supprimee", detail: { titre: t.titre } });
        return json(await listerTaches(sb, s.ws.id));
      }

      case "tache_lancer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const { data: t } = await sb.from("studio_taches").select("id").eq("id", String(body.id ?? "")).eq("workspace_id", s.ws.id).maybeSingle();
        const cle = await cleCron(sb);
        if (!t || !cle) return json({ error: "Tâche introuvable ou planification non installée." }, 404);
        await declencherTache(cle, String(t.id));
        return json(await listerTaches(sb, s.ws.id));
      }

      // ── Routines (refonte §3.4, §3.5) ──
      case "routines":
        return json(await listerRoutines(sb, s.ws.id));

      case "routine_modeles":
        return json(await galerieRoutines(sb, s));

      case "routine_regler":
      case "routine_essayer":
      case "routine_activer":
      case "routine_supprimer":
      case "routine_proposer":
      case "routine_creer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        if (action === "routine_proposer") {
          const r = await proposerRoutine(sb, s, String(body.demande ?? ""));
          return "erreur" in r ? json({ error: r.erreur }, 400) : json(r);
        }
        if (action === "routine_creer") {
          const r = await creerRoutine(sb, s, body);
          if ("erreur" in r) return json({ error: r.erreur }, r.statut ?? 400);
          return json({ id: r.id, ...(await listerRoutines(sb, s.ws.id)) });
        }
        const id = String(body.id ?? "");
        if (action === "routine_regler") {
          const r = await reglerRoutine(sb, s, body);
          if ("erreur" in r) return json({ error: r.erreur }, 400);
        } else if (action === "routine_essayer") {
          // « Essayer sur un vrai cas » : un passage immédiat à blanc, rien n'est envoyé.
          const t = await lireRoutine(sb, s.ws.id, id);
          const cle = await cleCron(sb);
          if (!t || !cle) return json({ error: "Routine introuvable ou planification non installée." }, 404);
          await declencherTache(cle, id, { essai: true, manuel: true });
          await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), agentId: String(t.agent_id), action: "routine_essayee", detail: { tache: id, titre: t.titre } });
        } else if (action === "routine_activer") {
          const { data: t, error } = await sb.from("studio_taches").update({ essai_jusqu_au: null, essai_signale: true })
            .eq("id", id).eq("workspace_id", s.ws.id).select("titre, agent_id").maybeSingle();
          if (error || !t) return json({ error: error?.message ?? "Routine introuvable." }, 404);
          await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), agentId: String(t.agent_id), action: "routine_mise_en_route", detail: { tache: id, titre: t.titre } });
        } else {
          const { data: t } = await sb.from("studio_taches").delete().eq("id", id).eq("workspace_id", s.ws.id).select("titre, agent_id").maybeSingle();
          if (t) await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), agentId: String(t.agent_id), action: "tache_supprimee", detail: { titre: t.titre } });
        }
        return json(await listerRoutines(sb, s.ws.id));
      }

      case "journal":
        return json({ lignes: await lireJournal(sb, s.ws.id) });

      // ── Calendrier par défaut (calendrier.ts) : rappels, passages des routines, publications programmées ──
      case "calendrier": {
        const { debut, fin } = calendrier.bornes(body.du, body.au);
        const [evenements, boites] = await Promise.all([
          calendrier.lireCalendrier(sb, s.ws.id, debut, fin),
          zernio.zernioConfigure() ? bureau.boitesEspace(s.ws.id).catch(() => [] as bureau.Boite[]) : Promise.resolve([] as bureau.Boite[]),
        ]);
        const agenda = bureau.boitePour(boites, "calendar");
        return json({
          du: debut.toISOString(), au: fin.toISOString(), evenements,
          agenda: agenda ? { nom: agenda.adresse || bureau.NOMS_FOURNISSEURS[agenda.fournisseur], a_reconnecter: agenda.a_reconnecter } : null,
        });
      }

      case "rappel_creer": {
        const r = await calendrier.creerRappel(sb, { wsId: s.ws.id, titre: body.titre, quand: body.quand, note: body.note, creePar: acteurDe(s) });
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), action: "rappel_programme", detail: { titre: r.titre, quand: r.quand.toISOString() } });
        return json({ ok: true, id: r.id });
      }

      case "rappel_fait": {
        const { error } = await sb.from("studio_rappels").update({ fait_le: body.fait ? new Date().toISOString() : null })
          .eq("workspace_id", s.ws.id).eq("id", String(body.id ?? ""));
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "rappel_supprimer": {
        const { data: r } = await sb.from("studio_rappels").delete().eq("workspace_id", s.ws.id).eq("id", String(body.id ?? "")).select("titre").maybeSingle();
        if (r) await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), action: "rappel_supprime", detail: { titre: r.titre } });
        return json({ ok: true });
      }

      // ── « Mon équipe » : état de chaque agent et comptes branchés de l'espace ──
      case "equipe": {
        const [{ data: aValider }, { data: enRedaction }, { data: routines }, connexions] = await Promise.all([
          sb.from("studio_livrables").select("agent_id").eq("workspace_id", s.ws.id).eq("statut", "a_valider").limit(500),
          sb.from("studio_conversations").select("agent_id, generation_depuis").eq("workspace_id", s.ws.id).not("generation_depuis", "is", null).limit(100),
          sb.from("studio_taches").select("agent_id, en_cours_depuis").eq("workspace_id", s.ws.id).not("en_cours_depuis", "is", null).limit(50),
          connecteursActifs(sb, s.ws.id).catch(() => [] as Awaited<ReturnType<typeof connecteursActifs>>),
        ]);
        return json({
          etats: etatsAgents(aValider ?? [], enRedaction ?? [], routines ?? []),
          connexions: [...new Set(connexions.map((c) => c.libelle))].slice(0, 12),
        });
      }

      // ── Écran « Aujourd'hui » : décisions en attente, fait cette semaine, à venir ──
      case "aujourdhui": {
        const depuis = new Date(Date.now() - 7 * 86_400_000).toISOString();
        const [livrables, { data: journal }, { data: reponses }, { data: taches }, agents] = await Promise.all([
          listerLivrables(sb, s.ws.id),
          sb.from("studio_journal").select("agent_id, action").eq("workspace_id", s.ws.id).gte("created_at", depuis).limit(5000),
          // Même règle que le temps gagné du mois (construireMe) : réponses utiles, hors relais.
          sb.from("studio_messages").select("agent_id").eq("workspace_id", s.ws.id).eq("role", "assistant")
            .or("retour.is.null,retour.eq.1").not("content", "like", "%[[RELAIS:%").gte("created_at", depuis).limit(5000),
          sb.from("studio_taches").select("titre, agent_id, prochaine_execution").eq("workspace_id", s.ws.id).eq("actif", true)
            .order("prochaine_execution").limit(10),
          agentsDuWorkspace(sb, s.ws),
        ]);
        const minutes = new Map(agents.map((a) => [a.id, a.minutes_par_tache as number]));
        const tous = livrables as unknown as { statut: string; titre: string; agent_id: string | null; action?: unknown }[];
        return json({
          decisions: tous.filter((l) => l.statut === "a_valider"),
          faits: faitsSemaine((journal ?? []) as LigneFait[]),
          minutes_semaine: (reponses ?? []).reduce((t, r) => t + (minutes.get(String(r.agent_id)) ?? 15), 0),
          a_venir: aVenir(taches ?? [], tous, new Date()),
        });
      }

      case "liaison":
        return json(await etatLiaison(sb, s.ws.id, s.user.role === "proprietaire"));

      case "livrables":
        return json({ livrables: await listerLivrables(sb, s.ws.id) });

      case "livrable_soumettre": {
        const r = await soumettreLivrable(sb, s.ws.id, `client:${s.user.email}`, String(body.message_id ?? ""));
        return "erreur" in r ? json({ error: r.erreur }, r.statut) : json(r);
      }

      case "livrable_decider": {
        if (s.user.role !== "proprietaire") return json({ error: "Seul le propriétaire de l'espace valide les livrables." }, 403);
        const r = await deciderLivrable(sb, s.ws.id, { acteur: `client:${s.user.email}`, proprietaire: true }, body);
        return "erreur" in r ? json({ error: r.erreur }, r.statut) : json({ ...r, ok: true, livrables: await listerLivrables(sb, s.ws.id) });
      }

      case "livrable_modifier": {
        // Tout membre de l'espace peut corriger ; le livrable repasse « à valider » par le propriétaire.
        const r = await modifierLivrable(sb, s.ws.id, `client:${s.user.email}`, body);
        return "erreur" in r ? json({ error: r.erreur }, r.statut) : json({ ...r, ok: true, livrables: await listerLivrables(sb, s.ws.id) });
      }

      // ── Papier à en-tête (exports Word / PDF) ──
      case "entete": {
        const { data, error } = await sb.from("studio_workspaces").select("entete, logo_chemin").eq("id", s.ws.id).single();
        // Migration non appliquée : exports sans en-tête plutôt qu'une erreur.
        if (error) return json({ entete: {}, logo_url: null, disponible: false });
        return json({
          entete: data.entete ?? {}, disponible: true,
          logo_url: data.logo_chemin ? await urlSignee(sb, data.logo_chemin) : null,
        });
      }

      case "entete_update": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const brut = (body.entete ?? {}) as Record<string, unknown>;
        const entete: Record<string, string> = {};
        for (const [k, max] of [["raison_sociale", 200], ["adresse", 300], ["code_postal", 20], ["ville", 120], ["telephone", 40],
          ["email", 200], ["site", 200], ["siret", 40], ["mentions", 600]] as const) {
          const v = String(brut[k] ?? "").trim().slice(0, max);
          if (v) entete[k] = v;
        }
        const { error } = await sb.from("studio_workspaces").update({ entete }).eq("id", s.ws.id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, entete });
      }

      case "entete_logo": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const { data: w } = await sb.from("studio_workspaces").select("logo_chemin").eq("id", s.ws.id).single();
        const ancien = w?.logo_chemin as string | null | undefined;
        if (body.supprimer === true) {
          if (ancien) await sb.storage.from("studio-medias").remove([ancien]);
          await sb.from("studio_workspaces").update({ logo_chemin: null }).eq("id", s.ws.id);
          return json({ ok: true, logo_url: null });
        }
        // PNG, JPEG ou WebP uniquement (pas de SVG : il peut embarquer du script).
        const types: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
        const ext = types[String(body.type ?? "")];
        if (!ext) return json({ error: "Logo au format PNG, JPEG ou WebP uniquement." }, 400);
        let octets: Uint8Array;
        try { octets = Uint8Array.from(atob(String(body.fichier ?? "")), (c) => c.charCodeAt(0)); }
        catch { return json({ error: "Fichier illisible." }, 400); }
        if (!octets.length || octets.length > 500_000) return json({ error: "Logo de 500 Ko maximum." }, 400);
        const chemin = `${s.ws.id}/logo-${Date.now()}.${ext}`;
        const { error } = await sb.storage.from("studio-medias").upload(chemin, octets, { contentType: String(body.type), upsert: true });
        if (error) return json({ error: `Stockage : ${error.message}` }, 500);
        await sb.from("studio_workspaces").update({ logo_chemin: chemin }).eq("id", s.ws.id);
        // L'ancien logo n'est retiré qu'une fois le nouveau en place.
        if (ancien) await sb.storage.from("studio-medias").remove([ancien]);
        return json({ ok: true, logo_url: await urlSignee(sb, chemin) });
      }

      case "contexte_update": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        await sb.from("studio_workspaces").update({ contexte_entreprise: String(body.contexte_entreprise ?? "").slice(0, 20000) })
          .eq("id", s.ws.id);
        await journaliser(sb, { wsId: s.ws.id, acteur: `client:${s.user.email}`, action: "fiche_entreprise_modifiee" });
        return json({ ok: true });
      }

      default:
        return json({ error: "Action inconnue" }, 400);
    }
  } catch (err) {
    console.error("[studio]", err instanceof Error ? err.message : String(err));
    return json({ error: "Erreur interne" }, 500);
  }
});

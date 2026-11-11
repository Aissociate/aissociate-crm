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
//   conversations {agent_id?} | messages {conversation_id} | conversation_delete {conversation_id}
//   chat {agent_id, message, conversation_id?}    → flux SSE (meta, delta, done, error)
//   retour {message_id, valeur: 1|-1|0} | epingler {message_id, epingle} | creations
//   chat avec un super-pouvoir « media » → JSON {media:{id,…}} (image ou vidéo, voir medias.ts)
//   media_statut {id} | medias (galerie des visuels et vidéos prêts)
//   entete | entete_update {entete} | entete_logo {fichier base64, type} ou {supprimer:true}   (papier à en-tête)
//   connecteurs | connecteur_enregistrer {type, infos, secret?, accord} | connecteur_supprimer {type}
//   ressources | ressource_add {titre, contenu, type, format?, taille?}
//   ressource_toggle {id, actif} | ressource_delete {id}
//   contexte_update {contexte_entreprise}          (propriétaire)
// Administration (JWT CRM d'un manager dans Authorization) :
//   admin_create_user {workspace_id, email, prenom?, nom?, role?, password}
//   admin_set_password {user_id, password}
//   admin_modeles                                   → catalogue OpenRouter trié par constructeur
//
// ⚠ En-têtes HTTP sortants : ASCII uniquement (ByteString), cf. Edge Function agent.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import {
  calculFactice, hasherMotDePasse, motDePasseValide, nouveauJeton, sha256, verifierMotDePasse,
} from "./securite.ts";
import { lancerMedia, quotaMediaAtteint, statutMedia, urlSignee } from "./medias.ts";
import {
  construirePrompt, selectionnerRessources, HARNESS_PERIMETRE_DEFAUT, HARNESS_REGLES_DEFAUT,
  BUDGET_SAVOIRS, type AgentPrompt, type Champ, type Creation, type Harness, type Savoir, type SuperPouvoir,
} from "./contexte.ts";
import { connecteursActifs, enregistrerConnecteur, listerConnecteurs } from "./connecteurs.ts";

/**
 * Base de connaissances de l'agent (studio_agent_savoirs, éditée dans le CRM) :
 * passages trouvés par la recherche plein texte, complétés par les plus récents.
 * Table absente (migration non appliquée) → aucune base, sans erreur.
 */
async function chargerSavoirs(sb: SupabaseClient, agentId: string, question: string): Promise<Savoir[]> {
  const [{ data: trouves }, { data: recents }] = await Promise.all([
    sb.rpc("studio_recherche_savoirs", { p_agent: agentId, p_question: question.slice(0, 500), p_limite: 3 }),
    sb.from("studio_agent_savoirs").select("titre, source, contenu")
      .eq("agent_id", agentId).eq("actif", true).order("updated_at", { ascending: false }).limit(6),
  ]);
  return selectionnerRessources<Savoir>(
    ((trouves ?? []) as Savoir[]).map((t) => ({ titre: t.titre, source: t.source, extrait: t.extrait })),
    (recents ?? []).map((d) => ({ titre: String(d.titre), source: d.source as string | null, extrait: String(d.contenu).slice(0, 3000) })),
    BUDGET_SAVOIRS,
  );
}

/** Harness général édité dans le CRM (studio_config) ; vide = texte par défaut de contexte.ts. */
async function chargerHarness(sb: SupabaseClient): Promise<Harness> {
  const { data } = await sb.from("studio_config").select("cle, valeur").in("cle", ["harness_regles", "harness_perimetre"]);
  const v = new Map((data ?? []).map((r) => [r.cle, String(r.valeur ?? "")]));
  return { regles: v.get("harness_regles") || null, perimetre: v.get("harness_perimetre") || null };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SESSION_JOURS = 30;
const ECHECS_MAX = 5;          // tentatives ratées…
const ECHECS_FENETRE_MIN = 15; // …par e-mail sur cette fenêtre
const HISTORIQUE = 12;

// Modèles autorisés pour les agents du Studio (choix de la direction, 2026-11-11).
// Le premier est le modèle de base. Tout autre réglage en base est ignoré.
// (meta/muse-image et minimax/hailuo-3-max ont été écartés : ils génèrent des
// images et des vidéos, pas du texte, et passent par d'autres routes OpenRouter.)
const MODELES_STUDIO = [
  "deepseek/deepseek-v4.1-flash-1017",
  "mistralai/mistral-large-4-0",
  "anthropic/claude-haiku-5.5",
];
const MODELE_DEFAUT = MODELES_STUDIO[0];
const autorise = (m: string | null | undefined): string | null => (m && MODELES_STUDIO.includes(m) ? m : null);
const DOC_MAX = 200_000;

type Session = {
  sessionId: string;
  user: { id: string; email: string; prenom: string | null; nom: string | null; role: string };
  ws: {
    id: string; nom: string; offre: string; quota_messages_mois: number | null;
    contexte_entreprise: string; expire_le: string | null;
    /** Modèle imposé à tous les agents de ce client (null = hérité). */
    modele: string | null;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

async function chargerSession(sb: SupabaseClient, token: unknown): Promise<Session | null> {
  if (typeof token !== "string" || token.length !== 64) return null;
  const { data: s } = await sb.from("studio_sessions")
    .select("id, expires_at, studio_users!inner(id, email, prenom, nom, role, actif, studio_workspaces!inner(id, nom, offre, quota_messages_mois, contexte_entreprise, expire_le, actif, modele))")
    .eq("token_hash", await sha256(token)).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) return null;
  const u = s.studio_users as unknown as Record<string, unknown> & { studio_workspaces: Record<string, unknown> };
  const w = u.studio_workspaces;
  if (!u.actif || !w.actif) return null;
  if (w.expire_le && String(w.expire_le) < new Date().toISOString().slice(0, 10)) return null;
  // Trace d'activité, sans bloquer la réponse.
  sb.from("studio_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", s.id).then(() => {});
  return {
    sessionId: s.id,
    user: { id: String(u.id), email: String(u.email), prenom: u.prenom as string | null, nom: u.nom as string | null, role: String(u.role) },
    ws: {
      id: String(w.id), nom: String(w.nom), offre: String(w.offre),
      quota_messages_mois: w.quota_messages_mois as number | null,
      contexte_entreprise: String(w.contexte_entreprise ?? ""), expire_le: w.expire_le as string | null,
      modele: (w.modele as string | null) || null,
    },
  };
}

/** Agents accessibles à l'espace : actifs au catalogue, inclus dans l'offre, non désactivés pour l'espace. */
async function agentsDuWorkspace(sb: SupabaseClient, ws: Session["ws"]) {
  const [{ data: agents }, { data: reglages }] = await Promise.all([
    sb.from("studio_agents").select("id, prenom, metier, accroche, description, prompt_systeme, demandes, super_pouvoirs, minutes_par_tache, couleur, offres, ordre, modele, photo")
      .eq("actif", true).order("ordre"),
    sb.from("studio_workspace_agents").select("agent_id, actif, consignes, modele").eq("workspace_id", ws.id),
  ]);
  const parAgent = new Map((reglages ?? []).map((r) => [r.agent_id, r]));
  return (agents ?? [])
    .filter((a) => (a.offres as string[]).includes(ws.offre) && parAgent.get(a.id)?.actif !== false)
    .map((a) => ({
      ...a,
      consignes: parAgent.get(a.id)?.consignes ?? "",
      // Priorité : cet agent pour ce client > ce client > cet agent (le défaut global vient de `parametres`).
      modele_effectif: autorise(parAgent.get(a.id)?.modele) ?? autorise(ws.modele) ?? autorise(a.modele as string | null),
    }));
}

function debutMois(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function compterDemandesMois(sb: SupabaseClient, wsId: string): Promise<number> {
  const { count } = await sb.from("studio_messages").select("id", { count: "exact", head: true })
    .eq("workspace_id", wsId).eq("role", "user").gte("created_at", debutMois());
  return count ?? 0;
}

async function construireMe(sb: SupabaseClient, s: Session) {
  const agents = await agentsDuWorkspace(sb, s.ws);
  const minutesParAgent = new Map(agents.map((a) => [a.id, a.minutes_par_tache as number]));
  const [demandesMois, { data: reponses }, { data: credentials }, { data: conversations }, { count: nbRessources }] = await Promise.all([
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
  ]);
  const mois = debutMois();
  let minutesTotal = 0, minutesMois = 0, reponsesMois = 0;
  for (const r of reponses ?? []) {
    const m = minutesParAgent.get(String(r.agent_id)) ?? 15;
    minutesTotal += m;
    if (String(r.created_at) >= mois) { minutesMois += m; reponsesMois++; }
  }
  return {
    user: { ...s.user, doit_changer: credentials?.doit_changer ?? false },
    workspace: s.ws,
    // Le gabarit (consigne détaillée) des super-pouvoirs reste côté serveur.
    agents: agents.map(({ prompt_systeme: _p, offres: _o, consignes: _c, modele: _m, modele_effectif: _me, super_pouvoirs, ...a }) => ({
      ...a,
      super_pouvoirs: ((super_pouvoirs ?? []) as SuperPouvoir[]).map(({ gabarit: _g, ...sp }) => sp),
    })),
    stats: {
      demandes_mois: demandesMois, quota_mois: s.ws.quota_messages_mois,
      reponses_mois: reponsesMois, minutes_gagnees_mois: minutesMois, minutes_gagnees_total: minutesTotal,
      ressources_actives: nbRessources ?? 0,
    },
    conversations: conversations ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat (SSE) — proxy du flux OpenRouter, enregistrement en fin de réponse
// ─────────────────────────────────────────────────────────────────────────────

async function chat(sb: SupabaseClient, s: Session, body: Record<string, unknown>): Promise<Response> {
  const agents = (await agentsDuWorkspace(sb, s.ws)) as unknown as AgentPrompt[];
  const agent = agents.find((a) => a.id === body.agent_id);
  if (!agent) return json({ error: "Agent indisponible pour votre offre" }, 403);

  // Deux entrées : un super-pouvoir (formulaire cadré, consigne rendue côté
  // serveur) ou une demande libre (soumise à la règle de périmètre).
  let question: string;      // envoyé au modèle
  let affichage: string;     // conservé dans l'historique
  let titreConv: string;
  let media: { type: "image" | "video"; format?: string; duree?: string } | null = null;
  const pouvoir = body.pouvoir as { id?: string; valeurs?: Record<string, unknown> } | undefined;
  if (pouvoir?.id) {
    const sp = (agent.super_pouvoirs ?? []).find((p) => p.id === pouvoir.id);
    if (!sp) return json({ error: "Super-pouvoir inconnu" }, 400);
    const v = pouvoir.valeurs ?? {};
    const val = (c: Champ) => {
      const x = String(v[c.nom] ?? "").trim().slice(0, c.type === "long" ? 12000 : 500);
      return c.type === "choix" && c.options?.length && !c.options.includes(x) ? "" : x;
    };
    const manquant = sp.champs.find((c) => c.requis && !val(c));
    if (manquant) return json({ error: `Champ requis : ${manquant.label}` }, 400);
    question = sp.gabarit.replace(/\{\{(\w+)\}\}/g, (_m, nom: string) => {
      const c = sp.champs.find((x) => x.nom === nom);
      return (c && val(c)) || "(non précisé)";
    });
    affichage = `**${sp.titre}**\n` + sp.champs.filter((c) => val(c))
      .map((c) => `- ${c.label} : ${val(c).length > 300 ? val(c).slice(0, 300) + "…" : val(c)}`).join("\n");
    titreConv = `${sp.titre} — ${val(sp.champs[0]) || ""}`.slice(0, 80);
    if (sp.media === "image" || sp.media === "video") {
      const champ = (nom: string) => { const c = sp.champs.find((x) => x.nom === nom); return c ? val(c) : undefined; };
      media = { type: sp.media, format: champ("format"), duree: champ("duree") };
    }
  } else {
    question = String(body.message ?? "").trim().slice(0, 8000);
    if (!question) return json({ error: "Message vide" }, 400);
    affichage = question;
    titreConv = question.slice(0, 80);
  }

  const quota = s.ws.quota_messages_mois;
  if (quota != null && (await compterDemandesMois(sb, s.ws.id)) >= quota) {
    return json({ error: `Quota mensuel atteint (${quota} demandes). Contactez Aissociate pour l'augmenter.` }, 429);
  }

  const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
  const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
  const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
  if (!apiKey) return json({ error: "Service IA non configuré. Contactez Aissociate." }, 503);
  // Modèle : réglage agent/client (studio_*), puis parametres.ai.model_studio s'il est autorisé, puis DeepSeek.
  const model = agent.modele_effectif ?? autorise(ai.model_studio) ?? MODELE_DEFAUT;

  // Conversation : reprise (appartenance vérifiée) ou création.
  let conversationId = typeof body.conversation_id === "string" ? body.conversation_id : null;
  if (conversationId) {
    const { data: c } = await sb.from("studio_conversations").select("id, agent_id")
      .eq("id", conversationId).eq("workspace_id", s.ws.id).eq("user_id", s.user.id).maybeSingle();
    if (!c || c.agent_id !== agent.id) conversationId = null;
  }
  if (!conversationId) {
    const { data: c, error } = await sb.from("studio_conversations").insert({
      workspace_id: s.ws.id, user_id: s.user.id, agent_id: agent.id, titre: titreConv,
    }).select("id").single();
    if (error) return json({ error: error.message }, 500);
    conversationId = c.id;
  } else {
    await sb.from("studio_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  }

  // ── Super-pouvoir média : génération d'image ou de vidéo, sans passer par le chat ──
  if (media) {
    const depasse = await quotaMediaAtteint(sb, s.ws, media.type);
    if (depasse) return json({ error: depasse }, 429);
    const lance = await lancerMedia(sb, apiKey, {
      wsId: s.ws.id, userId: s.user.id, agentId: agent.id, conversationId: conversationId as string,
      type: media.type, prompt: question, format: media.format, duree: media.duree,
    });
    if ("erreur" in lance) return json({ error: lance.erreur }, 502);
    await sb.from("studio_messages").insert({
      conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "user", content: affichage,
    });
    const { data: rep } = await sb.from("studio_messages").insert({
      conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "assistant", media_id: lance.id,
      content: media.type === "image" ? "Voici votre visuel." : "Voici votre vidéo.",
    }).select("id, content").single();
    return json({
      conversation_id: conversationId, message_id: rep?.id ?? null, content: rep?.content ?? "",
      media: { id: lance.id, type: media.type, statut: "en_cours" },
    });
  }

  // Contexte : historique, ressources (pertinentes + récentes), contenus gardés, outils connectés, harness.
  const [{ data: past }, { data: trouves }, { data: recents }, { data: gardes }, connecteurs, harness] = await Promise.all([
    sb.from("studio_messages").select("role, content").eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(HISTORIQUE),
    sb.rpc("studio_recherche_docs", { p_workspace: s.ws.id, p_question: question.slice(0, 500), p_limite: 4 }),
    sb.from("studio_documents").select("titre, contenu")
      .eq("workspace_id", s.ws.id).eq("actif", true).order("created_at", { ascending: false }).limit(8),
    sb.from("studio_messages").select("content, created_at, agent_id, studio_conversations!inner(titre)")
      .eq("workspace_id", s.ws.id).eq("epingle", true).is("media_id", null)
      .order("created_at", { ascending: false }).limit(6),
    connecteursActifs(sb, s.ws.id),
    chargerHarness(sb),
  ]);
  const ressources = selectionnerRessources(
    (trouves ?? []) as { titre: string; extrait: string }[],
    (recents ?? []).map((d) => ({ titre: d.titre, extrait: String(d.contenu).slice(0, 4000) })),
  );
  const savoirs = await chargerSavoirs(sb, agent.id, question);
  const prenoms = new Map(agents.map((a) => [a.id, a.prenom]));
  const creations: Creation[] = (gardes ?? []).map((m) => ({
    titre: (m.studio_conversations as unknown as { titre: string }).titre,
    contenu: String(m.content), date: String(m.created_at).slice(0, 10),
    agent: prenoms.get(String(m.agent_id)),
  }));

  await sb.from("studio_messages").insert({
    conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "user", content: affichage,
  });

  const systeme = construirePrompt({
    agent, equipe: agents, ws: s.ws, ressources, creations, connecteurs, harness, savoirs,
    aujourdhui: new Date().toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion", weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  });
  const messages = [
    { role: "system", content: systeme },
    ...(past ?? []).reverse().map((m) => ({ role: m.role, content: String(m.content).slice(0, 6000) })),
    { role: "user", content: question },
  ];

  const encoder = new TextEncoder();
  const stop = new AbortController();
  const stream = new ReadableStream({
    cancel() { stop.abort(); },
    async start(controller) {
      const emit = (event: string, payload: unknown) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)); } catch { /* fermé */ }
      };
      let answer = "";
      try {
        emit("meta", {
          conversation_id: conversationId,
          ressources: ressources.map((r) => r.titre),
          // Base de l'agent : titres et références seulement, le contenu reste côté serveur.
          savoirs: savoirs.map((x) => ({ titre: x.titre, source: x.source ?? null })),
        });
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST", signal: stop.signal,
          headers: {
            "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json",
            "HTTP-Referer": "https://aissociate.re", "X-Title": "Aissociate Studio IA",
          },
          body: JSON.stringify({ model, messages, stream: true, temperature: 0.5 }),
        });
        if (!resp.ok || !resp.body) throw new Error(`Service IA indisponible (${resp.status})`);
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lignes = buf.split("\n");
          buf = lignes.pop() ?? "";
          for (const l of lignes) {
            const t = l.trim();
            if (!t.startsWith("data:")) continue; // commentaires « : OPENROUTER PROCESSING »
            const data = t.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const j = JSON.parse(data);
              if (j.error) throw new Error(String(j.error.message ?? "Erreur du service IA"));
              // Seul `content` est relayé : le raisonnement éventuel (delta.reasoning) reste interne.
              const delta = j.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) { answer += delta; emit("delta", { text: delta }); }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
        if (!answer.trim()) answer = "Je n'ai pas pu produire de réponse. Pouvez-vous reformuler ?";
        const { data: row } = await sb.from("studio_messages").insert({
          conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "assistant", content: answer,
        }).select("id").single();
        emit("done", { message_id: row?.id ?? null, conversation_id: conversationId });
      } catch (err) {
        if (stop.signal.aborted) {
          if (answer.trim()) {
            await sb.from("studio_messages").insert({
              conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "assistant",
              content: `${answer}\n\n_(réponse interrompue)_`,
            });
          }
        } else {
          console.error("[studio] chat:", err instanceof Error ? err.message : String(err));
          emit("error", { message: err instanceof Error ? err.message : String(err) });
        }
      } finally {
        try { controller.close(); } catch { /* déjà fermé */ }
      }
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Administration (depuis le CRM, manager connecté)
// ─────────────────────────────────────────────────────────────────────────────

async function estManager(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: u } = await db.auth.getUser();
  if (!u?.user) return false;
  const { data } = await db.rpc("is_manager");
  return data === true;
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

async function admin(sb: SupabaseClient, action: string, body: Record<string, unknown>): Promise<Response> {
  if (action === "admin_modeles") return await listerModeles(sb);
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
    const { count } = await sb.from("studio_users").select("id", { count: "exact", head: true }).eq("workspace_id", String(body.workspace_id));
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
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    // ── Administration CRM ──
    if (["admin_create_user", "admin_set_password", "admin_modeles", "admin_harness_defaut"].includes(action)) {
      if (!(await estManager(req))) return json({ error: "Réservé aux managers du CRM" }, 403);
      return await admin(sb, action, body);
    }

    // ── Connexion ──
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

    switch (action) {
      case "me":
        return json(await construireMe(sb, s));

      case "logout":
        await sb.from("studio_sessions").delete().eq("id", s.sessionId);
        return json({ ok: true });

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
        const { data: c } = await sb.from("studio_conversations").select("id, agent_id, titre")
          .eq("id", String(body.conversation_id)).eq("workspace_id", s.ws.id).eq("user_id", s.user.id).maybeSingle();
        if (!c) return json({ error: "Conversation introuvable" }, 404);
        const { data } = await sb.from("studio_messages").select("id, role, content, retour, epingle, created_at, media_id")
          .eq("conversation_id", c.id).order("created_at");
        // Médias : état à jour (une vidéo en cours avance à chaque consultation) + URL signée.
        const avecMedias = (data ?? []).some((m) => m.media_id);
        const cle = avecMedias ? await cleOpenRouter(sb) : "";
        const messages = await Promise.all((data ?? []).map(async ({ media_id, ...m }) => ({
          ...m, media: media_id ? await statutMedia(sb, cle, s.ws.id, media_id) : null,
        })));
        return json({ conversation: c, messages });
      }

      case "connecteurs":
        return json({ connecteurs: await listerConnecteurs(sb, s.ws.id) });

      case "connecteur_enregistrer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        const r = await enregistrerConnecteur(sb, s.ws.id, s.user.id, body);
        if ("erreur" in r) return json({ error: r.erreur }, 400);
        return json({ ok: true, connecteurs: await listerConnecteurs(sb, s.ws.id) });
      }

      case "connecteur_supprimer": {
        if (s.user.role !== "proprietaire") return json({ error: "Réservé au propriétaire de l'espace" }, 403);
        await sb.from("studio_connecteurs").delete().eq("workspace_id", s.ws.id).eq("type", String(body.type ?? ""));
        return json({ ok: true, connecteurs: await listerConnecteurs(sb, s.ws.id) });
      }

      case "media_statut": {
        const media = await statutMedia(sb, await cleOpenRouter(sb), s.ws.id, String(body.id ?? ""));
        if (!media) return json({ error: "Média introuvable" }, 404);
        return json({ media });
      }

      case "medias": {
        // Galerie « Contenus » : visuels et vidéos prêts de tout l'espace.
        const { data } = await sb.from("studio_medias").select("id, type, agent_id, prompt, chemin, mime, created_at, conversation_id")
          .eq("workspace_id", s.ws.id).eq("statut", "pret").order("created_at", { ascending: false }).limit(60);
        const medias = await Promise.all((data ?? []).map(async ({ chemin, ...m }) => ({
          ...m, url: chemin ? await urlSignee(sb, chemin) : null,
        })));
        return json({ medias });
      }

      case "conversation_delete": {
        await sb.from("studio_conversations").delete()
          .eq("id", String(body.conversation_id)).eq("workspace_id", s.ws.id).eq("user_id", s.user.id);
        return json({ ok: true });
      }

      case "chat":
        return await chat(sb, s, body);

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
        const { data } = await sb.from("studio_documents")
          .select("id, titre, type, format, taille, actif, created_at, created_by, studio_users(prenom, nom)")
          .eq("workspace_id", s.ws.id).order("created_at", { ascending: false });
        return json({ ressources: data ?? [] });
      }

      case "ressource_get": {
        const { data } = await sb.from("studio_documents").select("id, titre, type, format, contenu, actif")
          .eq("id", String(body.id)).eq("workspace_id", s.ws.id).maybeSingle();
        if (!data) return json({ error: "Ressource introuvable" }, 404);
        return json({ ressource: data });
      }

      case "ressource_add": {
        const titre = String(body.titre ?? "").trim().slice(0, 200);
        const contenu = String(body.contenu ?? "").slice(0, DOC_MAX);
        if (!titre || !contenu.trim()) return json({ error: "Titre et contenu requis" }, 400);
        const { data, error } = await sb.from("studio_documents").insert({
          workspace_id: s.ws.id, titre, contenu, created_by: s.user.id,
          type: body.type === "fichier" ? "fichier" : "note",
          format: body.format ? String(body.format).slice(0, 10) : null,
          taille: Number.isFinite(Number(body.taille)) ? Number(body.taille) : null,
        }).select("id").single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, id: data.id });
      }

      case "ressource_toggle": {
        await sb.from("studio_documents").update({ actif: body.actif === true })
          .eq("id", String(body.id)).eq("workspace_id", s.ws.id);
        return json({ ok: true });
      }

      case "ressource_delete": {
        await sb.from("studio_documents").delete().eq("id", String(body.id)).eq("workspace_id", s.ws.id);
        return json({ ok: true });
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

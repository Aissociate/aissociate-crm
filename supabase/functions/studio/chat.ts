// Studio IA — chat (flux SSE vers OpenRouter, outils, enregistrement) et mission reçue par e-mail.
// Extrait de index.ts (même code).
import { type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { lancerMedia, quotaMediaAtteint } from "./medias.ts";
import { construirePrompt, selectionnerRessources, type AgentPrompt, type Creation, type EnteteEntreprise } from "./contexte.ts";
import { connecteursActifs, connecteursReservesParAgent } from "./connecteurs.ts";
import * as veille from "./veille.ts";
import { historique, type Passage } from "./routines.ts";
import { garde, journaliser, refusRecents, soumettreLivrable } from "./gouvernance.ts";
import { type Executeur } from "./liaison_traitement.ts";
import { outilsEspace, type CarnetEssai } from "./outils.ts";
import * as essai from "./essai.ts";
import { soumettreMission } from "./livrables.ts";
import * as recharges from "./recharges.ts";
import * as equipe from "./equipe.ts";
import * as consignes from "./consignes.ts";
import * as pouvoirs from "./pouvoirs.ts";
import * as lots from "./lots.ts";
import * as fichiers from "./fichiers.ts";
import * as vision from "./vision.ts";
import { accumulerAppels, appelsValides, cumulerUsage, refusOutils, type AppelOutil } from "./flux.ts";
import { chargerSavoirs, chargerPack, type Usage, insererReponse, chargerHarness, corsHeaders, json, HISTORIQUE, MODELE_DEFAUT, autorise, type Piece, PIECES_TOTAL, lirePieces, textePieces, type Session, sessionUtilisateur, acteurDe } from "./socle.ts";
import { agentsDuWorkspace, compterDemandesMois } from "./etats.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Chat (SSE) — proxy du flux OpenRouter, enregistrement en fin de réponse
// ─────────────────────────────────────────────────────────────────────────────

export async function chat(sb: SupabaseClient, s: Session, body: Record<string, unknown>): Promise<Response> {
  const agents = (await agentsDuWorkspace(sb, s.ws)) as unknown as AgentPrompt[];
  const agent = agents.find((a) => a.id === body.agent_id);
  if (!agent) return json({ error: "Agent indisponible pour votre offre" }, 403);

  // Deux entrées : un super-pouvoir (formulaire cadré, consigne rendue côté
  // serveur) ou une demande libre (soumise à la règle de périmètre).
  let question: string;      // envoyé au modèle
  let affichage: string;     // conservé dans l'historique
  let titreConv: string;
  let media: { type: "image" | "video"; format?: string; duree?: string } | null = null;
  // Pièces jointes : texte extrait dans le navigateur (PDF, Word, Excel, PowerPoint, CSV, texte).
  // Les passages de fond (routines, lots) viennent du serveur seul : la synthèse d'un lot peut joindre jusqu'à 12 documents.
  const pieces = lirePieces(body.pieces, s.sessionId === "tache" ? lots.SYNTHESE_MAX : 5);
  const pouvoir = body.pouvoir as { id?: string; valeurs?: Record<string, unknown> } | undefined;
  if (pouvoir?.id) {
    const sp = (agent.super_pouvoirs ?? []).find((p) => p.id === pouvoir.id);
    if (!sp) return json({ error: "Super-pouvoir inconnu" }, 400);
    const rendu = pouvoirs.rendrePouvoir(sp, pouvoir.valeurs ?? {});
    if ("manquant" in rendu) return json({ error: `Champ requis : ${rendu.manquant.label}` }, 400);
    ({ question, affichage, titre: titreConv, media } = rendu);
  } else {
    question = String(body.message ?? "").trim().slice(0, 8000);
    if (!question && !pieces.length) return json({ error: "Message vide" }, 400);
    if (!question) question = pieces.length > 1 ? "Voici des documents." : "Voici un document.";
    affichage = question;
    titreConv = (pieces.length && !String(body.message ?? "").trim() ? pieces.map((x) => x.nom).join(", ") : question).slice(0, 80);
  }

  // Quota du mois atteint : la mission puise dans les crédits de recharge (reportés de mois en mois).
  // Les visuels et vidéos ont leurs propres quotas, vérifiés plus bas.
  const quota = s.ws.quota_messages_mois;
  let demandeSurCredits = false;
  if (!media && quota != null && (await compterDemandesMois(sb, s.ws.id)) >= quota) {
    const refusCredits = await recharges.couvrable(sb, s.ws.id, "demande", quota);
    if (refusCredits) return json({ error: refusCredits, recharge: true }, 429);
    demandeSurCredits = true;
  }
  const refus = await garde(sb, s.ws.id);
  if (refus) return json({ error: refus.message, gouvernance: true }, refus.statut);

  const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
  const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
  const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
  if (!apiKey) return json({ error: "Service IA non configuré. Contactez Aissociate." }, 503);
  if (demandeSurCredits) await recharges.puiser(sb, s.ws.id, "demande", `client:${s.user.email}`);
  // Images jointes : décrites et retranscrites une fois, la description rejoint les pièces.
  let usageVision: Usage | null = null;
  const modeleVision = String(ai.model_vision || "").trim() || vision.MODELE_VISION;
  for (const p of pieces) {
    if (!p.image) continue;
    const d = await vision.decrireImage(apiKey, modeleVision, p.image, question);
    p.contenu = "erreur" in d ? `(Image non lue : ${d.erreur}.)` : `Description de l'image (lue automatiquement) :\n${d.texte}`;
    if (!("erreur" in d) && d.usage) usageVision = cumulerUsage(usageVision ?? {}, d.usage);
    delete p.image; // l'image elle-même n'est pas conservée
  }
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
    const quotaMedia = await quotaMediaAtteint(sb, s.ws, media.type);
    if (quotaMedia !== null) {
      if (quotaMedia === 0) return json({ error: media.type === "image" ? "Les visuels ne sont pas inclus dans votre formule. Contactez Aissociate." : "La vidéo n'est pas incluse dans votre formule. Contactez Aissociate." }, 403);
      const refusCredits = await recharges.couvrable(sb, s.ws.id, media.type, quotaMedia);
      if (refusCredits) return json({ error: refusCredits, recharge: true }, 429);
    }
    const lance = await lancerMedia(sb, apiKey, {
      wsId: s.ws.id, userId: s.user.id, agentId: agent.id, conversationId: conversationId as string,
      type: media.type, prompt: question, format: media.format, duree: media.duree,
    });
    if ("erreur" in lance) return json({ error: lance.erreur }, 502);
    if (quotaMedia !== null) {
      await recharges.puiser(sb, s.ws.id, media.type, `client:${s.user.email}`, lance.id);
      // Image déjà en échec avant le débit (tâche de fond rapide) : on recrédite aussitôt.
      const { data: etatMedia } = await sb.from("studio_medias").select("statut").eq("id", lance.id).maybeSingle();
      if (etatMedia?.statut === "echec") await recharges.rembourserMedia(sb, lance.id);
    }
    await sb.from("studio_messages").insert({
      conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "user", content: affichage,
      hors_quota: true, // compté sur le quota de visuels ou de vidéos, pas sur celui des demandes
    });
    const { data: rep } = await sb.from("studio_messages").insert({
      conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "assistant", media_id: lance.id,
      content: media.type === "image" ? "Voici votre visuel." : "Voici votre vidéo.",
    }).select("id, content").single();
    await journaliser(sb, {
      wsId: s.ws.id, acteur: `client:${s.user.email}`, agentId: agent.id, action: "media",
      detail: { type: media.type, media: lance.id, conversation: conversationId, titre: titreConv },
    });
    return json({
      conversation_id: conversationId, message_id: rep?.id ?? null, content: rep?.content ?? "",
      media: { id: lance.id, type: media.type, statut: "en_cours" },
    });
  }

  // Contexte : historique, ressources (pertinentes + récentes), contenus gardés, outils connectés, harness.
  const [{ data: past }, { data: trouves }, { data: recents }, { data: gardes }, connecteurs, harness, { data: papier }] = await Promise.all([
    sb.from("studio_messages").select("role, content, pieces").eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(HISTORIQUE),
    sb.rpc("studio_recherche_docs", { p_workspace: s.ws.id, p_question: question.slice(0, 500), p_limite: 4 }),
    sb.from("studio_documents").select("titre, contenu")
      .eq("workspace_id", s.ws.id).eq("actif", true).order("created_at", { ascending: false }).limit(8),
    sb.from("studio_messages").select("content, created_at, agent_id, studio_conversations!inner(titre)")
      .eq("workspace_id", s.ws.id).eq("epingle", true).is("media_id", null)
      .order("created_at", { ascending: false }).limit(6),
    connecteursActifs(sb, s.ws.id, agent.id),
    chargerHarness(sb),
    // Papier à en-tête (« Mon entreprise ») : coordonnées officielles données aux agents.
    sb.from("studio_workspaces").select("entete, logo_chemin").eq("id", s.ws.id).maybeSingle(),
  ]);
  const entete = (papier?.entete ?? null) as EnteteEntreprise | null;
  const logo = Boolean(papier?.logo_chemin);
  const ressources = selectionnerRessources(
    (trouves ?? []) as { titre: string; extrait: string }[],
    (recents ?? []).map((d) => ({ titre: d.titre, extrait: String(d.contenu).slice(0, 4000) })),
  );
  const [savoirs, pack] = await Promise.all([chargerSavoirs(sb, agent.id, question), chargerPack(sb, s.ws.id, question)]);
  const prenoms = new Map(agents.map((a) => [a.id, a.prenom]));
  const creations: Creation[] = (gardes ?? []).map((m) => ({
    titre: (m.studio_conversations as unknown as { titre: string }).titre,
    contenu: String(m.content), date: String(m.created_at).slice(0, 10),
    agent: prenoms.get(String(m.agent_id)),
  }));

  const { data: messageClient } = await sb.from("studio_messages").insert({
    conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "user", content: affichage,
    pieces: pieces.length ? pieces : null,
  }).select("id").single();

  // Passage de routine en mode essai (routines.ts) : uniquement depuis le moteur des routines, jamais depuis le navigateur.
  const carnetEssai = s.sessionId === "tache" && body.essai && typeof body.essai === "object"
    && Array.isArray((body.essai as CarnetEssai).propositions) ? body.essai as CarnetEssai : null;
  // Outils branchés sur les connexions Zernio de l'espace (messagerie, agenda, fichiers, réseaux), s'il y en a.
  const outils = await outilsEspace({
    sb, wsId: s.ws.id, acteur: acteurDe(s),
    agentId: agent.id, agentPrenom: agent.prenom, userId: s.sessionId === "mail" ? null : s.user.id,
    conversationId: conversationId as string, apiKey, essai: carnetEssai,
    // Léa seule propose des routines depuis le chat (routine_outil.ts).
    equipe: equipe.estOrchestrateur(agent.id) ? agents.map((a) => ({ id: String(a.id), prenom: String(a.prenom) })) : undefined,
  }).catch(() => null);
  const aujourdhui = new Date().toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // Les super-pouvoirs des collègues (sans leur gabarit) : Léa peut les activer en confiant une mission.
  // Léa sait aussi qui a accès aux connecteurs réservés (acces.ts), pour confier ce qui en a besoin.
  const reserves = equipe.estOrchestrateur(agent.id)
    ? await connecteursReservesParAgent(sb, s.ws.id).catch(() => new Map<string, string[]>())
    : new Map<string, string[]>();
  const collegues: equipe.Collegue[] = agents.filter((a) => a.id !== agent.id).map((a) => ({
    id: a.id, prenom: a.prenom, metier: a.metier,
    pouvoirs: (a.super_pouvoirs ?? []).map(({ id, titre, media, champs }) => ({ id, titre, media, champs })),
    connecteurs: reserves.get(a.id),
  }));
  // Super-pouvoirs média (visuel, vidéo) : l'agent les lance lui-même avec l'outil creer_media.
  const sesMedias = pouvoirs.pouvoirsMedia(agent.super_pouvoirs);
  if (outils && sesMedias.length) {
    outils.definitions.push(pouvoirs.definitionMedia(sesMedias));
    outils.consigne += `\n\n${pouvoirs.consigneMedia(sesMedias)}`;
  }
  // Léa orchestre : elle confie des missions aux spécialistes (qui travaillent avec leurs outils),
  // relit, renvoie pour correction, puis répond. Un spécialiste joint directement garde la
  // consultation simple d'un collègue (consulter_collegue).
  const orchestre = equipe.estOrchestrateur(agent.id);
  const missions = orchestre && Boolean(outils) && collegues.length > 0;
  const systemeBase = construirePrompt({
    agent, equipe: agents, ws: s.ws, ressources, creations, connecteurs, harness, savoirs, aujourdhui, entete, logo, pack,
    refus: await refusRecents(sb, s.ws.id, agent.id),
    perimetre: orchestre ? equipe.perimetreOrchestrateur(outils ? collegues : []) : undefined,
  });
  if (outils && collegues.length) outils.definitions.push(missions ? equipe.definitionMission(collegues) : equipe.definition(collegues));
  const systeme = outils
    ? `${systemeBase}\n\n${outils.consigne}${collegues.length && !missions ? `\n\n${equipe.consigne(collegues)}` : ""}`
    : systemeBase;
  const messages: Record<string, unknown>[] = [
    { role: "system", content: systeme },
    ...(past ?? []).reverse().map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 6000) + textePieces(m.pieces as Piece[] | null, 20_000),
    })),
    { role: "user", content: question + textePieces(pieces, PIECES_TOTAL) },
  ];

  const encoder = new TextEncoder();
  const stop = new AbortController();
  // Quitter la page ne coupe plus la réponse : la génération continue côté serveur
  // et s'enregistre ; seul le bouton « Arrêter » (action chat_arreter) l'interrompt.
  let clientParti = false;
  const debutGeneration = new Date().toISOString();
  await sb.from("studio_conversations").update({ generation_depuis: debutGeneration, arret_demande: null }).eq("id", conversationId);
  // Consignes ajoutées par le client pendant la réflexion (action chat_consigne) : lues entre deux
  // tours. Le spécialiste en mission les reçoit aussitôt ; l'agent principal toujours, à son tour suivant.
  const consignesVues = new Set<string>(messageClient?.id ? [String(messageClient.id)] : []);
  const consignesPourAgent: string[] = [];
  const nouvellesConsignes = async (): Promise<string[]> => {
    const { data } = await sb.from("studio_messages").select("id, content").eq("conversation_id", conversationId)
      .eq("role", "user").like("content", `${consignes.PREFIXE}%`).gt("created_at", debutGeneration).order("created_at").limit(20);
    const neuves = (data ?? []).filter((m) => !consignesVues.has(String(m.id)));
    neuves.forEach((m) => consignesVues.add(String(m.id)));
    return neuves.map((m) => consignes.texteConsigne(String(m.content ?? ""))).filter(Boolean);
  };
  const stream = new ReadableStream({
    cancel() { clientParti = true; },
    start(controller) {
      const emit = (event: string, payload: unknown) => {
        if (clientParti) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)); } catch { clientParti = true; }
      };
      // Arrêt demandé (éventuellement depuis une autre instance) : vérifié toutes les 2 s.
      const veille = setInterval(async () => {
        const { data } = await sb.from("studio_conversations").select("arret_demande").eq("id", conversationId).maybeSingle();
        if (data?.arret_demande && data.arret_demande >= debutGeneration) stop.abort();
      }, 2000);
      const travail = (async () => {
      let answer = "";
      let usage: Usage | null = null;
      const aides: string[] = [];
      const mediasProduits: { id: string; type: "image" | "video" }[] = [];
      try {
        emit("meta", {
          conversation_id: conversationId,
          ressources: ressources.map((r) => r.titre),
          // Base de l'agent : titres et références seulement, le contenu reste côté serveur.
          savoirs: savoirs.map((x) => ({ titre: x.titre, source: x.source ?? null })),
        });
        const entetesOR = {
          "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json",
          "HTTP-Referer": "https://aissociate.re", "X-Title": "Aissociate Studio IA",
        };
        // Boucle en flux : chaque tour diffuse le texte au fil de l'eau ; s'il se
        // termine par des appels d'outils, on les exécute et on relance (7 tours max).
        let avecOutils = Boolean(outils);
        let total: Usage = usageVision ?? {};
        let usageVu = Boolean(usageVision);
        let nbConsultations = 0;
        // ── Visuels et vidéos lancés par un agent (outil creer_media, ou mission de Léa) ──
        const creerMedia = async (qui: AgentPrompt, argsJson: string): Promise<{ resultat: string; libelle: string }> => {
          let a: Record<string, unknown> = {};
          try { a = JSON.parse(argsJson || "{}"); } catch { /* arguments illisibles */ }
          const sp = pouvoirs.pouvoirsMedia(qui.super_pouvoirs).find((p) => p.id === String(a.pouvoir ?? ""));
          if (!sp) return { resultat: "Super-pouvoir média inconnu.", libelle: "Média non créé" };
          if (mediasProduits.length >= pouvoirs.MAX_MEDIAS) return { resultat: `Limite de ${pouvoirs.MAX_MEDIAS} médias par demande atteinte.`, libelle: "Limite de médias atteinte" };
          if (carnetEssai) return { resultat: `Mode essai : aucun ${sp.media === "video" ? "vidéo" : "visuel"} n'est créé. Indique ce que tu aurais créé.`, libelle: "Essai : média non créé" };
          const valeurs = (a.valeurs && typeof a.valeurs === "object" ? a.valeurs : {}) as Record<string, unknown>;
          const rendu = pouvoirs.rendrePouvoir(sp, valeurs);
          if ("manquant" in rendu) return { resultat: `Champ requis manquant : ${rendu.manquant.nom} (${rendu.manquant.label}).`, libelle: "Média non créé" };
          const type = rendu.media?.type ?? "image";
          const nom = type === "image" ? "visuel" : "vidéo";
          const quotaMedia = await quotaMediaAtteint(sb, s.ws, type);
          if (quotaMedia === 0) return { resultat: `${type === "image" ? "Les visuels ne sont pas inclus" : "La vidéo n'est pas incluse"} dans la formule du client : dis-le-lui (il peut contacter Aissociate).`, libelle: `${nom[0].toUpperCase()}${nom.slice(1)} non inclus dans la formule` };
          if (quotaMedia !== null) {
            const refusCredits = await recharges.couvrable(sb, s.ws.id, type, quotaMedia);
            if (refusCredits) return { resultat: `Quota atteint, ${nom} non créé : ${refusCredits}`, libelle: `Quota de ${nom}s atteint` };
          }
          const lance = await lancerMedia(sb, apiKey, {
            wsId: s.ws.id, userId: s.user.id, agentId: qui.id, conversationId: conversationId as string,
            type, prompt: rendu.question, format: rendu.media?.format, duree: rendu.media?.duree,
          });
          if ("erreur" in lance) return { resultat: `Création impossible : ${lance.erreur}`, libelle: `${nom[0].toUpperCase()}${nom.slice(1)} non créé` };
          if (quotaMedia !== null) {
            await recharges.puiser(sb, s.ws.id, type, acteurDe(s), lance.id);
            const { data: etatMedia } = await sb.from("studio_medias").select("statut").eq("id", lance.id).maybeSingle();
            if (etatMedia?.statut === "echec") await recharges.rembourserMedia(sb, lance.id);
          }
          mediasProduits.push({ id: lance.id, type });
          emit("media", { id: lance.id, type, statut: "en_cours" });
          await journaliser(sb, {
            wsId: s.ws.id, acteur: acteurDe(s), agentId: qui.id, action: "media",
            detail: { type, media: lance.id, conversation: conversationId, titre: rendu.titre, par_agent: true },
          });
          return {
            resultat: `${type === "image" ? "Visuel" : "Vidéo"} lancé (${sp.titre}), référence ${pouvoirs.referenceMedia(lance.id)} : il s'affiche au client sous la réponse et rejoint « Mes contenus »${type === "video" ? " (quelques minutes de tournage)" : ""}. Pour le publier avec un post, donne cette référence dans medias de reseaux_proposer_publication. Description utilisée : ${rendu.question.slice(0, 400)}`,
            libelle: `${type === "image" ? "Création du visuel" : "Tournage de la vidéo"} lancée`,
          };
        };
        /** consulter_collegue : le collègue répond sans outils (il ne peut pas consulter à son tour). */
        const consulter = async (argsJson: string): Promise<{ resultat: string; libelle: string }> => {
          let a: Record<string, unknown> = {};
          try { a = JSON.parse(argsJson || "{}"); } catch { /* arguments illisibles */ }
          const collegue = agents.find((x) => x.id === String(a.agent_id ?? "") && x.id !== agent.id);
          const q = String(a.question ?? "").trim().slice(0, 6000);
          if (!collegue || !q) return { resultat: "Collègue inconnu ou question vide.", libelle: "Consultation impossible" };
          if (nbConsultations >= equipe.MAX_CONSULTATIONS) {
            return { resultat: `Limite de ${equipe.MAX_CONSULTATIONS} consultations atteinte : termine avec ce que tu as.`, libelle: "Limite de consultations atteinte" };
          }
          nbConsultations++;
          emit("outil", { libelle: `${collegue.prenom} est consulté…` });
          const sys = construirePrompt({
            agent: collegue, equipe: agents, ws: s.ws, ressources, creations, harness, aujourdhui, entete, logo, pack,
            // Ses connecteurs à lui : un connecteur réservé à d'autres agents n'y figure pas (acces.ts).
            connecteurs: await connecteursActifs(sb, s.ws.id, collegue.id).catch(() => connecteurs),
            savoirs: await chargerSavoirs(sb, collegue.id, q),
          }) + "\n\n" + equipe.consigneConsulte(agent);
          const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST", signal: stop.signal, headers: entetesOR,
            body: JSON.stringify({
              model: collegue.modele_effectif ?? autorise(ai.model_studio) ?? MODELE_DEFAUT,
              messages: [{ role: "system", content: sys }, { role: "user", content: q }],
              temperature: 0.5, max_tokens: 3000, usage: { include: true },
            }),
          });
          const j = await r.json().catch(() => ({}));
          if (j?.usage) { total = cumulerUsage(total, j.usage); usageVu = true; }
          const texte = r.ok ? equipe.nettoyer(String(j?.choices?.[0]?.message?.content ?? "")) : "";
          if (!texte) {
            return { resultat: `${collegue.prenom} n'a pas pu répondre${r.ok ? "" : ` (${r.status})`}. Continue sans sa contribution.`, libelle: `Consultation de ${collegue.prenom} impossible` };
          }
          aides.push(`${collegue.prenom} (${collegue.metier})`);
          await journaliser(sb, {
            wsId: s.ws.id, acteur: acteurDe(s), agentId: agent.id, action: "consultation",
            detail: { collegue: collegue.id, prenom: collegue.prenom, conversation: conversationId, question: q.slice(0, 300) },
          });
          return { resultat: `Réponse de ${collegue.prenom} (${collegue.metier}) :\n${texte}`, libelle: `Contribution de ${collegue.prenom}` };
        };
        // ── Orchestration : missions confiées par Léa aux spécialistes ──
        // Un fil par spécialiste, gardé le temps de la demande : le rappeler reprend sa mission.
        type FilMission = { messages: Record<string, unknown>[]; outils: Awaited<ReturnType<typeof outilsEspace>> | null; appels: number; sansRaisonnement?: boolean };
        const fils = new Map<string, FilMission>();
        let nbMissions = 0;
        const confier = async (argsJson: string): Promise<{ resultat: string; libelle: string }> => {
          let a: Record<string, unknown> = {};
          try { a = JSON.parse(argsJson || "{}"); } catch { /* arguments illisibles */ }
          const collegue = agents.find((x) => x.id === String(a.agent_id ?? "") && x.id !== agent.id);
          let consigne = String(a.consigne ?? "").trim().slice(0, 12_000);
          // Super-pouvoir du spécialiste activé par Léa : sa consigne détaillée (gabarit) cadre la mission.
          const sp = collegue && a.pouvoir ? (collegue.super_pouvoirs ?? []).find((p) => p.id === String(a.pouvoir)) : undefined;
          if (collegue && a.pouvoir && !sp) return { resultat: `${collegue.prenom} n'a pas de super-pouvoir « ${String(a.pouvoir)} ».`, libelle: "Super-pouvoir inconnu" };
          if (!collegue || (!consigne && !sp)) return { resultat: "Spécialiste inconnu ou consigne vide.", libelle: "Mission impossible" };
          const refus = equipe.refusMission(nbMissions, fils.get(collegue.id)?.appels ?? 0);
          if (refus) return { resultat: refus, libelle: "Limite d'allers-retours atteinte" };
          const valeurs = sp ? equipe.valeursMission(sp, a.valeurs, consigne) : {};
          if (sp?.media) {
            // Visuel ou vidéo : lancé directement au nom du spécialiste, sans tour de rédaction.
            nbMissions++;
            emit("outil", { libelle: `${collegue.prenom} (${collegue.metier}) travaille…` });
            const r = await creerMedia(collegue, JSON.stringify({ pouvoir: sp.id, valeurs }));
            if (mediasProduits.length && r.libelle.endsWith("lancée")) aides.push(`${collegue.prenom} (${collegue.metier})`);
            return { resultat: r.resultat, libelle: `${collegue.prenom} : ${r.libelle}` };
          }
          if (sp) {
            const rendu = pouvoirs.rendrePouvoir(sp, valeurs);
            if ("manquant" in rendu) return { resultat: `Super-pouvoir « ${sp.titre} » : champ requis manquant (${rendu.manquant.nom}).`, libelle: "Mission impossible" };
            consigne = `${rendu.question}${consigne ? `\n\nPrécisions de ${agent.prenom} :\n${consigne}` : ""}`;
          }
          nbMissions++;
          let fil = fils.get(collegue.id);
          const reprise = Boolean(fil);
          // Première mission : les pièces jointes du client lui sont transmises telles quelles.
          if (!reprise && pieces.length) consigne += `\n\nDocuments joints par le client :${textePieces(pieces, 60_000)}`;
          emit("outil", { libelle: reprise ? `${collegue.prenom} reprend son travail…` : `${collegue.prenom} (${collegue.metier}) travaille…` });
          if (!fil) {
            // Le spécialiste a ses propres outils : ce qu'il prépare (notes, brouillons) lui est attribué.
            const sesOutils = await outilsEspace({
              sb, wsId: s.ws.id, acteur: acteurDe(s), agentId: collegue.id, agentPrenom: collegue.prenom,
              userId: s.sessionId === "mail" ? null : s.user.id, conversationId: conversationId as string, apiKey,
              // Ses propositions portent la trace de l'agent qui lui a confié la mission (studio_livrables.confie_par).
              confiePar: agent.id, essai: carnetEssai,
            }).catch(() => null);
            const sesMediasC = pouvoirs.pouvoirsMedia(collegue.super_pouvoirs);
            if (sesOutils && sesMediasC.length) {
              sesOutils.definitions.push(pouvoirs.definitionMedia(sesMediasC));
              sesOutils.consigne += `\n\n${pouvoirs.consigneMedia(sesMediasC)}`;
            }
            const sys = construirePrompt({
              agent: collegue, equipe: agents, ws: s.ws, ressources, creations, harness, aujourdhui, entete, logo, pack,
              // Ses connecteurs à lui : un connecteur réservé à d'autres agents n'y figure pas (acces.ts).
              connecteurs: await connecteursActifs(sb, s.ws.id, collegue.id).catch(() => connecteurs),
              savoirs: await chargerSavoirs(sb, collegue.id, consigne),
              refus: await refusRecents(sb, s.ws.id, collegue.id),
            }) + (sesOutils ? `\n\n${sesOutils.consigne}` : "") + "\n\n" + equipe.consigneMission(agent);
            fil = { messages: [{ role: "system", content: sys }], outils: sesOutils, appels: 0 };
            fils.set(collegue.id, fil);
          }
          fil.appels++;
          fil.messages.push({ role: "user", content: reprise ? `Corrections demandées par ${agent.prenom} :\n${consigne}` : consigne });
          const modeleCollegue = collegue.modele_effectif ?? autorise(ai.model_studio) ?? MODELE_DEFAUT;
          let texte = "";
          let outilsOk = Boolean(fil.outils);
          let relance = false;
          // Un modèle qui raisonne peut épuiser son plafond avant d'écrire (fin « length », texte vide) :
          // la relance se fait alors sans raisonnement, sinon elle échoue de la même façon.
          // Retenu pour les reprises du même spécialiste dans cette demande.
          let sansRaisonnement = fil.sansRaisonnement ?? false;
          for (let t = 0; t < equipe.TOURS_MISSION; t++) {
            const final = t === equipe.TOURS_MISSION - 1;
            // Consigne du client arrivée pendant la mission : le spécialiste l'applique, l'agent principal la recevra aussi.
            const ajouts = await nouvellesConsignes().catch(() => []);
            if (ajouts.length) {
              for (const c of ajouts) fil.messages.push({ role: "user", content: consignes.pourSpecialiste(c, agent.prenom) });
              consignesPourAgent.push(...ajouts);
              emit("outil", { libelle: consignes.libellePrise(ajouts.length, collegue.prenom) });
            }
            // Dernier tour : plus d'outils, et on le dit, sinon certains modèles rendent une réponse vide.
            if (final && !relance) fil.messages.push({ role: "user", content: equipe.RELANCE_MISSION });
            const corps: Record<string, unknown> = { model: modeleCollegue, messages: fil.messages, temperature: 0.5, max_tokens: equipe.PLAFOND_MISSION, usage: { include: true } };
            if (sansRaisonnement) corps.reasoning = { enabled: false };
            if (outilsOk && fil.outils) { corps.tools = fil.outils.definitions; corps.tool_choice = final || relance ? "none" : "auto"; }
            const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST", signal: stop.signal, headers: entetesOR, body: JSON.stringify(corps),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) {
              if (outilsOk && refusOutils(r.status, String(j?.error?.message ?? ""))) { outilsOk = false; t--; continue; }
              console.error(`[studio] mission ${collegue.id} : HTTP ${r.status} ${String(j?.error?.message ?? "").slice(0, 300)}`);
              break;
            }
            if (j?.usage) { total = cumulerUsage(total, j.usage); usageVu = true; }
            const m = j?.choices?.[0]?.message;
            const contenu = String(m?.content ?? "");
            const appelsM = appelsValides((Array.isArray(m?.tool_calls) ? m.tool_calls : []) as AppelOutil[]);
            if (!appelsM.length || !fil.outils) {
              if (!contenu.trim()) {
                const fin = String(j?.choices?.[0]?.finish_reason ?? "?");
                console.error(`[studio] mission ${collegue.id} : réponse vide (fin : ${fin}, tour ${t + 1}${sansRaisonnement ? ", sans raisonnement" : ""})`);
                // Plafond atteint sans texte : une relance de plus, cette fois sans raisonnement.
                if (equipe.relancerSansRaisonnement(fin, sansRaisonnement)) {
                  sansRaisonnement = true; fil.sansRaisonnement = true; relance = true;
                  if (!final && fil.messages.at(-1)?.content !== equipe.RELANCE_MISSION) fil.messages.push({ role: "user", content: equipe.RELANCE_MISSION });
                  t = Math.min(t, equipe.TOURS_MISSION - 2); continue;
                }
                // Une seule relance explicite, sans outils.
                if (!relance) { relance = true; if (!final) fil.messages.push({ role: "user", content: equipe.RELANCE_MISSION }); t = Math.min(t, equipe.TOURS_MISSION - 2); continue; }
              }
              texte = contenu; fil.messages.push({ role: "assistant", content: contenu }); break;
            }
            fil.messages.push({ role: "assistant", content: contenu, tool_calls: appelsM });
            for (const ap of appelsM.slice(0, 5)) {
              const res = ap.function.name === pouvoirs.NOM_OUTIL_MEDIA
                ? await creerMedia(collegue, ap.function.arguments)
                : await fil.outils.executer(ap.function.name, ap.function.arguments);
              emit("outil", { libelle: `${collegue.prenom} : ${res.libelle}` });
              if ("usage" in res && res.usage) { total = cumulerUsage(total, res.usage); usageVu = true; }
              if ("document" in res && res.document) emit("document", res.document);
              fil.messages.push({ role: "tool", tool_call_id: ap.id, content: res.resultat.slice(0, 20_000) });
            }
          }
          texte = equipe.nettoyer(texte);
          if (!texte && reprise) {
            // La reprise a échoué : sa version précédente reste valable, Léa termine avec.
            return { resultat: `${collegue.prenom} n'a pas pu rendre de version corrigée. Garde sa version précédente, applique toi-même les corrections que tu peux et signale au client ce qui reste à vérifier.`, libelle: `${collegue.prenom} n'a pas pu corriger, ${agent.prenom} termine` };
          }
          if (!texte) {
            return { resultat: `${collegue.prenom} n'a pas pu rendre son travail. Termine sans sa contribution et dis au client ce qui manque.`, libelle: `${collegue.prenom} n'a pas pu répondre` };
          }
          aides.push(`${collegue.prenom} (${collegue.metier})`);
          await journaliser(sb, {
            wsId: s.ws.id, acteur: acteurDe(s), agentId: agent.id, action: "consultation",
            detail: { collegue: collegue.id, prenom: collegue.prenom, conversation: conversationId, question: consigne.slice(0, 300), mission: true, reprise },
          });
          return {
            resultat: `Travail rendu par ${collegue.prenom} (${collegue.metier})${reprise ? ", version corrigée" : ""} :\n${texte}\n\n(Relis-le avant de répondre au client : complet, exact, cohérent ? Sinon renvoie-le avec tes corrections.)`,
            libelle: reprise ? `${collegue.prenom} a rendu sa version corrigée` : `${collegue.prenom} a rendu son travail, ${agent.prenom} relit`,
          };
        };
        // Léa enchaîne missions, relectures et reprises : il lui faut plus de tours qu'à un spécialiste.
        const TOURS = missions ? 10 : 7;
        let relanceVide = false;
        for (let tour = 0; tour < TOURS; tour++) {
          const dernier = tour === TOURS - 1;
          // Consignes ajoutées en cours de route : celles déjà vues par un spécialiste, puis les nouvelles.
          const dejaVues = consignesPourAgent.splice(0);
          const neuves = await nouvellesConsignes().catch(() => []);
          for (const c of [...dejaVues, ...neuves]) messages.push({ role: "user", content: consignes.pourAgent(c) });
          if (neuves.length) emit("outil", { libelle: consignes.libellePrise(neuves.length) });
          const corps: Record<string, unknown> = { model, messages, stream: true, temperature: 0.5, usage: { include: true } };
          if (avecOutils && outils) { corps.tools = outils.definitions; corps.tool_choice = dernier ? "none" : "auto"; }
          const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST", signal: stop.signal, headers: entetesOR, body: JSON.stringify(corps),
          });
          if (!resp.ok || !resp.body) {
            const msg = await resp.text().catch(() => "");
            if (avecOutils && refusOutils(resp.status, msg)) { avecOutils = false; tour--; continue; }
            throw new Error(`Service IA indisponible (${resp.status})`);
          }
          const reader = resp.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let texteTour = "";
          let appels: AppelOutil[] = [];
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
                const d = j.choices?.[0]?.delta;
                if (typeof d?.content === "string" && d.content) { texteTour += d.content; answer += d.content; emit("delta", { text: d.content }); }
                if (d?.tool_calls) appels = accumulerAppels(appels, d.tool_calls);
                // Dernier fragment avant [DONE] : coût réel et tokens (comptabilité OpenRouter).
                if (j.usage) { total = cumulerUsage(total, j.usage); usageVu = true; }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
          const complets = appelsValides(appels);
          // Réponse vide après des outils (certains modèles s'arrêtent là) : une relance explicite.
          if (!complets.length && !answer.trim() && tour > 0 && !relanceVide && !dernier) {
            relanceVide = true;
            console.error(`[studio] chat ${agent.id} : réponse vide après outils, relance`);
            messages.push({ role: "user", content: "(Rédige maintenant ta réponse complète au client avec ce que tu as, sans appeler d'outil.)" });
            continue;
          }
          if (!complets.length || !outils) break;
          messages.push({ role: "assistant", content: texteTour, tool_calls: complets });
          for (const a of complets.slice(0, 5)) {
            const res = a.function.name === equipe.NOM_MISSION && missions
              ? await confier(a.function.arguments)
              : a.function.name === equipe.NOM_OUTIL
                ? await consulter(a.function.arguments)
                : a.function.name === pouvoirs.NOM_OUTIL_MEDIA && sesMedias.length
                  ? await creerMedia(agent, a.function.arguments)
                  : await outils.executer(a.function.name, a.function.arguments);
            emit("outil", { libelle: res.libelle });
            // Outil payant (recherche web) : son coût rejoint celui de la réponse.
            if ("usage" in res && res.usage) { total = cumulerUsage(total, res.usage); usageVu = true; }
            if ("document" in res && res.document) emit("document", res.document);
            messages.push({ role: "tool", tool_call_id: a.id, content: res.resultat.slice(0, 40_000) });
          }
          // Séparation lisible entre un éventuel texte d'annonce et la suite.
          if (texteTour.trim()) { answer += "\n\n"; emit("delta", { text: "\n\n" }); }
        }
        usage = usageVu ? total : null;
        // Consigne arrivée pendant la rédaction finale : trop tard pour cette réponse, on le dit.
        if ([...consignesPourAgent, ...(await nouvellesConsignes().catch(() => []))].length) {
          emit("outil", { libelle: "Consigne arrivée après la fin de la réflexion : renvoyez-la comme nouveau message" });
        }
        if (!answer.trim()) answer = "Je n'ai pas pu produire de réponse. Pouvez-vous reformuler ?";
        // Mission d'équipe : mention discrète des collègues consultés.
        const mention = equipe.mentionAide(aides);
        if (mention && !answer.includes("[[RELAIS:")) {
          const ajout = `${answer.endsWith("\n\n") ? "" : "\n\n"}${mention}`;
          answer += ajout; emit("delta", { text: ajout });
        }
        // Visuels et vidéos lancés pendant la demande : ils restent affichés sous la réponse enregistrée.
        const ajoutMedias = pouvoirs.ajoutMedias(answer, mediasProduits);
        if (ajoutMedias) { answer += ajoutMedias; emit("delta", { text: ajoutMedias }); }
        const row = await insererReponse(sb, {
          conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "assistant", content: answer,
        }, usage, model);
        emit("done", { message_id: row?.id ?? null, conversation_id: conversationId });
        // Mission guidée : le résultat rejoint « Aujourd'hui » comme livrable à valider (livrables.ts › soumettreMission).
        if (body.mission === true && row?.id) {
          const { count } = await sb.from("studio_livrables").select("id", { count: "exact", head: true })
            .eq("conversation_id", conversationId).gte("created_at", debutGeneration);
          if (soumettreMission({ mission: true, texte: answer, propositions: count ?? 0 })) {
            await soumettreLivrable(sb, s.ws.id, acteurDe(s), row.id);
          }
        }
        // Demande relayée à un collègue : elle ne compte pas (le client la renverra au bon agent).
        if (answer.includes("[[RELAIS:") && messageClient?.id) {
          await sb.from("studio_messages").update({ hors_quota: true }).eq("id", messageClient.id);
          if (demandeSurCredits) await recharges.recrediter(sb, s.ws.id, "demande", "Demande relayée à un collègue : recréditée");
        }
        await journaliser(sb, {
          wsId: s.ws.id, acteur: acteurDe(s), agentId: agent.id, action: "mission",
          detail: {
            conversation: conversationId, message: row?.id ?? null, titre: titreConv, pouvoir: pouvoir?.id ?? null,
            relais: answer.includes("[[RELAIS:"), cout_usd: typeof usage?.cost === "number" ? usage.cost : null,
          },
        });
      } catch (err) {
        if (stop.signal.aborted) {
          if (answer.trim()) {
            // Coût inconnu (flux coupé avant le fragment « usage ») : ces réponses comptent dans « sans coût ».
            await insererReponse(sb, {
              conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "assistant",
              content: `${answer}\n\n_(réponse interrompue)_${pouvoirs.ajoutMedias(answer, mediasProduits)}`,
            }, null, model);
          }
        } else {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[studio] chat:", message);
          emit("error", { message });
          // Personne ne voit l'erreur en direct : on la laisse dans la conversation.
          if (clientParti) {
            await insererReponse(sb, {
              conversation_id: conversationId, workspace_id: s.ws.id, agent_id: agent.id, role: "assistant",
              content: `${answer ? `${answer}\n\n` : ""}_(La réponse n'a pas pu aboutir : ${message}. Relancez la demande.)_`,
            }, null, model);
          }
        }
      } finally {
        clearInterval(veille);
        await sb.from("studio_conversations").update({ generation_depuis: null }).eq("id", conversationId).eq("generation_depuis", debutGeneration);
        try { controller.close(); } catch { /* déjà fermé */ }
      }
      })();
      // Garde l'instance en vie jusqu'à la fin, même si le navigateur s'est déconnecté.
      (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(travail);
      return travail;
    },
  });
  return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}


/**
 * Mission demandée par e-mail : même chemin que le chat du Studio (garde, quotas,
 * contexte, coût, journal), flux SSE lu jusqu'au bout côté serveur.
 */
export function executeurMail(sb: SupabaseClient, origine: "mail" | "tache" = "mail"): Executeur {
  return async (userId, body) => {
    const s = await sessionUtilisateur(sb, userId, origine);
    if (!s) return { ok: false, erreur: "Accès désactivé ou espace expiré." };
    const rep = await chat(sb, s, body);
    if (!(rep.headers.get("Content-Type") ?? "").includes("text/event-stream")) {
      const j = await rep.json().catch(() => ({})) as Record<string, unknown>;
      return { ok: false, erreur: String(j.error ?? `Erreur ${rep.status}`) };
    }
    const brut = await rep.text();
    let texte = "", fin: Record<string, unknown> | null = null, erreur: string | null = null;
    for (const bloc of brut.split("\n\n")) {
      const ev = /^event: (.+)$/m.exec(bloc)?.[1];
      const data = /^data: (.+)$/m.exec(bloc)?.[1];
      if (!ev || !data) continue;
      let j: Record<string, unknown>;
      try { j = JSON.parse(data); } catch { continue; }
      if (ev === "delta") texte += String(j.text ?? "");
      if (ev === "done") fin = j;
      if (ev === "error") erreur = String(j.message ?? "Erreur du service IA");
    }
    if (erreur || !fin) return { ok: false, erreur: erreur ?? "Réponse interrompue." };
    return {
      ok: true, texte: texte.trim() || "Je n'ai pas pu produire de réponse. Pouvez-vous reformuler ?",
      message_id: (fin.message_id as string | null) ?? null, conversation_id: (fin.conversation_id as string | null) ?? null,
    };
  };
}

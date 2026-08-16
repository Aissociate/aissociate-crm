// Supabase Edge Function — traitement d'une conversation enregistrée depuis la
// page mobile (/mobile).
//
// L'audio a déjà été téléversé segment par segment dans le bucket privé
// « conversations » par le téléphone. Ici, côté serveur :
//   1. chaque segment est transcrit (OpenRouter /audio/transcriptions) ;
//   2. la transcription complète est analysée par le modèle de chat pour en
//      tirer un compte-rendu structuré (résumé, besoin, formation envisagée,
//      financement, prochaine action…) ;
//   3. le résultat est déversé dans le CRM : action « appel » réalisée sur la
//      fiche contact, relance planifiée, et champs de qualification encore
//      vides complétés (jamais écrasés — la saisie humaine prime).
//
//   action 'traiter' → { conversation_id }
//   action 'relancer' → même chose, en repartant d'une conversation en erreur
//
// Deux découpages pour tenir les limites de temps : la transcription se fait
// segment par segment (le point de terminaison STT coupe au-delà d'une minute),
// et l'ensemble tourne en TÂCHE DE FOND — la fonction répond immédiatement, le
// téléphone suit l'avancement en relisant la ligne `conversations`.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const PROMPT_ANALYSE = `Tu es l'assistant d'un organisme de formation. On te donne la transcription d'un entretien téléphonique ou en présentiel entre un conseiller et un prospect ou un stagiaire.

Rédige un compte-rendu factuel, en français, à partir de la SEULE transcription. N'invente rien : si une information n'a pas été dite, laisse le champ vide.

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec ces clés :
{
  "resume": "5 à 10 lignes : contexte, ce qui a été dit, ce qui a été décidé",
  "points_cles": ["3 à 6 puces courtes"],
  "besoin_resume": "le besoin exprimé, une phrase (vide si non abordé)",
  "formation_envisagee": "intitulé évoqué (vide si non abordé)",
  "financement_envisage": "CPF, OPCO, France Travail, autofinancement… (vide si non abordé)",
  "interet": "chaud | tiede | froid | (vide si indéterminable)",
  "objections": ["objections ou freins exprimés"],
  "engagements": ["ce que le conseiller s'est engagé à faire"],
  "prochaine_action": { "description": "action de relance concrète", "delai_jours": 0 }
}

"delai_jours" : 0 si la relance est à faire au prochain créneau ouvrable, sinon le nombre de jours convenu.`;

// Première heure ouvrable à venir (9 h), en cohérence avec le CRM.
function prochaineHeureOuvrable(joursDeDelai = 0): { date: string; heure: string } {
  const d = new Date();
  d.setDate(d.getDate() + Math.max(0, joursDeDelai));
  const ouvre = (x: Date) => x.getDay() >= 1 && x.getDay() <= 5;
  if (!ouvre(d) || (joursDeDelai <= 0 && d.getHours() >= 9)) {
    do { d.setDate(d.getDate() + 1); } while (!ouvre(d));
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, heure: "09:00" };
}

function nowParts(): { date: string; heure: string } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    heure: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

function base64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000; // par tranches, sinon String.fromCharCode explose sur les gros fichiers
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** « audio/webm;codecs=opus » → « webm » (format attendu par l'endpoint STT). */
function formatOf(mime: string | undefined, path: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ext || "webm";
}

/** Extrait le premier objet JSON d'une réponse de modèle (au cas où il bavarde). */
function parseJson(txt: string): Record<string, unknown> {
  const cleaned = txt.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* on tente l'extraction */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* ignore */ }
  }
  return {};
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];

// Prolonge l'exécution après l'envoi de la réponse (tâche de fond Supabase).
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
function enTacheDeFond(travail: Promise<unknown>): void {
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(travail);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE);

  let conversationId = "";
  try {
    const { action, conversation_id } = await req.json();
    conversationId = String(conversation_id ?? "");
    if (action !== "traiter" && action !== "relancer") return json({ error: "Action inconnue" }, 400);
    if (!conversationId) return json({ error: "Conversation manquante" }, 400);

    // 1) Authentifier l'appelant (le conseiller sur son téléphone).
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Non authentifié" }, 401);

    // 2) Charger la conversation et vérifier que l'appelant y a droit.
    const { data: conv } = await sb.from("conversations").select("*").eq("id", conversationId).maybeSingle();
    if (!conv) return json({ error: "Conversation introuvable" }, 404);

    const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isDirection = profile?.role === "admin" || profile?.role === "directeur_commercial";
    if (!isDirection && conv.auteur_id !== user.id) return json({ error: "Accès refusé" }, 403);

    const segments = (Array.isArray(conv.segments) ? conv.segments : []) as
      { index?: number; path?: string; mime?: string }[];
    if (!segments.length) return json({ error: "Aucun audio à transcrire" }, 400);
    if (conv.statut === "traitement") return json({ error: "Traitement déjà en cours" }, 409);

    // 3) Clé et modèles (Paramètres > IA, comme l'assistant interne).
    const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
    const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
    if (!apiKey) return json({ error: "Clé OpenRouter absente (Paramètres > IA)" }, 400);
    const modelStt = ai.model_stt || "openai/whisper-1";
    const modelChat = ai.model || "anthropic/claude-opus-4.8";

    await sb.from("conversations").update({ statut: "traitement", erreur: null }).eq("id", conversationId);

    // À partir d'ici, tout se passe en tâche de fond : une heure d'entretien
    // dépasserait le temps imparti à une requête. Le téléphone suit l'état en
    // relisant la ligne (statut, resume, transcription, erreur).
    const travail = async (): Promise<void> => {
      // 4) Transcrire chaque segment. Un segment illisible ne perd pas les autres.
      const ordered = [...segments].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const morceaux: string[] = [];
      const echecs: number[] = [];

      for (const seg of ordered) {
        if (!seg.path) continue;
        const { data: blob, error: dlErr } = await sb.storage.from("conversations").download(seg.path);
        if (dlErr || !blob) { echecs.push(seg.index ?? 0); continue; }
        const bytes = new Uint8Array(await blob.arrayBuffer());

        const resp = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://aissociate.crm",
            "X-Title": "CRM Formation AIssociate",
          },
          body: JSON.stringify({
            model: modelStt,
            language: "fr",
            input_audio: { data: base64(bytes), format: formatOf(seg.mime, seg.path) },
          }),
        });
        if (!resp.ok) { echecs.push(seg.index ?? 0); continue; }
        const out = await resp.json();
        const texte = str(out?.text);
        if (texte) morceaux.push(texte);
      }

      const transcription = morceaux.join("\n\n").trim();
      if (!transcription) {
        await sb.from("conversations").update({
          statut: "erreur", erreur: "Transcription vide : audio inaudible ou service indisponible.",
        }).eq("id", conversationId);
        return;
      }

      // 5) Compte-rendu structuré.
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://aissociate.crm",
          "X-Title": "CRM Formation AIssociate",
        },
        body: JSON.stringify({
          model: modelChat,
          temperature: 0.2,
          messages: [
            { role: "system", content: PROMPT_ANALYSE },
            { role: "user", content: `Date de l'entretien : ${conv.demarree_at}\n\n=== TRANSCRIPTION ===\n${transcription.slice(0, 60000)}` },
          ],
        }),
      });
      if (!resp.ok) {
        // La transcription est acquise : on la conserve même si l'analyse échoue.
        await sb.from("conversations").update({
          transcription, statut: "erreur", erreur: `Analyse indisponible (OpenRouter ${resp.status}).`,
        }).eq("id", conversationId);
        return;
      }
      const data = await resp.json();
      const brut = parseJson(str(data?.choices?.[0]?.message?.content));

      const analyse = {
        resume: str(brut.resume),
        points_cles: list(brut.points_cles),
        besoin_resume: str(brut.besoin_resume),
        formation_envisagee: str(brut.formation_envisagee),
        financement_envisage: str(brut.financement_envisage),
        interet: str(brut.interet),
        objections: list(brut.objections),
        engagements: list(brut.engagements),
        prochaine_action: {
          description: str((brut.prochaine_action as Record<string, unknown>)?.description),
          delai_jours: Number((brut.prochaine_action as Record<string, unknown>)?.delai_jours ?? 0) || 0,
        },
      };

      // 6) Déversement CRM — uniquement si la conversation est rattachée à un contact.
      let actionId: string | null = null;
      if (conv.contact_id) {
        const { date, heure } = nowParts();
        const corps = [
          analyse.resume,
          analyse.points_cles.length ? analyse.points_cles.map((p) => `• ${p}`).join("\n") : "",
          analyse.engagements.length ? `À faire : ${analyse.engagements.join(" ; ")}` : "",
        ].filter(Boolean).join("\n\n");

        const { data: act } = await sb.from("contact_actions").insert({
          contact_id: conv.contact_id,
          date_action: date,
          heure_action: heure,
          type: "appel",
          description: `Conversation enregistrée${conv.duree_secondes ? ` (${Math.round(conv.duree_secondes / 60)} min)` : ""} — compte-rendu IA\n\n${corps}`.slice(0, 6000),
          faite: true,
          auteur_id: conv.auteur_id,
        }).select("id").maybeSingle();
        actionId = act?.id ?? null;

        if (analyse.prochaine_action.description) {
          const suite = prochaineHeureOuvrable(analyse.prochaine_action.delai_jours);
          await sb.from("contact_actions").insert({
            contact_id: conv.contact_id,
            date_action: suite.date,
            heure_action: suite.heure,
            type: "relance",
            description: analyse.prochaine_action.description.slice(0, 2000),
            faite: false,
            auteur_id: conv.auteur_id,
          });
        }

        // Qualification : on ne remplit que les champs restés vides.
        const { data: contact } = await sb.from("contacts")
          .select("besoin_resume, formation_envisagee, financement_envisage, interet")
          .eq("id", conv.contact_id).maybeSingle();
        if (contact) {
          const patch: Record<string, string> = {};
          if (!str(contact.besoin_resume) && analyse.besoin_resume) patch.besoin_resume = analyse.besoin_resume;
          if (!str(contact.formation_envisagee) && analyse.formation_envisagee) patch.formation_envisagee = analyse.formation_envisagee;
          if (!str(contact.financement_envisage) && analyse.financement_envisage) patch.financement_envisage = analyse.financement_envisage;
          if (!str(contact.interet) && analyse.interet) patch.interet = analyse.interet;
          if (Object.keys(patch).length) await sb.from("contacts").update(patch).eq("id", conv.contact_id);
        }
      }

      await sb.from("conversations").update({
        statut: "traitee",
        transcription,
        resume: analyse.resume,
        compte_rendu: analyse,
        action_id: actionId,
        erreur: echecs.length ? `Segment(s) ${echecs.join(", ")} illisible(s) — transcription partielle.` : null,
      }).eq("id", conversationId);
    };

    enTacheDeFond(travail().catch(async (err) => {
      await sb.from("conversations").update({
        statut: "erreur", erreur: String(err instanceof Error ? err.message : err).slice(0, 500),
      }).eq("id", conversationId);
    }));

    return json({ ok: true, statut: "traitement" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (conversationId) {
      await sb.from("conversations").update({ statut: "erreur", erreur: msg.slice(0, 500) }).eq("id", conversationId);
    }
    return json({ error: msg }, 500);
  }
});

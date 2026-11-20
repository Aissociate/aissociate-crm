// Analyse quotidienne des conversations du Studio (pg_cron « studio-ameliorations »,
// action `ameliorations_cron`) : propositions d'amélioration déposées dans
// CRM › Développement (table `tickets`, type « proposition »), seulement s'il y en a.
// Règles, filtrage et format : ameliorations_regles.ts. Chaque passage est consigné
// dans job_runs (fonction « studio-ameliorations », visible dans « Santé des jobs »).
// Les conversations ne partent que vers OpenRouter, déjà utilisé par le Studio.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import {
  consigneAnalyse, demandeAnalyse, demandeCorrection, extraireJson, FONCTION_JOB, MOTIF_CITATION, retenir, SIGNATURE, transcrire, versTicket,
  type Conversation, type Message, type Proposition,
} from "./ameliorations_regles.ts";

/** Modèle par défaut (réglable par `parametres.ai.model_ameliorations`). */
const MODELE_DEFAUT = "anthropic/claude-sonnet-4.5";
const DOMAINE_TEST = "controle.aissociate.re";

export type Bilan = {
  conversations: number; retenues: Proposition[]; rejets: { titre: string; motif: string }[];
  deposees: number; modele: string | null; message: string;
};

/** Auteur des tickets : `studio_config.ameliorations_auteur` (id de profil), sinon le premier administrateur. */
async function auteur(sb: SupabaseClient): Promise<string | null> {
  const { data: cfg } = await sb.from("studio_config").select("valeur").eq("cle", "ameliorations_auteur").maybeSingle();
  const id = String(cfg?.valeur ?? "").trim();
  if (id) return id;
  const { data } = await sb.from("profiles").select("id").eq("role", "admin").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Analyse les conversations des `heures` dernières heures ; `deposer: false` = passage à blanc. */
export async function analyser(sb: SupabaseClient, o: { heures?: number; deposer?: boolean } = {}): Promise<Bilan> {
  const heures = o.heures ?? 24;
  const depuis = new Date(Date.now() - heures * 3_600_000).toISOString();

  const { data: msgs, error } = await sb.from("studio_messages")
    .select("conversation_id, role, content, agent_id, created_at")
    .gte("created_at", depuis).order("created_at", { ascending: true }).limit(2000);
  if (error) throw new Error(`lecture des messages : ${error.message}`);
  const messages = (msgs ?? []) as Message[];
  const ids = [...new Set(messages.map((m) => m.conversation_id))];
  const vide = (message: string): Bilan => ({ conversations: 0, retenues: [], rejets: [], deposees: 0, modele: null, message });
  if (!ids.length) return vide("Aucune conversation sur la période");

  const [{ data: convs }, { data: espaces }, { data: agents }, { data: tests }] = await Promise.all([
    sb.from("studio_conversations").select("id, workspace_id, agent_id, titre, user_id").in("id", ids),
    sb.from("studio_workspaces").select("id, nom"),
    sb.from("studio_agents").select("id, prenom"),
    sb.from("studio_users").select("id").ilike("email", `%@${DOMAINE_TEST}`),
  ]);
  const transcriptions = transcrire((convs ?? []) as Conversation[], messages, {
    espaces: Object.fromEntries((espaces ?? []).map((w) => [w.id, String(w.nom ?? "").replace(/^µ/, "")])),
    agents: Object.fromEntries((agents ?? []).map((a) => [a.id, String(a.prenom)])),
    exclus: new Set((tests ?? []).map((u) => String(u.id))),
  });
  if (!transcriptions.length) return vide("Aucune conversation client sur la période");

  // Propositions déjà déposées (toutes, refusées comprises : elles ne doivent pas revenir).
  const { data: existants } = await sb.from("tickets").select("titre").eq("type", "proposition")
    .gte("created_at", new Date(Date.now() - 365 * 86_400_000).toISOString());
  const deja = (existants ?? []).map((t) => String(t.titre));

  const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
  const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
  const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
  if (!apiKey) throw new Error("clé OpenRouter absente (parametres.ai)");
  const modele = String(ai.model_ameliorations || "").trim() || MODELE_DEFAUT;

  const fil: { role: string; content: string }[] = [
    { role: "system", content: consigneAnalyse() },
    { role: "user", content: demandeAnalyse(transcriptions, deja) },
  ];
  const appeler = async (): Promise<unknown> => {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Aissociate Studio - ameliorations" },
      body: JSON.stringify({ model: modele, temperature: 0.2, max_tokens: 6000, messages: fil }),
      signal: AbortSignal.timeout(120_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`OpenRouter ${r.status} : ${String(j?.error?.message ?? "").slice(0, 200)}`);
    const contenu = String(j?.choices?.[0]?.message?.content ?? "");
    fil.push({ role: "assistant", content: contenu });
    const brut = extraireJson(contenu);
    if (brut === null) throw new Error("réponse du modèle illisible (pas de JSON)");
    return brut;
  };
  let { retenues, rejets } = retenir(await appeler(), transcriptions, deja);
  // Citations prises ailleurs que chez le client : une relance pour corriger ou retirer.
  const aCorriger = rejets.filter((x) => x.motif === MOTIF_CITATION);
  if (aCorriger.length) {
    fil.push({ role: "user", content: demandeCorrection(aCorriger) });
    try {
      ({ retenues, rejets } = retenir(await appeler(), transcriptions, deja));
    } catch (e) {
      console.error("[studio] améliorations, relance :", e instanceof Error ? e.message : String(e)); // on garde le premier tri
    }
  }

  let deposees = 0;
  if (o.deposer !== false && retenues.length) {
    const createdBy = await auteur(sb);
    if (!createdBy) throw new Error("aucun profil administrateur pour signer les propositions");
    const { error: e } = await sb.from("tickets").insert(retenues.map((p) => ({
      type: "proposition", statut: "ouvert", priorite: null, created_by: createdBy, ...versTicket(p),
    })));
    if (e) throw new Error(`dépôt des propositions : ${e.message}`);
    deposees = retenues.length;
  }
  const message = retenues.length
    ? `${transcriptions.length} conversation(s) lue(s), ${retenues.length} proposition(s) ${o.deposer === false ? "trouvée(s) (passage à blanc)" : "déposée(s)"}`
    : `${transcriptions.length} conversation(s) lue(s), aucune proposition pertinente`;
  return { conversations: transcriptions.length, retenues, rejets, deposees, modele, message };
}

/** Passage planifié : analyse, dépôt, journal (job_runs). */
export async function executer(sb: SupabaseClient, o: { heures?: number; deposer?: boolean } = {}): Promise<Bilan | null> {
  const debut = new Date();
  try {
    const b = await analyser(sb, o);
    await sb.from("job_runs").insert({
      fonction: FONCTION_JOB, started_at: debut.toISOString(), finished_at: new Date().toISOString(), ok: true,
      message: b.message,
      detail: { conversations: b.conversations, deposees: b.deposees, modele: b.modele, titres: b.retenues.map((p) => p.titre), rejets: b.rejets, signature: SIGNATURE },
    });
    return b;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[studio] analyse des conversations :", message);
    await sb.from("job_runs").insert({
      fonction: FONCTION_JOB, started_at: debut.toISOString(), finished_at: new Date().toISOString(), ok: false,
      message: `Échec : ${message}`.slice(0, 500),
    });
    return null;
  }
}

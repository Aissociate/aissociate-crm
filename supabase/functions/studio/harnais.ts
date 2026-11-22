// Harnais client généré par l'IA (docs/studio-packs-metier.md).
//
// Dès qu'un espace a un secteur d'activité (question A2 du questionnaire), l'IA produit son
// « harnais métier » : règles et interdits du métier, cas de relais, informations à connaître,
// vocabulaire, fiches de référence, cadre d'exercice de CHAQUE agent de l'équipe, et un jeu
// d'évaluation. Une seconde passe relit et corrige. Le résultat est enregistré comme pack propre
// à l'espace (studio_packs_metier, code ws-<id>) et branché aussitôt sur tous ses agents.
//
// Déclencheurs : création de l'espace (provisionner), rattrapage par taches_cron (espaces au
// statut vide), bouton « Générer le harnais » du CRM (admin_harnais).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { extraireJson } from "./ameliorations_regles.ts";
import { journaliser } from "./journal.ts";
import {
  codeHarnais, consigneGeneration, consigneRelecture, demandeGeneration, nettoyerHarnais, type Harnais,
} from "./harnais_regles.ts";

export const FONCTION_JOB = "studio-harnais";
const MODELE_DEFAUT = "anthropic/claude-sonnet-4.5";
/** Un passage « en cours » plus vieux que ça est considéré comme interrompu. */
const VERROU_MS = 30 * 60_000;
const DOMAINE_TEST = "controle.aissociate.re";

type Message = { role: string; content: string };

async function appeler(apiKey: string, modele: string, messages: Message[]): Promise<{ brut: unknown; cout: number }> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Aissociate Studio - harnais" },
    body: JSON.stringify({ model: modele, temperature: 0.2, max_tokens: 12_000, messages, usage: { include: true } }),
    // Une passe produit ~7 000 tokens (2 à 3 min). Le runtime du VPS n'impose pas la limite de 150 s.
    signal: AbortSignal.timeout(300_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenRouter ${r.status} : ${String(j?.error?.message ?? "").slice(0, 200)}`);
  const brut = extraireJson(String(j?.choices?.[0]?.message?.content ?? ""));
  if (brut === null) throw new Error("réponse du modèle illisible (pas de JSON)");
  return { brut, cout: Number(j?.usage?.cost) || 0 };
}

/** Génère (ou régénère) le harnais d'un espace. Lève une erreur si rien d'utilisable n'est produit. */
export async function generer(sb: SupabaseClient, wsId: string, o: { verrouPose?: boolean } = {}): Promise<{ version: number; metier: string; remarques: string[]; cout_usd: number }> {
  const { data: ws } = await sb.from("studio_workspaces").select("id, nom, secteur, contexte_entreprise, harnais_statut, harnais_maj").eq("id", wsId).maybeSingle();
  if (!ws) throw new Error("espace introuvable");
  const secteur = String(ws.secteur ?? "").trim();
  if (!secteur) throw new Error("secteur d'activité non renseigné");
  if (!o.verrouPose && ws.harnais_statut === "en_cours" && ws.harnais_maj && Date.now() - new Date(String(ws.harnais_maj)).getTime() < VERROU_MS) {
    throw new Error("une génération est déjà en cours pour cet espace");
  }
  await sb.from("studio_workspaces").update({ harnais_statut: "en_cours", harnais_maj: new Date().toISOString(), harnais_erreur: null }).eq("id", wsId);

  const { data: liens } = await sb.from("studio_workspace_agents").select("agent_id").eq("workspace_id", wsId).eq("actif", true);
  const ids = (liens ?? []).map((l) => String(l.agent_id));
  const { data: agents } = ids.length
    ? await sb.from("studio_agents").select("id, prenom, metier, description, super_pouvoirs").in("id", ids)
    : { data: [] as Record<string, unknown>[] };
  const equipe = (agents ?? []).map((a) => ({
    id: String(a.id), prenom: String(a.prenom ?? ""), metier: String(a.metier ?? ""), description: String(a.description ?? ""),
    missions: (Array.isArray(a.super_pouvoirs) ? a.super_pouvoirs : []).map((p: { titre?: string }) => String(p?.titre ?? "")).filter(Boolean).slice(0, 8),
  }));

  const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
  const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
  const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
  if (!apiKey) throw new Error("clé OpenRouter absente (parametres.ai)");
  const modele = String(ai.model_harnais || "").trim() || MODELE_DEFAUT;

  // 1) Génération.
  const demande = demandeGeneration({ entreprise: String(ws.nom), secteur, fiche: String(ws.contexte_entreprise ?? ""), agents: equipe });
  const g = await appeler(apiKey, modele, [{ role: "system", content: consigneGeneration() }, { role: "user", content: demande }]);
  let harnais: Harnais = nettoyerHarnais(g.brut, equipe.map((a) => a.id));
  let cout = g.cout;

  // 2) Relecture critique ; si elle échoue, on garde la première version en le signalant.
  try {
    const r = await appeler(apiKey, modele, [
      { role: "system", content: consigneRelecture() },
      { role: "user", content: `${demande}\n\nHarnais à relire :\n${JSON.stringify(harnais)}` },
    ]);
    cout += r.cout;
    harnais = nettoyerHarnais(r.brut, equipe.map((a) => a.id));
  } catch (e) {
    harnais.remarques = [...harnais.remarques, `Relecture indisponible : ${e instanceof Error ? e.message : String(e)}`.slice(0, 400)];
  }

  // 3) Enregistrement : nouvelle version publiée, les précédentes archivées, espace branché dessus.
  const code = codeHarnais(wsId);
  const { data: derniere } = await sb.from("studio_packs_metier").select("version").eq("code", code).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (Number(derniere?.version) || 0) + 1;
  const { data: pack, error } = await sb.from("studio_packs_metier").insert({
    workspace_id: wsId, origine: "ia", code, nom: harnais.nom, codes_naf: harnais.codes_naf, version, statut: "publie",
    publie_le: new Date().toISOString(), fiche_type: harnais.fiche_type, regles: harnais.regles, relais: harnais.relais,
    vocabulaire: harnais.vocabulaire, cadres: harnais.cadres, evaluation: harnais.evaluation,
    modele, cout_usd: Math.round(cout * 10_000) / 10_000, remarques: harnais.remarques,
  }).select("id").single();
  if (error || !pack) throw new Error(`enregistrement du harnais : ${error?.message ?? "inconnu"}`);
  if (harnais.savoirs.length) {
    const { error: es } = await sb.from("studio_pack_savoirs").insert(harnais.savoirs.map((s) => ({ pack_id: pack.id, ...s })));
    if (es) throw new Error(`enregistrement des fiches : ${es.message}`);
  }
  await sb.from("studio_packs_metier").update({ statut: "archive" }).eq("code", code).lt("version", version);
  await sb.from("studio_workspaces").update({
    pack_code: code, pack_version: null, harnais_statut: "pret", harnais_maj: new Date().toISOString(), harnais_erreur: null,
  }).eq("id", wsId);
  await journaliser(sb, {
    wsId, acteur: "ia", action: "harnais_genere",
    detail: { version, metier: harnais.nom, regles: harnais.regles.length, cadres: harnais.cadres.length, savoirs: harnais.savoirs.length, cout_usd: cout },
  });
  return { version, metier: harnais.nom, remarques: harnais.remarques, cout_usd: cout };
}

/** Passage tracé (job_runs) ; en cas d'échec, l'espace passe en « echec » avec le message. */
export async function executer(sb: SupabaseClient, wsId: string, o: { verrouPose?: boolean } = {}): Promise<boolean> {
  const debut = new Date();
  try {
    const r = await generer(sb, wsId, o);
    await sb.from("job_runs").insert({
      fonction: FONCTION_JOB, started_at: debut.toISOString(), finished_at: new Date().toISOString(), ok: true,
      message: `Harnais « ${r.metier} » v${r.version} généré (${r.cout_usd.toFixed(3)} $)`,
      detail: { workspace_id: wsId, ...r },
    });
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[studio] harnais :", message);
    if (!message.includes("déjà en cours")) {
      await sb.from("studio_workspaces").update({ harnais_statut: "echec", harnais_maj: new Date().toISOString(), harnais_erreur: message.slice(0, 500) }).eq("id", wsId);
    }
    await sb.from("job_runs").insert({
      fonction: FONCTION_JOB, started_at: debut.toISOString(), finished_at: new Date().toISOString(), ok: false,
      message: `Échec : ${message}`.slice(0, 500), detail: { workspace_id: wsId },
    });
    return false;
  }
}

/**
 * Lance la génération en arrière-plan (la requête HTTP rend la main tout de suite).
 * `verrouPose` : l'appelant a déjà passé l'espace « en_cours » (bouton du CRM).
 */
export function lancer(sb: SupabaseClient, wsId: string, o: { verrouPose?: boolean } = {}): void {
  const travail = executer(sb, wsId, o);
  (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(travail);
}

/**
 * À la création d'un espace : génération automatique si un secteur est renseigné. Les espaces du
 * contrôle quotidien (e-mail de test) en sont exclus, pour ne pas payer une génération par jour.
 */
export async function apresCreation(sb: SupabaseClient, wsId: string, email: string, secteur: string | null): Promise<void> {
  const test = email.toLowerCase().endsWith(`@${DOMAINE_TEST}`);
  // Colonne absente tant que la migration n'est pas appliquée : erreur ignorée, rien n'est lancé.
  const { error } = await sb.from("studio_workspaces").update({ harnais_statut: test || !secteur ? "a_lancer" : null }).eq("id", wsId);
  if (!error && !test && secteur) lancer(sb, wsId);
}

/** Rattrapage (taches_cron) : espaces avec secteur et sans harnais, 2 par passage. */
export async function rattraper(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.from("studio_workspaces").select("id").is("harnais_statut", null).not("secteur", "is", null).limit(2);
  if (error) return 0;
  for (const w of data ?? []) lancer(sb, String(w.id));
  return (data ?? []).length;
}

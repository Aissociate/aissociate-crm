// Studio IA — tâches planifiées, lots de documents et routines. Extrait de index.ts (même code).
import { type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import * as veille from "./veille.ts";
import * as bureau from "./bureau.ts";
import { consigneTache, libellePlanning, MODELES_TACHES, planningValide, prochaineExecution } from "./taches.ts";
import { AVIS_ESSAI, bilanPassages, chaine, consigneDe, consigneModele, consigneProposition, enClair, erreurReglages, etapesEnregistrees, historique, modeleDe, modelesPour, NOMS_CAPACITES, reglagesDe, TONS, validerProposition, type Capacite, type Passage, type RoutineBrute, type ServiceRelie } from "./routines.ts";
import { extraireJson } from "./ameliorations_regles.ts";
import { garde, journaliser, soumettreLivrable } from "./gouvernance.ts";
import { type CarnetEssai } from "./outils.ts";
import * as zernio from "./zernio.ts";
import * as essai from "./essai.ts";
import * as routineChat from "./routine_outil.ts";
import * as lots from "./lots.ts";
import { json, MODELE_DEFAUT, autorise, type Session, acteurDe } from "./socle.ts";
import { agentsDuWorkspace } from "./etats.ts";
import { chat, executeurMail } from "./chat.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Tâches planifiées
// ─────────────────────────────────────────────────────────────────────────────

export const SELECT_TACHE = "id, titre, agent_id, consigne, heures, jours, actif, prochaine_execution, en_cours_depuis, derniere_execution, dernier_statut, dernier_compte_rendu, conversation_id, user_id";
/** Une exécution bloquée plus longtemps est considérée comme perdue. */
export const TACHE_BLOCAGE_MS = 15 * 60_000;

export async function cleCron(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.from("studio_cron_cle").select("cle").eq("id", 1).maybeSingle();
  return (data?.cle as string | undefined) ?? null;
}

/** Colonnes des routines (lot 4 de la refonte). */
export const SELECT_ROUTINE = `${SELECT_TACHE}, etapes, modele, reglages, essai_jusqu_au, essai_signale, reprise_prevue, created_at`;
/** Migration des routines pas encore appliquée (colonne ou table inconnue) : on retombe sur l'ancien fonctionnement. */
export const schemaRoutinesAbsent = (e: { message?: string; code?: string } | null | undefined) =>
  Boolean(e && /etapes|modele|reglages|essai_|reprise_prevue|studio_routine_passages|PGRST20[45]|42703|42P01/.test(`${e.code ?? ""} ${e.message ?? ""}`));
/** Une seule reprise automatique après un échec, une heure plus tard. */
export const REPRISE_MS = 3_600_000;
export const ESSAI_JOURS = routineChat.ESSAI_JOURS;

export type OptionsPassage = { essai?: boolean; tentative?: number; manuel?: boolean };

/** Lance une tâche dans sa propre instance de la fonction (la réponse revient tout de suite). */
export async function declencherTache(cle: string, id: string, o: OptionsPassage = {}): Promise<void> {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/studio`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "tache_executer", cle, id, ...o }),
  }).then((r) => r.body?.cancel()).catch((e) => console.error("[studio] tâche:", e instanceof Error ? e.message : String(e)));
}

/** Prénoms de tous les agents (phrases des routines). */
export async function prenomsAgents(sb: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await sb.from("studio_agents").select("id, prenom");
  return new Map((data ?? []).map((a) => [String(a.id), String(a.prenom)]));
}

/**
 * Passage d'une routine : réservation (une seule instance à la fois), mission, compte rendu,
 * ligne d'historique. En mode essai, rien n'est soumis ni envoyé (outils.ts › CarnetEssai) et la
 * conversation est à part, pour que l'agent ne croie pas avoir déjà proposé ce qu'il a seulement montré.
 * Un échec est retenté une fois, une heure plus tard (tachesEchues).
 */
export async function executerTache(sb: SupabaseClient, id: string, o: OptionsPassage = {}): Promise<void> {
  const maintenant = new Date();
  const limite = new Date(maintenant.getTime() - TACHE_BLOCAGE_MS).toISOString();
  const reserver = (colonnes: string) => sb.from("studio_taches").update({ en_cours_depuis: maintenant.toISOString() })
    .eq("id", id).or(`en_cours_depuis.is.null,en_cours_depuis.lt.${limite}`).select(`${colonnes}, workspace_id`).maybeSingle();
  let { data, error } = await reserver(SELECT_ROUTINE);
  if (error && schemaRoutinesAbsent(error)) ({ data, error } = await reserver(SELECT_TACHE));
  const t = data as Record<string, unknown> | null;
  if (!t) return; // déjà en cours ailleurs
  const essaiEnCours = typeof t.essai_jusqu_au === "string" && Date.parse(t.essai_jusqu_au) > maintenant.getTime();
  const enEssai = o.essai === true || essaiEnCours;
  const tentative = o.tentative === 2 ? 2 : 1;
  const planning = { heures: t.heures as number[], jours: t.jours as number[] };
  const prochaine = t.actif ? prochaineExecution(planning, maintenant) : null;
  const carnet: CarnetEssai | null = enEssai ? { propositions: [] } : null;

  // Ligne d'historique (table absente avant la migration : on continue sans).
  const { data: passage } = await sb.from("studio_routine_passages").insert({
    workspace_id: t.workspace_id, tache_id: id, debut: maintenant.toISOString(), tentative, essai: enEssai, manuel: o.manuel === true,
  }).select("id").maybeSingle();

  const prenoms = await prenomsAgents(sb);
  const routine = { ...(t as unknown as RoutineBrute), consigne: String(t.consigne) };
  const consigne = consigneDe(routine, prenoms) + (enEssai ? `\n\n${AVIS_ESSAI}` : "");
  let statut: "ok" | "erreur" = "erreur", compteRendu = "";
  let conversationId = enEssai ? null : (t.conversation_id as string | null);
  try {
    const r = await executeurMail(sb, "tache")(String(t.user_id), {
      agent_id: t.agent_id, message: consigneTache(String(t.titre), consigne, maintenant), conversation_id: conversationId,
      ...(carnet ? { essai: carnet } : {}),
    });
    if (r.ok) { statut = "ok"; compteRendu = r.texte; conversationId = r.conversation_id ?? conversationId; }
    else compteRendu = r.erreur;
  } catch (e) {
    compteRendu = e instanceof Error ? e.message : String(e);
  }

  // Propositions réellement déposées dans « Aujourd'hui » pendant ce passage.
  let nbLivrables = 0;
  if (!enEssai && statut === "ok" && conversationId) {
    const { count } = await sb.from("studio_livrables").select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId).gte("created_at", maintenant.toISOString());
    nbLivrables = count ?? 0;
  }
  if (passage?.id) {
    await sb.from("studio_routine_passages").update({
      fin: new Date().toISOString(), statut, compte_rendu: compteRendu.slice(0, 4000),
      propositions: carnet?.propositions ?? [], nb_livrables: nbLivrables, conversation_id: conversationId,
    }).eq("id", passage.id);
  }
  const reprendre = statut === "erreur" && tentative === 1 && !o.manuel && !o.essai && Boolean(t.actif);
  await sb.from("studio_taches").update({
    en_cours_depuis: null, derniere_execution: maintenant.toISOString(), dernier_statut: statut,
    dernier_compte_rendu: compteRendu.slice(0, 4000),
    // Un essai a sa propre conversation : celle de la routine reste celle des vrais passages.
    ...(enEssai ? {} : { conversation_id: conversationId }),
    ...(t.actif ? { prochaine_execution: prochaine?.toISOString() ?? null } : {}),
  }).eq("id", id);
  if (reprendre) {
    await sb.from("studio_taches").update({ reprise_prevue: new Date(maintenant.getTime() + REPRISE_MS).toISOString() }).eq("id", id);
  }
  await journaliser(sb, {
    wsId: String(t.workspace_id), acteur: "tache", agentId: String(t.agent_id), action: "tache_executee",
    detail: {
      tache: id, titre: t.titre, statut, conversation: conversationId, essai: enEssai, tentative,
      propositions: carnet ? carnet.propositions.length : nbLivrables, erreur: statut === "erreur" ? compteRendu.slice(0, 300) : null,
    },
  });
}

/**
 * Fin des 7 jours d'essai : rien ne se met en route tout seul. Une décision « la mettre en
 * route ? » arrive dans « Aujourd'hui » ; d'ici là, la routine continue de tourner à blanc.
 */
export async function signalerFinsEssai(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb.from("studio_taches").select("id, workspace_id, titre, agent_id")
    .eq("essai_signale", false).lte("essai_jusqu_au", new Date().toISOString()).limit(50);
  if (error) return 0; // migration pas encore appliquée
  let deposees = 0;
  for (const t of data ?? []) {
    const { data: ok } = await sb.from("studio_taches").update({ essai_signale: true })
      .eq("id", t.id).eq("essai_signale", false).select("id").maybeSingle();
    if (!ok) continue;
    const { data: passages } = await sb.from("studio_routine_passages")
      .select("debut, fin, statut, tentative, essai, manuel, compte_rendu, propositions, nb_livrables")
      .eq("tache_id", t.id).order("debut", { ascending: false }).limit(30);
    const lignes = historique((passages ?? []) as Passage[]);
    const contenu = [
      `Pendant ${ESSAI_JOURS} jours, la routine « ${t.titre} » vous a montré ce qu'elle aurait fait, sans rien envoyer.`,
      lignes.length ? lignes.slice(0, 7).map((l) => `- ${new Date(l.date).toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion", weekday: "short", day: "numeric", month: "short" })} : ${l.texte}`).join("\n") : "Elle n'a pas encore eu l'occasion de tourner.",
      "En la mettant en route, elle agit pour de vrai. Vous validez toujours avant que quoi que ce soit parte. Sans réponse de votre part, elle continue à l'essai.",
    ].join("\n\n");
    const { data: l } = await sb.from("studio_livrables").insert({
      workspace_id: t.workspace_id, agent_id: t.agent_id, titre: `Routine — ${t.titre}`.slice(0, 200), contenu, soumis_par: "routine",
      action: { type: "routine_activer", tache_id: t.id, titre: t.titre, contenu },
    }).select("id").maybeSingle();
    await journaliser(sb, { wsId: String(t.workspace_id), acteur: "tache", agentId: String(t.agent_id), action: "routine_essai_termine", detail: { tache: t.id, titre: t.titre, livrable: l?.id ?? null } });
    deposees++;
  }
  return deposees;
}

/** Passage horaire : chaque tâche échue est avancée à son prochain créneau, puis lancée. */
export async function tachesEchues(sb: SupabaseClient, cle: string): Promise<number> {
  const lancees = await tachesPlanifiees(sb, cle);
  // Reprises : un passage en échec est retenté une fois, une heure plus tard.
  let reprises = 0;
  const { data: aReprendre, error } = await sb.from("studio_taches").select("id, reprise_prevue")
    .eq("actif", true).lte("reprise_prevue", new Date().toISOString()).limit(50);
  if (!error) {
    for (const t of aReprendre ?? []) {
      const { data: ok } = await sb.from("studio_taches").update({ reprise_prevue: null })
        .eq("id", t.id).eq("reprise_prevue", t.reprise_prevue).select("id").maybeSingle();
      if (!ok) continue;
      await declencherTache(cle, String(t.id), { tentative: 2 });
      reprises++;
    }
  }
  await signalerFinsEssai(sb);
  return lancees + reprises;
}

export async function tachesPlanifiees(sb: SupabaseClient, cle: string): Promise<number> {
  const maintenant = new Date();
  const { data } = await sb.from("studio_taches").select("id, heures, jours, prochaine_execution")
    .eq("actif", true).lte("prochaine_execution", maintenant.toISOString()).order("prochaine_execution").limit(50);
  let lancees = 0;
  for (const t of data ?? []) {
    const suivante = prochaineExecution({ heures: t.heures as number[], jours: t.jours as number[] }, maintenant);
    // Réservation : seul le passage qui avance l'échéance lance la tâche.
    const { data: ok } = await sb.from("studio_taches").update({ prochaine_execution: suivante?.toISOString() ?? null })
      .eq("id", t.id).eq("prochaine_execution", t.prochaine_execution).select("id").maybeSingle();
    if (!ok) continue;
    await declencherTache(cle, String(t.id));
    lancees++;
  }
  return lancees;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lots de documents confiés à un agent (lots.ts) : une instance par étape, en chaîne
// ─────────────────────────────────────────────────────────────────────────────

export type EtapeLot = {
  ws: string; user: string; agent: string; consigne: string; mode: lots.ModeLot;
  ids: string[]; index: number; echecs: { titre: string; erreur: string }[];
};

/** Lance l'étape suivante dans sa propre instance (la réponse revient tout de suite). */
export async function declencherLot(cle: string, etape: EtapeLot): Promise<void> {
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/studio`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "lot_etape", cle, etape }),
  }).then((r) => r.body?.cancel()).catch((e) => console.error("[studio] lot:", e instanceof Error ? e.message : String(e)));
}

/**
 * Une étape : un document (« un résultat par document ») ou tous (« une synthèse »), lus par l'agent
 * comme pièces jointes, la réponse soumise en livrable dans « Aujourd'hui ». Puis l'étape suivante ;
 * à la fin, un bilan seulement s'il y a eu des échecs.
 */
export async function executerEtapeLot(sb: SupabaseClient, cle: string, e: EtapeLot): Promise<void> {
  const ids = e.mode === "synthese" ? e.ids : e.ids.slice(e.index, e.index + 1);
  const { data } = await sb.from("studio_documents").select("id, titre, contenu, actif, sensible")
    .eq("workspace_id", e.ws).in("id", ids);
  const parId = new Map(((data ?? []) as lots.DocLot[]).map((d) => [d.id, d]));
  const docs = ids.map((id) => parId.get(id)).filter((d): d is lots.DocLot => Boolean(d && lots.lisible(d)));
  const titres = docs.map((d) => d.titre);
  const objet = e.mode === "synthese" ? `Synthèse de ${ids.length} documents` : (parId.get(ids[0])?.titre ?? "Document supprimé");
  if (!docs.length) {
    e.echecs.push({ titre: objet, erreur: "document supprimé ou désactivé entre-temps" });
  } else {
    try {
      const r = await executeurMail(sb, "tache")(e.user, {
        agent_id: e.agent, message: lots.messageLot(e.consigne, e.mode, titres), pieces: lots.piecesLot(docs, e.mode),
      });
      if (!r.ok) e.echecs.push({ titre: objet, erreur: r.erreur });
      else if (!r.message_id || !r.conversation_id) e.echecs.push({ titre: objet, erreur: "réponse vide" });
      else {
        await sb.from("studio_conversations").update({ titre: lots.titreLot(e.consigne, e.mode, titres) }).eq("id", r.conversation_id);
        const l = await soumettreLivrable(sb, e.ws, "lot", r.message_id);
        if ("erreur" in l) e.echecs.push({ titre: objet, erreur: String(l.erreur) });
      }
    } catch (err) {
      e.echecs.push({ titre: objet, erreur: err instanceof Error ? err.message : String(err) });
    }
  }

  const suivant = e.index + 1;
  if (e.mode === "chaque" && suivant < e.ids.length) {
    await declencherLot(cle, { ...e, index: suivant });
    return;
  }
  const total = e.mode === "synthese" ? 1 : e.ids.length;
  if (e.echecs.length) {
    await sb.from("studio_livrables").insert({
      workspace_id: e.ws, agent_id: e.agent, soumis_par: "lot",
      titre: `Traitement en lot — ${e.echecs.length} document${e.echecs.length > 1 ? "s" : ""} non traité${e.echecs.length > 1 ? "s" : ""}`,
      contenu: lots.bilanEchecs(e.consigne, e.mode === "synthese" ? e.ids.length : total, e.echecs),
    });
  }
  await journaliser(sb, {
    wsId: e.ws, acteur: "lot", agentId: e.agent, action: "lot_termine",
    detail: { mode: e.mode, documents: e.ids.length, echecs: e.echecs.length },
  });
}

/** Tâches de l'espace, avec leur planning lisible. */
export async function listerTaches(sb: SupabaseClient, wsId: string) {
  const { data } = await sb.from("studio_taches").select(SELECT_TACHE).eq("workspace_id", wsId).order("created_at");
  return {
    taches: (data ?? []).map((t) => ({
      ...t, user_id: undefined,
      planning: libellePlanning({ heures: t.heures as number[], jours: t.jours as number[] }),
      en_cours: Boolean(t.en_cours_depuis && Date.parse(String(t.en_cours_depuis)) > Date.now() - TACHE_BLOCAGE_MS),
    })),
    modeles: MODELES_TACHES,
  };
}

export async function enregistrerTache(sb: SupabaseClient, s: Session, body: Record<string, unknown>) {
  const titre = String(body.titre ?? "").trim().slice(0, 120);
  const consigne = String(body.consigne ?? "").trim().slice(0, 4000);
  if (!titre || !consigne) return { erreur: "Titre et consigne requis." };
  const agents = await agentsDuWorkspace(sb, s.ws);
  if (!agents.some((a) => a.id === body.agent_id)) return { erreur: "Agent indisponible pour votre offre." };
  const p = planningValide({ heures: body.heures, jours: body.jours });
  if ("erreur" in p) return p;
  const actif = body.actif !== false;
  const champs = {
    titre, consigne, agent_id: String(body.agent_id), heures: p.heures, jours: p.jours, actif,
    prochaine_execution: actif ? prochaineExecution(p, new Date())?.toISOString() ?? null : null,
  };
  if (typeof body.id === "string") {
    const { data, error } = await sb.from("studio_taches").update(champs).eq("id", body.id).eq("workspace_id", s.ws.id).select("id").maybeSingle();
    if (error || !data) return { erreur: error?.message ?? "Tâche introuvable." };
  } else {
    const { count } = await sb.from("studio_taches").select("id", { count: "exact", head: true }).eq("workspace_id", s.ws.id);
    if ((count ?? 0) >= 20) return { erreur: "20 tâches planifiées au maximum par espace." };
    const { error } = await sb.from("studio_taches").insert({ ...champs, workspace_id: s.ws.id, user_id: s.user.id });
    if (error) return { erreur: error.message };
  }
  await journaliser(sb, {
    wsId: s.ws.id, acteur: acteurDe(s), agentId: champs.agent_id, action: "tache_enregistree",
    detail: { titre, planning: libellePlanning(p), actif, modification: typeof body.id === "string" },
  });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Routines (refonte §3.4, §3.5) : la tâche planifiée vue comme une chaîne d'étapes
// ─────────────────────────────────────────────────────────────────────────────

export const SELECT_PASSAGE = "tache_id, debut, fin, statut, tentative, essai, manuel, compte_rendu, propositions, nb_livrables";

/** Outils reliés à l'espace, au sens des routines (ce dont un modèle a besoin). */
export async function capacitesEspace(sb: SupabaseClient, wsId: string): Promise<Capacite[]> {
  const zernioOk = zernio.zernioConfigure();
  const [boites, comptes, { count }] = await Promise.all([
    zernioOk ? bureau.boitesEspace(wsId).catch(() => [] as bureau.Boite[]) : Promise.resolve([] as bureau.Boite[]),
    zernioOk ? zernio.comptesEspace(wsId).catch(() => [] as zernio.CompteReseau[]) : Promise.resolve([] as zernio.CompteReseau[]),
    sb.from("studio_flux").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).eq("actif", true),
  ]);
  const c: Capacite[] = [];
  if (bureau.boitePour(boites, "email")) c.push("mail");
  if (bureau.boitePour(boites, "calendar")) c.push("agenda");
  if (comptes.length) c.push("reseaux");
  if ((count ?? 0) > 0) c.push("veille");
  return c;
}

/** API et serveurs MCP « connecté » de l'espace, pour proposer des routines qui s'en servent. */
export async function servicesRelies(sb: SupabaseClient, wsId: string): Promise<ServiceRelie[]> {
  const { data } = await sb.from("studio_connecteurs").select("type, infos").eq("workspace_id", wsId).eq("statut", "connecte")
    .or("type.eq.mcp,type.like.mcp:*,type.like.api:*");
  return (data ?? []).map((c) => {
    const i = (c.infos ?? {}) as Record<string, string>;
    const api = String(c.type).startsWith("api:");
    return { nom: i.nom || String(c.type).replace(/^(api|mcp):?/, "") || "Serveur MCP", genre: api ? "API" as const : "serveur MCP" as const, description: i.description };
  });
}

/** Une routine telle que l'affiche l'écran Routine. */
export function vueRoutine(t: Record<string, unknown>, prenoms: Map<string, string>, passages: Passage[]) {
  const m = modeleDe(t.modele);
  const brute = t as unknown as RoutineBrute;
  const etapes = chaine(brute, prenoms);
  const lignes = passages.length ? historique(passages)
    // Avant la migration : seul le dernier passage est connu.
    : t.derniere_execution ? historique([{
      debut: String(t.derniere_execution), statut: t.dernier_statut === "ok" ? "ok" : "erreur", tentative: 2, essai: false,
      compte_rendu: t.dernier_compte_rendu as string | null,
    }]) : [];
  const essaiJusquAu = typeof t.essai_jusqu_au === "string" && t.essai_jusqu_au ? t.essai_jusqu_au : null;
  return {
    id: t.id, titre: t.titre, agent_id: t.agent_id, actif: t.actif, modele: m?.id ?? null,
    reglages: m ? reglagesDe(m, t.reglages) : ((t.reglages ?? {}) as Record<string, unknown>),
    heures: t.heures, jours: t.jours, planning: libellePlanning({ heures: t.heures as number[], jours: t.jours as number[] }),
    prochaine_execution: t.prochaine_execution, derniere_execution: t.derniere_execution, cree_le: t.created_at ?? null,
    essai_jusqu_au: essaiJusquAu, essai_termine: Boolean(essaiJusquAu && Date.parse(essaiJusquAu) <= Date.now()),
    en_cours: Boolean(t.en_cours_depuis && Date.parse(String(t.en_cours_depuis)) > Date.now() - TACHE_BLOCAGE_MS),
    etapes, en_clair: enClair(etapes), historique: lignes.slice(0, 20), bilan: bilanPassages(lignes),
    // Ancienne tâche planifiée : la consigne écrite à l'époque reste lisible.
    consigne_origine: !m && !etapesEnregistrees(t.etapes) ? t.consigne : null,
    conversation_id: t.conversation_id,
  };
}

export async function listerRoutines(sb: SupabaseClient, wsId: string) {
  let migree = true;
  // `colonnes: string` : les deux lectures (avec ou sans colonnes de routine) ont le même type.
  const lire = (colonnes: string) => sb.from("studio_taches").select(colonnes).eq("workspace_id", wsId).order("created_at");
  let { data, error } = await lire(SELECT_ROUTINE);
  if (error && schemaRoutinesAbsent(error)) {
    migree = false;
    ({ data, error } = await lire(SELECT_TACHE));
  }
  const lignes = (data ?? []) as unknown as Record<string, unknown>[];
  const ids = lignes.map((t) => String(t.id));
  const { data: passages } = migree && ids.length
    ? await sb.from("studio_routine_passages").select(SELECT_PASSAGE).in("tache_id", ids).order("debut", { ascending: false }).limit(400)
    : { data: [] as Record<string, unknown>[] };
  const parTache = new Map<string, Passage[]>();
  for (const p of passages ?? []) {
    const k = String(p.tache_id);
    if (!parTache.has(k)) parTache.set(k, []);
    if (parTache.get(k)!.length < 30) parTache.get(k)!.push(p as unknown as Passage);
  }
  const prenoms = await prenomsAgents(sb);
  return { routines: lignes.map((t) => vueRoutine(t, prenoms, parTache.get(String(t.id)) ?? [])), installees: migree };
}

/** Lecture d'une routine de l'espace (toutes colonnes, ou colonnes d'avant la migration). */
export async function lireRoutine(sb: SupabaseClient, wsId: string, id: string) {
  const lire = (colonnes: string) => sb.from("studio_taches").select(colonnes).eq("id", id).eq("workspace_id", wsId).maybeSingle();
  let { data, error } = await lire(SELECT_ROUTINE);
  if (error && schemaRoutinesAbsent(error)) ({ data, error } = await lire(SELECT_TACHE));
  return (data ?? null) as Record<string, unknown> | null;
}

/** Réglages, planning ou état d'une routine (chaque clic de l'écran Routine l'enregistre). */
export async function reglerRoutine(sb: SupabaseClient, s: Session, body: Record<string, unknown>): Promise<{ ok: true } | { erreur: string }> {
  const t = await lireRoutine(sb, s.ws.id, String(body.id ?? ""));
  if (!t) return { erreur: "Routine introuvable." };
  const champs: Record<string, unknown> = {};
  const journal: Record<string, unknown> = {};
  const m = modeleDe(t.modele);
  if (body.reglages && typeof body.reglages === "object") {
    const recus = body.reglages as Record<string, unknown>;
    if (m) {
      const fusion = { ...reglagesDe(m, t.reglages), ...recus };
      const erreur = erreurReglages(m, fusion);
      if (erreur) return { erreur };
      const r = reglagesDe(m, fusion);
      champs.reglages = r;
      champs.consigne = consigneModele(m, r, await prenomsAgents(sb)).slice(0, 4000);
      journal.reglages = r;
    } else if (etapesEnregistrees(t.etapes)) {
      // Routine proposée par Léa : seul le ton se règle ici ; le reste se demande à Léa.
      if (typeof recus.ton !== "string" || !(recus.ton in TONS)) return { erreur: "Réglage inconnu." };
      champs.reglages = { ...((t.reglages ?? {}) as Record<string, unknown>), ton: recus.ton };
      journal.reglages = champs.reglages;
    } else return { erreur: "Cette ancienne tâche ne se règle pas étape par étape : demandez à Léa de la refaire en routine." };
  }
  let planning = { heures: t.heures as number[], jours: t.jours as number[] };
  if (body.heures !== undefined || body.jours !== undefined) {
    const p = planningValide({ heures: body.heures ?? t.heures, jours: body.jours ?? t.jours });
    if ("erreur" in p) return p;
    planning = p;
    champs.heures = p.heures;
    champs.jours = p.jours;
    journal.planning = libellePlanning(p);
  }
  const actif = typeof body.actif === "boolean" ? body.actif : Boolean(t.actif);
  if (typeof body.actif === "boolean") { champs.actif = actif; journal.actif = actif; }
  if (champs.heures || typeof body.actif === "boolean") {
    champs.prochaine_execution = actif ? prochaineExecution(planning, new Date())?.toISOString() ?? null : null;
  }
  if (!Object.keys(champs).length) return { ok: true };
  const { error } = await sb.from("studio_taches").update(champs).eq("id", t.id).eq("workspace_id", s.ws.id);
  if (error) return { erreur: error.message };
  await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), agentId: String(t.agent_id), action: "routine_reglee", detail: { tache: t.id, titre: t.titre, ...journal } });
  return { ok: true };
}

/** Galerie « Nouvelle routine » : modèles que l'équipe sait faire, et ce qui manque pour chacun. */
export async function galerieRoutines(sb: SupabaseClient, s: Session) {
  const [agents, capacites] = await Promise.all([agentsDuWorkspace(sb, s.ws), capacitesEspace(sb, s.ws.id)]);
  const prenoms = new Map(agents.map((a) => [String(a.id), String(a.prenom)]));
  return {
    capacites,
    modeles: modelesPour(agents.map((a) => String(a.id))).map((m) => {
      const etapes = chaine({ titre: m.titre, agent_id: m.agent, heures: m.planning.heures, jours: m.planning.jours, modele: m.id, reglages: {} }, prenoms);
      return {
        id: m.id, agent: m.agent, titre: m.titre, gain: m.gain, etapes, en_clair: enClair(etapes),
        question: { texte: m.question.texte, reponses: m.question.reponses.map((r) => r.libelle), saisie: m.question.saisie ? { libelle: m.question.saisie.libelle } : null },
        manque: m.requiert.filter((c) => !capacites.includes(c)).map((c) => NOMS_CAPACITES[c]),
      };
    }),
  };
}

/** « Quelle tâche ne voulez-vous plus faire vous-même ? » → Léa propose une chaîne et pose une question. */
export async function proposerRoutine(sb: SupabaseClient, s: Session, demande: string) {
  const texte = demande.trim().slice(0, 2000);
  if (texte.length < 8) return { erreur: "Décrivez la tâche en une phrase." };
  const refus = await garde(sb, s.ws.id);
  if (refus) return { erreur: refus.message };
  const [agents, capacites, services, { data: aiRow }] = await Promise.all([
    agentsDuWorkspace(sb, s.ws), capacitesEspace(sb, s.ws.id), servicesRelies(sb, s.ws.id).catch(() => [] as ServiceRelie[]),
    sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle(),
  ]);
  const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
  const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
  if (!apiKey) return { erreur: "Service IA non configuré. Contactez Aissociate." };
  const equipeDispo = agents.map((a) => ({ id: String(a.id), prenom: String(a.prenom), metier: String(a.metier) }));
  const modele = autorise(ai.model_plan) ?? autorise(ai.model_studio) ?? MODELE_DEFAUT;
  let contenu = "";
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Aissociate Studio - routines" },
      body: JSON.stringify({
        model: modele, temperature: 0.2, max_tokens: 4000,
        messages: [{ role: "system", content: consigneProposition(equipeDispo, capacites, services) }, { role: "user", content: texte }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    contenu = String(j?.choices?.[0]?.message?.content ?? "");
  } catch (e) {
    console.error("[studio] routine proposée :", e instanceof Error ? e.message : String(e));
    return { erreur: "Léa n'a pas pu répondre. Réessayez dans un instant, ou partez d'une routine prête à l'emploi." };
  }
  const brut = extraireJson(contenu);
  const v = brut === null ? { erreur: "Léa n'a pas pu proposer de routine pour cette tâche. Reformulez-la en une phrase." } : validerProposition(brut, equipeDispo);
  if ("erreur" in v) return v;
  const prenoms = new Map(equipeDispo.map((a) => [a.id, a.prenom]));
  const etapes = chaine({ titre: v.titre, agent_id: v.agent, heures: v.planning.heures, jours: v.planning.jours, etapes: v.etapes }, prenoms);
  await journaliser(sb, { wsId: s.ws.id, acteur: acteurDe(s), agentId: "lea", action: "routine_proposee", detail: { demande: texte.slice(0, 300), titre: v.titre } });
  return { proposition: v, etapes, en_clair: enClair(etapes) };
}

/** Mise en place d'une routine (modèle ou proposition de Léa), en mode essai pendant 7 jours. */
export async function creerRoutine(sb: SupabaseClient, s: Session, body: Record<string, unknown>): Promise<{ id: string } | { erreur: string; statut?: number }> {
  const agents = await agentsDuWorkspace(sb, s.ws);
  const ids = agents.map((a) => String(a.id));
  const prenoms = new Map(agents.map((a) => [String(a.id), String(a.prenom)]));
  const reponse = Number(body.reponse);
  const saisie = typeof body.saisie === "string" ? body.saisie.trim().slice(0, 200) : "";
  let ligne: Record<string, unknown>;
  const m = modeleDe(body.modele);
  if (m) {
    if (!modelesPour(ids).includes(m)) return { erreur: "Ce modèle demande un agent qui n'est pas dans votre équipe." };
    let choix: Record<string, unknown> = {};
    if (saisie && m.question.saisie) choix = { [m.question.saisie.id]: saisie, ...m.question.saisie.reglages };
    else if (Number.isInteger(reponse) && m.question.reponses[reponse]) choix = m.question.reponses[reponse].reglages;
    const erreur = erreurReglages(m, { ...reglagesDe(m, {}), ...choix });
    if (erreur) return { erreur };
    const r = reglagesDe(m, choix);
    ligne = {
      titre: m.titre, agent_id: m.agent, modele: m.id, reglages: r, etapes: null, heures: m.planning.heures, jours: m.planning.jours,
      consigne: consigneModele(m, r, prenoms).slice(0, 4000),
    };
  } else {
    const v = validerProposition(body.proposition, agents.map((a) => ({ id: String(a.id), prenom: String(a.prenom) })));
    if ("erreur" in v) return v;
    const choisie = Number.isInteger(reponse) ? v.question.reponses[reponse] : undefined;
    const precision = saisie || choisie;
    ligne = {
      titre: v.titre, agent_id: v.agent, modele: null, reglages: {}, etapes: v.etapes, heures: v.planning.heures, jours: v.planning.jours,
      consigne: `${v.consigne}${precision ? `\n\nRéponse du dirigeant à « ${v.question.texte} » : ${precision}` : ""}`.slice(0, 4000),
    };
  }
  const { count } = await sb.from("studio_taches").select("id", { count: "exact", head: true }).eq("workspace_id", s.ws.id);
  if ((count ?? 0) >= 20) return { erreur: "20 routines au maximum par espace : mettez-en une en pause ou supprimez-la." };
  const maintenant = new Date();
  const { data, error } = await sb.from("studio_taches").insert({
    ...ligne, workspace_id: s.ws.id, user_id: s.user.id, actif: true,
    essai_jusqu_au: new Date(maintenant.getTime() + ESSAI_JOURS * 86_400_000).toISOString(),
    prochaine_execution: prochaineExecution({ heures: ligne.heures as number[], jours: ligne.jours as number[] }, maintenant)?.toISOString() ?? null,
  }).select("id").single();
  if (error) {
    return schemaRoutinesAbsent(error)
      ? { erreur: "Les routines sont en cours d'installation sur votre espace : réessayez dans quelques minutes.", statut: 503 }
      : { erreur: error.message };
  }
  await journaliser(sb, {
    wsId: s.ws.id, acteur: acteurDe(s), agentId: String(ligne.agent_id), action: "routine_creee",
    detail: { tache: data.id, titre: ligne.titre, modele: ligne.modele, essai_jours: ESSAI_JOURS },
  });
  return { id: String(data.id) };
}

// Traitement d'un e-mail reçu sur la boîte de liaison d'un espace (webhook
// AgentMail « message.received », signature vérifiée par l'appelant).
//
// Ordre des garde-fous (repris du paquet, AIS-LIAISON) :
//   1. boîte inconnue ou canal désactivé       → ignoré, rien n'est enregistré
//   2. événement déjà vu (event_id)             → ignoré (webhook rejoué)
//   3. e-mail de la boîte elle-même, retour d'échec, réponse automatique → ignoree
//   4. plus de 30 messages / heure sur l'espace → ignoree (boucle ou abus)
//   5. expéditeur hors utilisateurs actifs, ou mal authentifié (SPF/DKIM/DMARC) → quarantaine, muet
//   6. signaux de fraude (IBAN, virement, cartes) → quarantaine, jamais exécuté ;
//      une demande de SUSPENSION dans le même message s'applique quand même
//   7. SUSPENDRE / REPRENDRE / VALIDÉ L-xxxx    → réservés au propriétaire
//   8. sinon : mission confiée à l'agent désigné, réponse dans le fil,
//      résultat soumis à validation (livrable) — rien n'est envoyé à un tiers.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { repondre } from "./agentmail.ts";
import {
  adresse, authentificationDouteuse, automatique, choisirAgent, corpsUtile, decisions, refLivrable,
  signauxFraude, sujetPropre, typer,
} from "./liaison.ts";
import { deciderLivrable, journaliser, soumettreLivrable, suspendre } from "./gouvernance.ts";

export type MessageRecu = {
  message_id: string; inbox_id: string; thread_id?: string; from: string; subject?: string;
  text?: string; extracted_text?: string; preview?: string; headers?: Record<string, string>;
  authentication_results?: { spf?: string; dkim?: string; dmarc?: string };
};

/** Mission exécutée par la fonction (chat de l'Edge Function, réutilisé tel quel). */
export type Executeur = (userId: string, body: Record<string, unknown>) => Promise<
  { ok: true; texte: string; message_id: string | null; conversation_id: string | null } | { ok: false; erreur: string }
>;

const LIMITE_HEURE = 30;

export async function traiterMail(
  sb: SupabaseClient, eventId: string, m: MessageRecu, executer: Executeur,
  equipeOuverte: (wsId: string) => Promise<{ id: string; prenom: string }[]>,
): Promise<void> {
  const { data: ws } = await sb.from("studio_workspaces")
    .select("id, nom, actif, liaison_actif, liaison_email, liaison_agent").eq("liaison_inbox_id", m.inbox_id).maybeSingle();
  if (!ws || !ws.actif || !ws.liaison_actif) return;

  const de = adresse(m.from ?? "");
  const sujet = String(m.subject ?? "").slice(0, 300);
  const texte = (m.extracted_text?.trim() || corpsUtile(String(m.text ?? "")) || String(m.preview ?? "")).slice(0, 8000);

  const { data: instr, error } = await sb.from("studio_instructions").insert({
    workspace_id: ws.id, event_id: eventId, message_id: m.message_id, thread_id: m.thread_id ?? null,
    expediteur: de, sujet, extrait: texte.slice(0, 500), type: typer(sujet, texte),
  }).select("id, reference, type").single();
  if (error) return; // 23505 : événement déjà traité (webhook rejoué)

  const ref = instr.reference as string;
  const clore = async (statut: string, motif: string | null, extra: Record<string, unknown> = {}) => {
    await sb.from("studio_instructions").update({ statut, motif, ...extra }).eq("id", instr.id);
    await journaliser(sb, {
      wsId: ws.id, acteur: `mail:${de}`, agentId: (extra.agent_id as string | undefined) ?? null, action: `mail_${statut}`,
      detail: { reference: ref, type: instr.type, titre: sujet, motif },
    });
  };
  const repondreAu = async (corps: string) => {
    try { await repondre(m.inbox_id, m.message_id, `${corps}\n\n— Votre Studio IA · référence ${ref}`); }
    catch (e) { console.error("[studio] liaison réponse:", e instanceof Error ? e.message : String(e)); }
  };

  // 3. Ni boucle, ni retour d'échec.
  if (de === String(ws.liaison_email ?? "").toLowerCase() || automatique(m.from ?? "", m.headers)) {
    return await clore("ignoree", "message automatique");
  }
  // 4. Débit.
  const { count } = await sb.from("studio_instructions").select("id", { count: "exact", head: true })
    .eq("workspace_id", ws.id).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) > LIMITE_HEURE) return await clore("ignoree", `plus de ${LIMITE_HEURE} messages en une heure`);

  // 5. Expéditeur autorisé : un utilisateur actif de l'espace, correctement authentifié.
  const { data: u } = await sb.from("studio_users").select("id, role, prenom, actif")
    .eq("workspace_id", ws.id).eq("email", de).maybeSingle();
  if (!u || !u.actif) return await clore("quarantaine", "expéditeur non autorisé");
  if (authentificationDouteuse(m.authentication_results)) return await clore("quarantaine", "authentification de l'expéditeur en échec (SPF/DKIM/DMARC)");

  const proprietaire = u.role === "proprietaire";
  const acteur = `mail:${de}`;

  // 6. Fraude au président : jamais exécuté, même par un utilisateur autorisé.
  const fraude = signauxFraude(`${sujet}\n${texte}`);
  if (fraude.length) {
    if (instr.type === "SUSPENDRE" && proprietaire) await suspendre(sb, ws.id, true, acteur);
    await repondreAu(
      "Ce message contient une demande financière (" + fraude.join(", ") + "). Vos agents ne traitent jamais ce type de demande par e-mail : " +
      "si elle est légitime, faites-la vous-même. Si vous n'êtes pas l'auteur de ce message, prévenez Aissociate.",
    );
    return await clore("quarantaine", `fraude présumée : ${fraude.join(", ")}`);
  }

  // 7. Commandes réservées au propriétaire.
  if (instr.type !== "ORDRE" && !proprietaire) {
    await repondreAu("Cette commande est réservée au propriétaire de l'espace. Votre message n'a pas été appliqué.");
    return await clore("ignoree", "commande réservée au propriétaire");
  }
  if (instr.type === "SUSPENDRE" || instr.type === "REPRENDRE") {
    const r = await suspendre(sb, ws.id, instr.type === "SUSPENDRE", acteur);
    await repondreAu(instr.type === "SUSPENDRE"
      ? "C'est fait : vos agents sont suspendus. Écrivez REPRENDRE pour les relancer."
      : "C'est fait : vos agents sont relancés.");
    return await clore("erreur" in r ? "erreur" : "traitee", "erreur" in r ? r.erreur ?? null : null);
  }
  if (instr.type === "VALIDATION") {
    const { data: livs } = await sb.from("studio_livrables").select("id, titre, statut").eq("workspace_id", ws.id)
      .order("created_at", { ascending: false }).limit(500);
    const lignes: string[] = [];
    for (const d of decisions(`${sujet}\n${texte}`)) {
      const l = (livs ?? []).find((x) => refLivrable(String(x.id)) === d.ref);
      if (!l) { lignes.push(`${d.ref} : livrable introuvable.`); continue; }
      const r = await deciderLivrable(sb, ws.id, { acteur, proprietaire }, { id: l.id, statut: d.statut, commentaire: "Décision reçue par e-mail", raison: "autre" });
      lignes.push(`${d.ref} « ${l.titre} » : ${"erreur" in r ? r.erreur : d.statut === "valide" ? "VALIDÉ" : "refusé"}`);
    }
    await repondreAu(lignes.join("\n"));
    return await clore("traitee", null);
  }

  // 8. Mission.
  if (!texte) { await repondreAu("Votre message est vide : décrivez votre demande dans le corps de l'e-mail."); return await clore("ignoree", "message vide"); }
  // Seulement les agents ouverts à cet espace (formule et réglages du CRM).
  const equipe = await equipeOuverte(ws.id);
  const agentId = choisirAgent(sujet, texte, equipe ?? [], ws.liaison_agent as string | null);
  const prenom = equipe.find((a) => a.id === agentId)?.prenom;
  // Même fil d'e-mails, même agent : la conversation continue.
  let conversationId: string | null = null;
  if (m.thread_id) {
    const { data: prec } = await sb.from("studio_instructions").select("conversation_id")
      .eq("workspace_id", ws.id).eq("thread_id", m.thread_id).eq("agent_id", agentId).not("conversation_id", "is", null)
      .order("created_at", { ascending: false }).limit(1);
    conversationId = (prec?.[0]?.conversation_id as string | undefined) ?? null;
  }
  const consigne = `${sujetPropre(sujet, prenom)}\n\n${texte}`.trim();
  const r = await executer(String(u.id), { agent_id: agentId, message: consigne, conversation_id: conversationId });
  if (!r.ok) {
    await repondreAu(`${prenom ?? "Votre agent"} n'a pas pu traiter votre demande : ${r.erreur}`);
    return await clore("erreur", r.erreur, { agent_id: agentId });
  }
  let livrableId: string | null = null, mention = "";
  if (r.message_id && !r.texte.includes("[[RELAIS:")) {
    const l = await soumettreLivrable(sb, ws.id, acteur, r.message_id);
    if ("id" in l && l.id) {
      livrableId = l.id;
      mention = proprietaire
        ? `\n\n---\nCe travail est en attente de votre validation (${refLivrable(l.id)}). Répondez « VALIDÉ ${refLivrable(l.id)} » ou « REFUSÉ ${refLivrable(l.id)} », ou décidez dans le Studio, rubrique Livrables.`
        : `\n\n---\nCe travail est soumis à la validation du propriétaire de l'espace (${refLivrable(l.id)}).`;
    }
  }
  const texteReponse = r.texte.replace(/\[\[RELAIS:([a-z0-9_-]+)\]\]/gi, (_x, id: string) => {
    const p = equipe.find((a) => a.id === id.toLowerCase())?.prenom ?? id;
    return `\n(Pour cela, écrivez à ${p} : mettez « [${p}] » en tête de l'objet.)`;
  });
  await repondreAu(`${texteReponse}${mention}`);
  await clore("traitee", null, { agent_id: agentId, conversation_id: r.conversation_id, livrable_id: livrableId });
}

// Contacts et mailings d'un espace, envoyés depuis la messagerie connectée du client (Zernio).
//
// Une campagne est un livrable « mailing_envoyer » : rien ne part avant le
// VALIDÉ. Au VALIDÉ, un envoi par contact abonné est mis en file
// (studio_envois), puis traité par lots (un message par destinataire, jamais en
// copie), avec lien et en-tête de désinscription.
// Une boîte personnelle n'est pas un outil de newsletter : Zernio met la boîte en
// pause si le même contenu part vers plus de 50 personnes en une heure. D'où un
// rythme de PLAFOND_HEURE envois par heure et un plafond quotidien selon le
// fournisseur ; le reste part aux passages horaires suivants.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import type { MessageMailing } from "./bureau.ts";

export const PLAFOND_HEURE = 45;
const LOT = 45;
export const IMPORT_MAX = 5000;
const ORIGINE = "https://aissociate.re";

// ─── Partie pure (testée) ────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Mise en forme en ligne : gras, italique, liens (https seulement). */
function enLigne(t: string): string {
  return esc(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, txt: string, url: string) => `<a href="${url}" style="color:#ea580c">${txt}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
}

/** Markdown simple (titres, listes, paragraphes, séparateurs, liens) → HTML d'e-mail. */
export function markdownVersHtml(md: string): string {
  const out: string[] = [];
  let liste: string[] = [], para: string[] = [];
  const fermer = () => {
    if (para.length) { out.push(`<p style="margin:0 0 14px">${para.map(enLigne).join("<br>")}</p>`); para = []; }
    if (liste.length) { out.push(`<ul style="margin:0 0 14px;padding-left:20px">${liste.map((l) => `<li style="margin:0 0 6px">${enLigne(l)}</li>`).join("")}</ul>`); liste = []; }
  };
  for (const brute of md.replace(/\r/g, "").split("\n")) {
    const l = brute.trimEnd();
    const titre = /^(#{1,3})\s+(.*)$/.exec(l);
    if (titre) {
      fermer();
      const taille = [0, 24, 20, 17][titre[1].length];
      out.push(`<h${titre[1].length} style="margin:18px 0 10px;font-size:${taille}px;line-height:1.3">${enLigne(titre[2])}</h${titre[1].length}>`);
    } else if (/^\s*[-*]\s+/.test(l)) { if (para.length) { const p = para; para = []; out.push(`<p style="margin:0 0 14px">${p.map(enLigne).join("<br>")}</p>`); } liste.push(l.replace(/^\s*[-*]\s+/, "")); }
    else if (/^-{3,}$/.test(l.trim())) { fermer(); out.push('<hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0">'); }
    else if (!l.trim()) fermer();
    else { if (liste.length) fermer(); para.push(l); }
  }
  fermer();
  return out.join("\n");
}

/** Texte brut lisible d'un markdown (version alternative de l'e-mail). */
export const markdownVersTexte = (md: string) =>
  md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#{1,3}\s+/gm, "").trim();

export const personnaliser = (t: string, c: { prenom?: string | null }) =>
  t.replace(/\{\{\s*prenom\s*\}\}/gi, c.prenom?.trim() || "").replace(/Bonjour ,/g, "Bonjour,");

export const lienDesinscription = (jeton: string) => `${ORIGINE}/studio/desinscription/${jeton}`;
export const lienDesinscriptionDirecte = (jeton: string) => `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/studio?desinscription=${jeton}`;

/** Gabarit HTML complet d'un mailing (lien de désinscription obligatoire). */
export function gabarit(o: { objet: string; html: string; entreprise: string; desinscription: string }): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(o.objet)}</title></head>
<body style="margin:0;background:#f6f6f4;font-family:Arial,Helvetica,sans-serif;color:#1c1c1c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-size:15px;line-height:1.6">${o.html}</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;color:#737373;border-top:1px solid #eeeeee">
Vous recevez cet e-mail de la part de ${esc(o.entreprise)}. <a href="${o.desinscription}" style="color:#737373">Se désinscrire</a>
</td></tr></table></td></tr></table></body></html>`;
}

/** Envois encore possibles : plafond du jour (remis à zéro à minuit UTC, comme Zernio) et rythme horaire. */
export function placeDisponible(plafondJour: number, envoyesJour: number, envoyesHeure: number): number {
  return Math.max(0, Math.min(plafondJour - envoyesJour, PLAFOND_HEURE - envoyesHeure));
}

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;
export const nettoyerListes = (v: unknown): string[] =>
  [...new Set((Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => String(x).trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 10);

/** Lignes importées → contacts valides (e-mail en minuscules, sans doublon) et nombre de rejets. */
export function contactsValides(lignes: unknown): { contacts: { email: string; prenom: string | null; nom: string | null }[]; rejets: number } {
  const vus = new Set<string>();
  const contacts: { email: string; prenom: string | null; nom: string | null }[] = [];
  let rejets = 0;
  for (const l of (Array.isArray(lignes) ? lignes : []).slice(0, IMPORT_MAX)) {
    const o = (l ?? {}) as Record<string, unknown>;
    const email = String(o.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 200 || vus.has(email)) { rejets++; continue; }
    vus.add(email);
    contacts.push({ email, prenom: String(o.prenom ?? "").trim().slice(0, 80) || null, nom: String(o.nom ?? "").trim().slice(0, 80) || null });
  }
  return { contacts, rejets };
}

// ─── Base ────────────────────────────────────────────────────────────────────

/** Requête des contacts abonnés d'une liste (toutes les listes si null). */
function abonnes(sb: SupabaseClient, wsId: string, liste: string | null) {
  let q = sb.from("studio_contacts").select("id", { count: "exact", head: true }).eq("workspace_id", wsId).is("desinscrit_le", null);
  if (liste) q = q.contains("listes", [liste]);
  return q;
}

export async function compterAbonnes(sb: SupabaseClient, wsId: string, liste: string | null): Promise<number> {
  const { count } = await abonnes(sb, wsId, liste);
  return count ?? 0;
}

/** Listes de l'espace et nombre d'abonnés de chacune. */
export async function resumeContacts(sb: SupabaseClient, wsId: string) {
  const { data } = await sb.from("studio_contacts").select("listes, desinscrit_le").eq("workspace_id", wsId).limit(20_000);
  const parListe = new Map<string, number>();
  let total = 0, desinscrits = 0;
  for (const c of data ?? []) {
    if (c.desinscrit_le) { desinscrits++; continue; }
    total++;
    for (const l of (c.listes as string[]) ?? []) parListe.set(l, (parListe.get(l) ?? 0) + 1);
  }
  return { abonnes: total, desinscrits, listes: [...parListe].map(([nom, nombre]) => ({ nom, nombre })).sort((a, b) => b.nombre - a.nombre) };
}

/** Au VALIDÉ : un envoi en file par abonné de la liste. */
export async function mettreEnFile(sb: SupabaseClient, wsId: string, livrableId: string, liste: string | null): Promise<number> {
  let q = sb.from("studio_contacts").select("id, email").eq("workspace_id", wsId).is("desinscrit_le", null).limit(20_000);
  if (liste) q = q.contains("listes", [liste]);
  const { data } = await q;
  const lignes = (data ?? []).map((c) => ({ workspace_id: wsId, livrable_id: livrableId, contact_id: c.id, email: c.email }));
  for (let i = 0; i < lignes.length; i += 1000) {
    const { error } = await sb.from("studio_envois").upsert(lignes.slice(i, i + 1000), { onConflict: "livrable_id,contact_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return lignes.length;
}

/**
 * Un lot d'envois d'une campagne. Renvoie le nombre restant et si le plafond
 * du jour est atteint (le passage horaire reprendra).
 */
export type Expediteur = {
  plafondJour: number;
  envoyer: (m: MessageMailing) => Promise<void>;
  /** Erreur qui doit suspendre la campagne jusqu'au passage suivant (quota, connexion, paiement). */
  bloquante: (e: unknown) => boolean;
  lisible: (e: unknown) => string;
};

export async function traiterLot(
  sb: SupabaseClient, livrableId: string,
  expediteurDe: (wsId: string) => Promise<Expediteur>,
): Promise<{ restants: number; plafond: boolean }> {
  const { data: l } = await sb.from("studio_livrables").select("id, workspace_id, action, statut").eq("id", livrableId).maybeSingle();
  const action = l?.action as { type?: string; objet?: string; contenu?: string } | null;
  if (!l || action?.type !== "mailing_envoyer") return { restants: 0, plafond: false };
  const wsId = String(l.workspace_id);
  const reste = async () => (await sb.from("studio_envois").select("id", { count: "exact", head: true }).eq("livrable_id", livrableId).eq("statut", "a_envoyer")).count ?? 0;
  let exp: Expediteur;
  try { exp = await expediteurDe(wsId); }
  catch { return { restants: await reste(), plafond: true }; } // aucune messagerie connectée : on attend
  const compter = async (depuis: string) => (await sb.from("studio_envois").select("id", { count: "exact", head: true })
    .eq("workspace_id", wsId).eq("statut", "envoye").gte("envoye_le", depuis)).count ?? 0;
  const [envoyesJour, envoyesHeure] = await Promise.all([
    compter(new Date().toISOString().slice(0, 10) + "T00:00:00Z"),
    compter(new Date(Date.now() - 3_600_000).toISOString()),
  ]);
  const place = placeDisponible(exp.plafondJour, envoyesJour, envoyesHeure);
  if (place <= 0) return { restants: await reste(), plafond: true };

  const { data: ws } = await sb.from("studio_workspaces").select("nom").eq("id", wsId).maybeSingle();
  const { data: lot } = await sb.from("studio_envois").select("id, email, studio_contacts(prenom, jeton, desinscrit_le)")
    .eq("livrable_id", livrableId).eq("statut", "a_envoyer").order("created_at").limit(Math.min(LOT, place));
  for (const e of lot ?? []) {
    const c = e.studio_contacts as unknown as { prenom: string | null; jeton: string; desinscrit_le: string | null } | null;
    if (!c || c.desinscrit_le) { await sb.from("studio_envois").update({ statut: "ignore" }).eq("id", e.id); continue; }
    // Réservation : un seul passage envoie ce message.
    const { data: pris } = await sb.from("studio_envois").update({ statut: "en_cours" }).eq("id", e.id).eq("statut", "a_envoyer").select("id").maybeSingle();
    if (!pris) continue;
    try {
      const md = personnaliser(String(action.contenu ?? ""), c);
      const objet = personnaliser(String(action.objet ?? ""), c);
      const desinscription = lienDesinscription(c.jeton);
      await exp.envoyer({
        a: String(e.email), objet, desinscription, desinscriptionDirecte: lienDesinscriptionDirecte(c.jeton), cle: String(e.id),
        texte: `${markdownVersTexte(md)}\n\n—\nSe désinscrire : ${desinscription}`,
        html: gabarit({ objet, html: markdownVersHtml(md), entreprise: String(ws?.nom ?? ""), desinscription }),
      });
      await sb.from("studio_envois").update({ statut: "envoye", envoye_le: new Date().toISOString(), erreur: null }).eq("id", e.id);
    } catch (err) {
      // Quota, pause ou connexion : l'envoi reste en file, le passage suivant reprendra.
      if (exp.bloquante(err)) {
        await sb.from("studio_envois").update({ statut: "a_envoyer", erreur: exp.lisible(err).slice(0, 300) }).eq("id", e.id);
        return { restants: await reste(), plafond: true };
      }
      await sb.from("studio_envois").update({ statut: "echec", erreur: exp.lisible(err).slice(0, 300) }).eq("id", e.id);
    }
  }
  return { restants: await reste(), plafond: false };
}

/** Avancement des campagnes de l'espace (30 dernières). */
export async function campagnes(sb: SupabaseClient, wsId: string) {
  const { data: livs } = await sb.from("studio_livrables").select("id, titre, statut, created_at, action")
    .eq("workspace_id", wsId).eq("action->>type", "mailing_envoyer").order("created_at", { ascending: false }).limit(30);
  const ids = (livs ?? []).map((l) => l.id);
  const { data: envois } = ids.length
    ? await sb.from("studio_envois").select("livrable_id, statut").in("livrable_id", ids).limit(50_000)
    : { data: [] as { livrable_id: string; statut: string }[] };
  return (livs ?? []).map((l) => {
    const e = (envois ?? []).filter((x) => x.livrable_id === l.id);
    const n = (s: string) => e.filter((x) => x.statut === s).length;
    const a = l.action as { objet?: string; liste?: string | null };
    return {
      id: l.id, objet: a.objet ?? l.titre, liste: a.liste ?? null, statut: l.statut, date: l.created_at,
      total: e.length, envoyes: n("envoye"), echecs: n("echec"), en_attente: n("a_envoyer") + n("en_cours"),
    };
  });
}

/** Lance le traitement d'une campagne dans sa propre instance de la fonction. */
export async function declencherEnvois(sb: SupabaseClient, livrableId: string): Promise<void> {
  const { data } = await sb.from("studio_cron_cle").select("cle").eq("id", 1).maybeSingle();
  if (!data?.cle) return; // le passage horaire prendra le relais
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/studio`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "envois_traiter", cle: data.cle, id: livrableId }),
  }).then((r) => r.body?.cancel()).catch((e) => console.error("[studio] envois:", e instanceof Error ? e.message : String(e)));
}

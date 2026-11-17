// Messagerie, agenda et fichiers des agents du Studio, via Zernio (https://docs.zernio.com).
//
// Le client connecte sa boîte en un clic : Google (Gmail, Agenda, Drive), Microsoft
// (Outlook, calendrier, OneDrive) ou toute autre messagerie en IMAP. Chaque compte
// appartient au profil Zernio de l'espace (zernio.ts) : toute opération vérifie que
// le compte visé est bien rattaché à CET espace.
//
// Lecture (rechercher, lire, lister) : immédiate, pendant la conversation.
// Écriture (envoyer, créer un rendez-vous, déposer un document) : JAMAIS pendant la
// conversation ; l'agent propose, l'action part au « VALIDÉ » du propriétaire.
//
// Limites Zernio à connaître : Google Drive ne montre que les fichiers créés par
// Zernio ou choisis par le client (sélecteur) ; une boîte est faite pour du courrier
// individuel (même corps vers plus de 50 personnes en une heure = boîte en pause).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { appel, appelBrut, comptesBruts, oublierComptes, profilEspace } from "./zernio.ts";
import { FUSEAU, periode, type Rdv } from "./agenda.ts";

export const FOURNISSEURS = ["google", "microsoft", "imap"] as const;
export type Fournisseur = typeof FOURNISSEURS[number];
export type Zone = "email" | "calendar" | "files";
export const NOMS_FOURNISSEURS: Record<Fournisseur, string> = { google: "Google", microsoft: "Microsoft", imap: "Messagerie" };
export const NOMS_ZONES: Record<Zone, string> = { email: "e-mails", calendar: "agenda", files: "fichiers" };
const ZONES: Zone[] = ["email", "calendar", "files"];
export const LECTURE_MAX = 30_000;
const TELECHARGEMENT_MAX = 15 * 1024 * 1024;

export type Boite = {
  id: string; fournisseur: Fournisseur; adresse: string; nom: string; zones: Zone[];
  photo: string | null; a_reconnecter: boolean;
};

// ─── Partie pure (testée) ────────────────────────────────────────────────────

export const estFournisseur = (x: unknown): x is Fournisseur => FOURNISSEURS.includes(x as Fournisseur);

/** Compte Zernio → boîte de l'espace (null si ce n'est pas une messagerie). */
export function versBoite(a: Record<string, unknown>): Boite | null {
  if (!estFournisseur(a.platform)) return null;
  const f = a.platform;
  const demandees = Array.isArray(a.scopeAreas) ? (a.scopeAreas as string[]).filter((z): z is Zone => ZONES.includes(z as Zone)) : null;
  // IMAP : e-mail seulement. Google / Microsoft sans détail : les trois zones demandées à la connexion.
  const zones = f === "imap" ? ["email" as Zone] : demandees ?? ZONES;
  const adresse = String(a.email ?? a.emailAddress ?? a.username ?? "");
  return {
    id: String(a._id), fournisseur: f, adresse, nom: String(a.displayName || adresse || NOMS_FOURNISSEURS[f]),
    zones, photo: (a.profilePicture as string) || null,
    a_reconnecter: Boolean(a.needsReconnection) || a.isActive === false,
  };
}

/** Boîte à utiliser pour une zone : une connexion valide d'abord, Google / Microsoft avant IMAP. */
export function boitePour(boites: Boite[], zone: Zone): Boite | null {
  const ok = boites.filter((b) => b.zones.includes(zone));
  const rang = (b: Boite) => (b.a_reconnecter ? 10 : 0) + (b.fournisseur === "imap" ? 1 : 0);
  return [...ok].sort((x, y) => rang(x) - rang(y))[0] ?? null;
}

/** Message lisible d'une erreur Zernio, avec la marche à suivre. */
export function messageErreur(e: unknown): string {
  const x = e as { statut?: number; code?: string; data?: Record<string, unknown>; message?: string };
  const d = (x.data ?? {}) as Record<string, unknown>;
  const raison = String(d.reason ?? (d.details as Record<string, unknown> | undefined)?.reason ?? "");
  if (x.code === "PAYMENT_REQUIRED" || raison === "free_tier_exceeded") return "Nouvelle connexion momentanément indisponible : l'équipe Aissociate doit activer des comptes supplémentaires. Prévenez-la, puis réessayez.";
  if (x.statut === 402) return "L'envoi depuis cette messagerie n'est pas encore activé pour l'espace : prévenez l'équipe Aissociate.";
  if (x.code === "account_scope_missing") return "La connexion n'autorise pas cette opération : reconnectez la messagerie depuis « Connecteurs » en acceptant tous les accès demandés.";
  if (x.code === "email_send_cap_reached") return "Plafond d'envois du jour atteint pour cette boîte : l'envoi reprendra demain.";
  if (x.statut === 429) return "Boîte mise en pause par sécurité (trop d'envois rapprochés) : réessayez dans une heure.";
  if (raison === "file_not_granted") return "Ce fichier Drive n'est pas autorisé : choisissez-le d'abord dans « Connecteurs › Google › Choisir des fichiers Drive ».";
  if (x.statut === 401 || x.statut === 403) return "Accès refusé par le fournisseur : reconnectez la messagerie depuis « Connecteurs ».";
  return x.message ?? String(e);
}

/** Erreur qui interrompt une série d'envois (quota, paiement, connexion). */
export const erreurBloquante = (e: unknown) => {
  const x = e as { statut?: number };
  return x.statut === 401 || x.statut === 402 || x.statut === 403 || x.statut === 412 || x.statut === 429;
};

type Adresse = { email?: string; name?: string | null } | null | undefined;
const adr = (x: Adresse) => (x?.name ? `${x.name} <${x.email ?? ""}>` : x?.email ?? "");
const adrs = (l: unknown) => (Array.isArray(l) ? (l as Adresse[]).map(adr).filter(Boolean).join(", ") : "");

const sansBalises = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
  .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** Corps lisible d'un message : texte nettoyé (sans citations), sinon texte, sinon HTML sans balises. */
export function corpsLisible(m: Record<string, unknown>): string {
  const propre = (m.clean as { text?: string } | null)?.text;
  if (propre?.trim()) return propre.trim();
  if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
  return typeof m.html === "string" ? sansBalises(m.html) : "";
}

/** Paramètres de recherche d'e-mails. `requete` : syntaxe native (Gmail, Outlook). */
export function parametresRecherche(compteId: string, f: { requete?: string; de?: string; objet?: string; non_lus?: boolean; jours?: number; max?: number }, maintenant = Date.now()): URLSearchParams {
  const q = new URLSearchParams({ accountId: compteId, limit: String(Math.min(Math.max(Number(f.max) || 10, 1), 25)) });
  if (f.requete?.trim()) q.set("searchQueryNative", f.requete.trim().slice(0, 300));
  if (f.de?.trim()) q.set("from", f.de.trim().slice(0, 200));
  if (f.objet?.trim()) q.set("subject", f.objet.trim().slice(0, 200));
  if (f.non_lus) q.set("unread", "true");
  if (Number(f.jours) > 0) q.set("after", new Date(maintenant - Math.min(Number(f.jours), 365) * 86_400_000).toISOString());
  return q;
}

/** Nom de fichier d'un en-tête Content-Disposition. */
export function nomFichier(cd: string | null): string {
  if (!cd) return "";
  const etoile = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (etoile) { try { return decodeURIComponent(etoile[1].trim()); } catch { /* nom brut */ } }
  return /filename="?([^";]+)"?/i.exec(cd)?.[1]?.trim() ?? "";
}

/** Façon de lire un fichier téléchargé, d'après son type et son nom. */
export function typeLecture(mime: string, nom: string): "texte" | "pdf" | "tableur" | "word" | null {
  const m = mime.toLowerCase(), n = nom.toLowerCase();
  if (m.startsWith("text/") || ["application/json", "application/xml", "application/csv"].includes(m) || /\.(txt|md|csv|json|xml|html?)$/.test(n)) return "texte";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (m.includes("spreadsheetml") || m === "application/vnd.ms-excel" || /\.xlsx?$/.test(n)) return "tableur";
  if (m.includes("wordprocessingml") || n.endsWith(".docx")) return "word";
  return null;
}

const echapperHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enLigne = (t: string) => echapperHtml(t)
  .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");

type Bloc = { type: "titre"; niveau: number; texte: string } | { type: "puce" | "numero" | "para"; texte: string };

/** Markdown simple découpé en blocs (titres, listes, paragraphes). */
export function blocsMarkdown(md: string): Bloc[] {
  const out: Bloc[] = [];
  for (const brute of md.replace(/\r/g, "").split("\n")) {
    const l = brute.trimEnd();
    const titre = /^(#{1,4})\s+(.*)$/.exec(l);
    const puce = /^\s*[-*•]\s+(.*)$/.exec(l);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(l);
    if (titre) out.push({ type: "titre", niveau: titre[1].length, texte: titre[2] });
    else if (puce) out.push({ type: "puce", texte: puce[1] });
    else if (num) out.push({ type: "numero", texte: num[1] });
    else if (l.trim()) out.push({ type: "para", texte: l });
  }
  return out;
}

/** Markdown simple → HTML, importé par Google Drive en Google Doc. */
export function markdownVersHtml(md: string): string {
  const out: string[] = [];
  let liste: "ul" | "ol" | null = null;
  const fermer = () => { if (liste) { out.push(`</${liste}>`); liste = null; } };
  for (const b of blocsMarkdown(md)) {
    if (b.type === "titre") { fermer(); out.push(`<h${b.niveau}>${enLigne(b.texte)}</h${b.niveau}>`); }
    else if (b.type === "puce" || b.type === "numero") {
      const t = b.type === "puce" ? "ul" : "ol";
      if (liste !== t) { fermer(); out.push(`<${t}>`); liste = t; }
      out.push(`<li>${enLigne(b.texte)}</li>`);
    } else { fermer(); out.push(`<p>${enLigne(b.texte)}</p>`); }
  }
  fermer();
  return `<html><head><meta charset="utf-8"></head><body>${out.join("")}</body></html>`;
}

/** Corps d'un événement Zernio (heure de La Réunion). */
export function corpsEvenement(compteId: string, r: Rdv) {
  return {
    accountId: compteId,
    title: r.titre.slice(0, 300),
    start: `${r.debut}+04:00`, end: `${r.fin}+04:00`, timezone: FUSEAU,
    ...(r.lieu ? { location: r.lieu.slice(0, 300) } : {}),
    ...(r.description ? { description: r.description.slice(0, 8000) } : {}),
    ...(r.participants?.length ? { participants: r.participants.map((email) => ({ email })) } : {}),
  };
}

// ─── Comptes de l'espace ─────────────────────────────────────────────────────

/** Messageries (Google, Microsoft, IMAP) connectées à l'espace, et à lui seul. */
export async function boitesEspace(wsId: string): Promise<Boite[]> {
  return (await comptesBruts(wsId)).map(versBoite).filter((b): b is Boite => b !== null);
}

async function boiteDeLEspace(wsId: string, id: string): Promise<Boite> {
  const b = (await boitesEspace(wsId)).find((x) => x.id === id);
  if (!b) throw new Error("Cette messagerie n'est plus connectée à l'espace : reconnectez-la dans Connecteurs.");
  return b;
}

/** Lien de connexion : « google » / « microsoft » (OAuth) ou « email » (toute adresse, IMAP sinon). */
export async function lienConnexion(p: { wsId: string; wsNom: string; quoi: "google" | "microsoft" | "email"; retour: string; reconnecter?: string | null }): Promise<string> {
  const profil = await profilEspace(p.wsId, p.wsNom, true);
  const q = new URLSearchParams({ profileId: profil!, redirect_url: p.retour });
  if (p.reconnecter) {
    const b = await boiteDeLEspace(p.wsId, p.reconnecter);
    q.set("reconnectAccountId", b.id);
    if (b.adresse && p.quoi !== "email") q.set("loginHint", b.adresse);
  }
  if (p.quoi !== "email") q.set("scopes", "email,calendar,files");
  try {
    const { data } = await appel<{ authUrl: string }>(`/connect/${p.quoi}?${q}`);
    oublierComptes(p.wsId);
    return data.authUrl;
  } catch (e) {
    throw new Error(messageErreur(e));
  }
}

export async function deconnecterBoite(wsId: string, id: string): Promise<Boite> {
  const b = await boiteDeLEspace(wsId, id);
  await appel(`/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
  oublierComptes(wsId);
  return b;
}

/** Sélecteur Google Drive (fichiers que les agents pourront lire). */
export async function lienChoixFichiers(wsId: string, id: string, retour: string): Promise<string> {
  const b = await boiteDeLEspace(wsId, id);
  if (b.fournisseur !== "google") throw new Error("Seul Google Drive demande de choisir les fichiers : OneDrive est lisible en entier.");
  const { data } = await appel<{ data: { url: string } }>("/files/picker-sessions", {
    method: "POST", body: JSON.stringify({ accountId: b.id, redirectUrl: retour }),
  });
  return data.data.url;
}

// ─── E-mails ────────────────────────────────────────────────────────────────

const enc = encodeURIComponent;

export async function rechercherMails(compteId: string, f: Parameters<typeof parametresRecherche>[1]) {
  const { data } = await appel<{ data: Record<string, unknown>[] }>(`/email/messages?${parametresRecherche(compteId, f)}`);
  return (data.data ?? []).map((m) => ({
    id: String(m.id), fil: String(m.threadId ?? ""), de: adr(m.from as Adresse), a: adrs(m.to), objet: String(m.subject ?? ""),
    date: String(m.date ?? "").slice(0, 16), extrait: String(m.snippet ?? "").slice(0, 300), non_lu: Boolean(m.unread),
  }));
}

export async function lireMail(compteId: string, id: string) {
  const { data } = await appel<{ data: Record<string, unknown> }>(`/email/messages/${enc(id)}?accountId=${enc(compteId)}&clean=true`);
  const m = data.data;
  const corps = corpsLisible(m);
  return {
    id: String(m.id), fil: String(m.threadId ?? ""), de: adr(m.from as Adresse), deAdresse: String((m.from as Adresse)?.email ?? "").toLowerCase(),
    a: adrs(m.to), cc: adrs(m.cc), objet: String(m.subject ?? ""), date: String(m.date ?? "").slice(0, 16),
    pieces: Array.isArray(m.attachments) ? m.attachments.length : 0,
    corps: corps.slice(0, LECTURE_MAX), tronque: corps.length > LECTURE_MAX,
  };
}

/**
 * Envoi d'un e-mail validé. En réponse à un message, la réponse reste dans le fil
 * si le destinataire validé est bien l'expéditeur d'origine ; sinon, e-mail séparé.
 */
export async function envoyerMail(wsId: string, compteId: string, m: { a: string[]; cc?: string[]; objet: string; corps: string; reponseA?: string | null }) {
  const b = await boiteDeLEspace(wsId, compteId);
  const lien = (fil: string) => (b.fournisseur === "google" && fil ? `https://mail.google.com/mail/u/0/#all/${fil}` : null);
  if (m.reponseA && m.a.length === 1 && !m.cc?.length) {
    try {
      const o = await lireMail(compteId, m.reponseA);
      if (o.deAdresse === m.a[0]) {
        const { data } = await appel<{ data: { id: string; threadId?: string } }>(`/email/messages/${enc(m.reponseA)}/reply`, {
          method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ accountId: compteId, mode: "reply", text: m.corps }),
        });
        return { id: data.data.id, lien: lien(String(data.data.threadId ?? "")) };
      }
    } catch (e) {
      if (erreurBloquante(e)) throw e; // message d'origine introuvable : envoi séparé
    }
  }
  const { data } = await appel<{ data: { id: string; threadId?: string } }>("/email/messages", {
    method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      accountId: compteId, to: m.a.map((email) => ({ email })),
      ...(m.cc?.length ? { cc: m.cc.map((email) => ({ email })) } : {}),
      subject: m.objet.replace(/[\r\n]+/g, " "), text: m.corps,
    }),
  });
  return { id: data.data.id, lien: lien(String(data.data.threadId ?? "")) };
}

export type MessageMailing = { a: string; objet: string; texte: string; html: string; desinscription: string; desinscriptionDirecte: string; cle: string };

/** Un e-mail de campagne (un destinataire, lien et en-tête de désinscription). */
export async function envoyerMessageMailing(compteId: string, m: MessageMailing): Promise<void> {
  const corps = {
    accountId: compteId, to: [{ email: m.a }], subject: m.objet.replace(/[\r\n]+/g, " "), text: m.texte, html: m.html,
    headers: { "List-Unsubscribe": `<${m.desinscriptionDirecte}>, <${m.desinscription}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
  const envoi = (c: Record<string, unknown>) => appel("/email/messages", {
    method: "POST", headers: { "Idempotency-Key": `mailing-${m.cle}` }, body: JSON.stringify(c),
  });
  try { await envoi(corps); }
  catch (e) {
    // En-têtes refusés par le fournisseur : le lien de désinscription reste dans le message.
    const x = e as { statut?: number; data?: { param?: string } };
    if (x.statut !== 400 || !String(x.data?.param ?? "").startsWith("headers")) throw e;
    const { headers: _h, ...sansEntetes } = corps;
    await envoi(sansEntetes);
  }
}

/** Plafond quotidien prudent d'une boîte (sous celui de Zernio, remis à zéro à minuit UTC). */
export function plafondJour(b: Pick<Boite, "fournisseur" | "adresse">): number {
  if (b.fournisseur === "microsoft") return 900;
  if (b.fournisseur === "google" && !/@(gmail|googlemail)\.com$/i.test(b.adresse)) return 450;
  return 180;
}

// ─── Agenda ─────────────────────────────────────────────────────────────────

export async function listerRdv(compteId: string, du?: string | null, au?: string | null) {
  const { min, max } = periode(du, au);
  const q = new URLSearchParams({ accountId: compteId, from: min, to: max, timezone: FUSEAU, expandRecurring: "true", limit: "50" });
  const { data } = await appel<{ data: Record<string, unknown>[] }>(`/calendar/events?${q}`);
  return (data.data ?? []).filter((e) => e.status !== "cancelled").map((e) => ({
    id: String(e.id), titre: String(e.title || "(sans titre)"), debut: String(e.start ?? ""), fin: String(e.end ?? ""),
    lieu: String(e.location ?? ""), participants: Array.isArray(e.participants) ? (e.participants as Adresse[]).map((p) => p?.email ?? "").filter(Boolean) : [],
    lien: String(e.htmlLink ?? ""),
  }));
}

export async function creerRdv(wsId: string, compteId: string, r: Rdv): Promise<{ id: string; lien: string | null }> {
  await boiteDeLEspace(wsId, compteId);
  const { data } = await appel<{ data: { id: string; htmlLink?: string | null } }>("/calendar/events", {
    method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(corpsEvenement(compteId, r)),
  });
  return { id: data.data.id, lien: data.data.htmlLink ?? null };
}

// ─── Fichiers (Google Drive, OneDrive) ──────────────────────────────────────

export type Fichier = { id: string; nom: string; type: string; dossier: boolean; modifie: string; lien: string | null };
const versFichier = (f: Record<string, unknown>): Fichier => ({
  id: String(f.id), nom: String(f.name ?? ""), type: String(f.mimeType ?? "").replace("application/vnd.google-apps.", "google-"),
  dossier: f.kind === "folder", modifie: String(f.modifiedAt ?? "").slice(0, 10), lien: (f.webUrl as string) || null,
});

export async function listerFichiers(compteId: string, p: { q?: string | null; dossier?: string | null }): Promise<Fichier[]> {
  const q = new URLSearchParams({ accountId: compteId, limit: "25" });
  if (p.q?.trim()) q.set("q", p.q.trim().slice(0, 200));
  if (p.dossier) q.set("folderId", p.dossier);
  const { data } = await appel<{ data: Record<string, unknown>[] }>(`/files?${q}`);
  return (data.data ?? []).filter((f) => !f.trashed).map(versFichier);
}

/** Texte d'un fichier : texte brut, PDF (Google Docs et Slides arrivent en PDF), tableur (Sheets en XLSX), Word. */
export async function lireFichier(compteId: string, id: string): Promise<{ nom: string; texte: string; tronque: boolean }> {
  const r = await appelBrut(`/files/${enc(id)}/download?accountId=${enc(compteId)}`);
  const nom = nomFichier(r.headers.get("content-disposition")) || id;
  const mime = (r.headers.get("content-type") ?? "").split(";")[0].trim();
  const taille = Number(r.headers.get("content-length") ?? 0);
  const mode = typeLecture(mime, nom);
  if (!mode || taille > TELECHARGEMENT_MAX) {
    await r.body?.cancel();
    return { nom, tronque: false, texte: `(Fichier « ${nom} » ${mode ? "trop volumineux" : `au format ${mime || "inconnu"}`} : contenu non lisible directement. Sont lus : texte, PDF, Google Docs, Sheets, Slides, Word et Excel.)` };
  }
  const octets = new Uint8Array(await r.arrayBuffer());
  let texte = "";
  if (mode === "texte") {
    texte = new TextDecoder().decode(octets);
    if (/html/.test(mime) || /\.html?$/i.test(nom)) texte = sansBalises(texte);
  } else if (mode === "pdf") {
    const { extractText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
    const pdf = await getDocumentProxy(octets);
    texte = String((await extractText(pdf, { mergePages: true })).text ?? "");
  } else if (mode === "tableur") {
    const XLSX = await import("npm:xlsx@0.18.5");
    const classeur = XLSX.read(octets, { type: "array" });
    texte = classeur.SheetNames.map((n: string) => `## ${n}\n${XLSX.utils.sheet_to_csv(classeur.Sheets[n])}`).join("\n\n");
  } else {
    const mammoth = (await import("npm:mammoth@1.8.0")).default;
    texte = String((await mammoth.extractRawText({ arrayBuffer: octets.buffer })).value ?? "");
  }
  texte = texte.trim();
  return { nom, texte: texte.slice(0, LECTURE_MAX), tronque: texte.length > LECTURE_MAX };
}

/** Document Word (OneDrive) à partir de Markdown simple. */
async function docxDepuisMarkdown(titre: string, md: string): Promise<Uint8Array> {
  const d = await import("npm:docx@9.0.2");
  const niveaux = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3, d.HeadingLevel.HEADING_4];
  const runs = (t: string) => t.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    .map((x) => (x.startsWith("**") && x.endsWith("**") ? new d.TextRun({ text: x.slice(2, -2), bold: true }) : new d.TextRun(x)));
  const paragraphes = blocsMarkdown(md).map((b) =>
    b.type === "titre" ? new d.Paragraph({ heading: niveaux[b.niveau - 1], children: runs(b.texte) })
      : b.type === "puce" ? new d.Paragraph({ bullet: { level: 0 }, children: runs(b.texte) })
      : b.type === "numero" ? new d.Paragraph({ children: [new d.TextRun("• "), ...runs(b.texte)] })
      : new d.Paragraph({ children: runs(b.texte) }));
  const doc = new d.Document({ title: titre, sections: [{ children: paragraphes }] });
  return new Uint8Array(await d.Packer.toBuffer(doc));
}

/**
 * Dépose un document (validé) : Google Doc modifiable sur Google Drive, fichier Word
 * sur OneDrive. Google importe depuis une adresse : copie temporaire dans le stockage.
 */
export async function creerDocument(sb: SupabaseClient, wsId: string, compteId: string, p: { titre: string; contenu: string; dossierId?: string | null }): Promise<{ id: string; lien: string | null }> {
  const b = await boiteDeLEspace(wsId, compteId);
  const titre = p.titre.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 200) || "Document";
  if (b.fournisseur === "microsoft") {
    const form = new FormData();
    form.set("accountId", compteId);
    form.set("name", `${titre}.docx`);
    if (p.dossierId) form.set("parentId", p.dossierId);
    form.set("file", new Blob([new Uint8Array(await docxDepuisMarkdown(titre, p.contenu))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), `${titre}.docx`);
    const cle = Deno.env.get("ZERNIO_API_KEY");
    const r = await fetch("https://zernio.com/api/v1/files", { method: "POST", headers: { Authorization: `Bearer ${cle}` }, body: form, signal: AbortSignal.timeout(60_000) });
    const j = await r.json().catch(() => ({})) as Record<string, unknown>;
    if (!r.ok) throw Object.assign(new Error(`Zernio (${r.status}) : ${String(j.error ?? r.statusText)}`), { statut: r.status, data: j, code: String(j.code ?? "") });
    const f = versFichier((j.data ?? {}) as Record<string, unknown>);
    return { id: f.id, lien: f.lien };
  }
  if (b.fournisseur !== "google") throw new Error("Cette messagerie n'a pas d'espace de fichiers : connectez Google Drive ou OneDrive.");
  const chemin = `${wsId}/depots/${crypto.randomUUID()}.html`;
  const stock = sb.storage.from("studio-medias");
  const { error } = await stock.upload(chemin, new Blob([markdownVersHtml(p.contenu)], { type: "text/html" }), { contentType: "text/html; charset=utf-8" });
  if (error) throw new Error(`Préparation du document impossible : ${error.message}`);
  try {
    const { data: signe, error: e2 } = await stock.createSignedUrl(chemin, 600);
    if (e2 || !signe?.signedUrl) throw new Error("Préparation du document impossible.");
    const { data } = await appel<{ data: Record<string, unknown> }>("/files", {
      method: "POST",
      body: JSON.stringify({
        accountId: compteId, name: titre, contentType: "text/html", url: signe.signedUrl,
        convertTo: "application/vnd.google-apps.document", ...(p.dossierId ? { parentId: p.dossierId } : {}),
      }),
    });
    const f = versFichier(data.data ?? {});
    return { id: f.id, lien: f.lien };
  } finally {
    await stock.remove([chemin]).catch(() => undefined);
  }
}

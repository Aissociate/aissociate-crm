// Gmail pour les agents du Studio, via la connexion Nango « google-mail » de l'espace.
//
// Lecture (rechercher, lire) : immédiate, pendant la conversation.
// Envoi : JAMAIS pendant la conversation. L'agent prépare un e-mail, enregistré
// comme livrable « à valider » ; l'envoi part au « VALIDÉ » du propriétaire.
import { appelGoogle } from "./google.ts";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const LECTURE_MAX = 20_000;

// ─── Partie pure (testée) ────────────────────────────────────────────────────

type Entete = { name: string; value: string };
export type Partie = { mimeType?: string; body?: { data?: string }; parts?: Partie[]; headers?: Entete[] };

export const entete = (h: Entete[] | undefined, nom: string) =>
  h?.find((x) => x.name.toLowerCase() === nom.toLowerCase())?.value ?? "";

/** Base64 « url » (Gmail) → texte UTF-8. */
export function decoderB64url(d: string): string {
  const b = atob(d.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}

/** Texte UTF-8 → base64 standard. */
export function b64(t: string): string {
  const o = new TextEncoder().encode(t);
  let s = "";
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(s);
}
export const b64url = (t: string) => b64(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const sansBalises = (h: string) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
  .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** Corps lisible d'un message : text/plain en priorité, sinon text/html sans balises. */
export function extraireCorps(p: Partie): string {
  const trouver = (x: Partie, mime: string): string | null => {
    if (x.mimeType === mime && x.body?.data) return decoderB64url(x.body.data);
    for (const enfant of x.parts ?? []) { const t = trouver(enfant, mime); if (t) return t; }
    return null;
  };
  const texte = trouver(p, "text/plain");
  if (texte) return texte.trim();
  const html = trouver(p, "text/html");
  return html ? sansBalises(html) : "";
}

/** Objet encodé RFC 2047 s'il contient autre chose que de l'ASCII. */
export const encoderObjet = (o: string) => (/^[\x20-\x7e]*$/.test(o) ? o : `=?UTF-8?B?${b64(o)}?=`);

export type Courriel = { a: string[]; cc?: string[]; objet: string; corps: string; enReponseA?: string | null };

/** Message MIME prêt pour users.messages.send (texte brut UTF-8, base64). */
export function construireMime(c: Courriel): string {
  const lignes = [
    `To: ${c.a.join(", ")}`,
    ...(c.cc?.length ? [`Cc: ${c.cc.join(", ")}`] : []),
    `Subject: ${encoderObjet(c.objet.replace(/[\r\n]+/g, " "))}`,
    ...(c.enReponseA ? [`In-Reply-To: ${c.enReponseA}`, `References: ${c.enReponseA}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    (b64(c.corps).match(/.{1,76}/g) ?? []).join("\r\n"),
  ];
  return lignes.join("\r\n");
}

// ─── Appels Gmail ────────────────────────────────────────────────────────────

export type ResumeMail = { id: string; fil: string; de: string; a: string; objet: string; date: string; extrait: string };

export async function rechercher(jeton: string, requete: string, max = 10): Promise<ResumeMail[]> {
  const q = new URLSearchParams({ q: requete.slice(0, 300), maxResults: String(Math.min(max, 20)) });
  const liste = await (await appelGoogle(jeton, `${API}/messages?${q}`, "Gmail")).json() as { messages?: { id: string }[] };
  const champs = "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date";
  return await Promise.all((liste.messages ?? []).map(async ({ id }) => {
    const m = await (await appelGoogle(jeton, `${API}/messages/${id}?${champs}`, "Gmail")).json() as { id: string; threadId: string; snippet?: string; payload?: Partie };
    const h = m.payload?.headers;
    return { id: m.id, fil: m.threadId, de: entete(h, "From"), a: entete(h, "To"), objet: entete(h, "Subject"), date: entete(h, "Date"), extrait: m.snippet ?? "" };
  }));
}

export async function lire(jeton: string, id: string) {
  const m = await (await appelGoogle(jeton, `${API}/messages/${encodeURIComponent(id)}?format=full`, "Gmail")).json() as { id: string; threadId: string; payload: Partie };
  const h = m.payload.headers;
  const corps = extraireCorps(m.payload);
  return {
    id: m.id, fil: m.threadId, de: entete(h, "From"), a: entete(h, "To"), cc: entete(h, "Cc"), objet: entete(h, "Subject"),
    date: entete(h, "Date"), messageId: entete(h, "Message-ID") || entete(h, "Message-Id"),
    corps: corps.slice(0, LECTURE_MAX), tronque: corps.length > LECTURE_MAX,
  };
}

/** Envoi (appelé uniquement après validation). `fil` rattache la réponse à la conversation Gmail. */
export async function envoyer(jeton: string, c: Courriel & { fil?: string | null }): Promise<{ id: string; fil: string }> {
  const r = await appelGoogle(jeton, `${API}/messages/send`, "Gmail", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64url(construireMime(c)), ...(c.fil ? { threadId: c.fil } : {}) }),
  });
  const j = await r.json() as { id: string; threadId: string };
  return { id: j.id, fil: j.threadId };
}

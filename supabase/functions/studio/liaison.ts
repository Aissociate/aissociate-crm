// Canal e-mail de liaison (vague 2 du paquet « plateforme multi-tenant ») —
// partie PURE, testée par vitest : signature des webhooks AgentMail (Svix),
// lecture de l'expéditeur, typage des messages, garde-fous (fraude, boucles,
// authentification), choix de l'agent. Le traitement est dans index.ts.

// ─── Signature Svix (webhooks AgentMail) ──────────────────────────────────────
// Contenu signé : `${svix-id}.${svix-timestamp}.${corps brut}`, HMAC-SHA256 avec
// la clé décodée en base64 (après « whsec_ »), signature base64 précédée de « v1, ».

function b64(octets: ArrayBuffer): string {
  let s = "";
  for (const o of new Uint8Array(octets)) s += String.fromCharCode(o);
  return btoa(s);
}
function deb64(t: string) {
  const bin = atob(t);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function signerSvix(secret: string, id: string, horodatage: string, corps: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    "raw", deb64(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return b64(await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(`${id}.${horodatage}.${corps}`)));
}

/** Vérifie un webhook signé ; plusieurs secrets acceptés (rotation). Tolérance : 5 minutes. */
export async function verifierSvix(
  secrets: string[], entetes: { id: string | null; horodatage: string | null; signature: string | null },
  corps: string, maintenant = Date.now(),
): Promise<boolean> {
  const { id, horodatage, signature } = entetes;
  if (!id || !horodatage || !signature || !secrets.length) return false;
  const ts = Number(horodatage);
  if (!Number.isFinite(ts) || Math.abs(maintenant / 1000 - ts) > 300) return false;
  const recues = signature.split(" ").map((s) => s.split(",")).filter(([v]) => v === "v1").map(([, s]) => s ?? "");
  for (const secret of secrets) {
    const attendue = await signerSvix(secret, id, horodatage, corps);
    if (recues.some((r) => egal(r, attendue))) return true;
  }
  return false;
}

// ─── Lecture du message ──────────────────────────────────────────────────────

/** « Marie Hoarau <Marie@Exemple.re> » → « marie@exemple.re ». */
export function adresse(de: string): string {
  const m = /<([^>]+)>/.exec(de);
  return (m ? m[1] : de).trim().toLowerCase();
}

export type TypeMessage = "SUSPENDRE" | "REPRENDRE" | "VALIDATION" | "ORDRE";
export type Decision = { statut: "valide" | "refuse"; ref: string };

/** Référence courte d'un livrable, citée dans les e-mails : « L-1a2b3c4d ». */
export const refLivrable = (id: string) => `L-${id.replace(/-/g, "").slice(0, 8)}`;

/**
 * Nom d'un document produit, sans extension : Agent-Titre-Réf-vN (« Hugo-Posts-reseaux-sociaux-L-88e7c4db-v2 »).
 * Même règle que les exports du navigateur (src/studio/exportDoc.ts › nomFichier).
 */
export function nomDocument(p: { titre: string; agent?: string | null; id: string; version?: number | null }): string {
  const segment = (t: string, max: number) => t.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");
  return [p.agent ? segment(p.agent, 20) : "", segment(p.titre, 60) || "Document", refLivrable(p.id), `v${Math.max(1, p.version ?? 1)}`]
    .filter(Boolean).join("-");
}

/** Corps utile : sans la citation du message précédent (« Le … a écrit : », lignes « > »). */
export function corpsUtile(texte: string): string {
  const lignes: string[] = [];
  for (const l of texte.replace(/\r/g, "").split("\n")) {
    if (/^(le|on) .+(a écrit|wrote)\s*:?\s*$/i.test(l.trim()) || /^-{2,}\s*(original|message d'origine)/i.test(l.trim())) break;
    if (l.trim().startsWith(">")) continue;
    lignes.push(l);
  }
  return lignes.join("\n").trim();
}

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Décisions sur des livrables : « VALIDÉ L-1a2b3c4d », « REFUSÉ L-… ». */
export function decisions(texte: string): Decision[] {
  const out: Decision[] = [];
  const re = /\b(VALIDE|REFUSE)\s*:?\s*(L-[0-9a-f]{8})\b/gi;
  let m: RegExpExecArray | null;
  const t = sansAccents(texte);
  while ((m = re.exec(t))) out.push({ statut: m[1].toUpperCase() === "VALIDE" ? "valide" : "refuse", ref: m[2].toLowerCase().replace(/^l-/, "L-") });
  return out;
}

export function typer(sujet: string, texte: string): TypeMessage {
  const t = sansAccents(`${sujet}\n${texte.split("\n").slice(0, 3).join("\n")}`).toUpperCase();
  if (/\bSUSPENDRE\b/.test(t)) return "SUSPENDRE";
  if (/\bREPRENDRE\b/.test(t)) return "REPRENDRE";
  if (decisions(`${sujet}\n${texte}`).length) return "VALIDATION";
  return "ORDRE";
}

// ─── Garde-fous ──────────────────────────────────────────────────────────────

/**
 * Signaux de fraude au président : changement de coordonnées bancaires, virement
 * urgent, cartes cadeaux. Appliqué même aux messages d'un utilisateur autorisé :
 * c'est précisément le cas d'usage de l'arnaque. L'ordre n'est jamais exécuté.
 */
export function signauxFraude(texte: string): string[] {
  const t = sansAccents(texte).toLowerCase();
  const s: string[] = [];
  if (/\biban\b|\bbic\b|\brib\b|coordonnees bancaires|nouveau compte bancaire/.test(t)) s.push("coordonnées bancaires");
  if (/\bvirement\b|\btransfert d'argent\b|\bwire transfer\b/.test(t)) s.push("virement");
  if (/carte(s)? (cadeau|prepayee|google play|itunes|steam)|\bpcs\b|\bneosurf\b|\btransc?ash\b/.test(t)) s.push("cartes prépayées");
  if (/\bconfidentiel\b.*\burgent\b|\burgent\b.*\bconfidentiel\b|ne (le )?dites a personne/.test(t)) s.push("urgence confidentielle");
  return s;
}

/** Retours d'échec et réponses automatiques : jamais de réponse (pas de boucle). */
export function automatique(de: string, entetes: Record<string, string> = {}): boolean {
  const e = Object.fromEntries(Object.entries(entetes).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()]));
  if (/^(mailer-daemon|postmaster|no-?reply|ne-pas-repondre)@/.test(adresse(de))) return true;
  if (e["auto-submitted"] && e["auto-submitted"] !== "no") return true;
  if (e["x-autoreply"] || e["x-autorespond"] || /bulk|junk|list|auto_reply/.test(e["precedence"] ?? "")) return true;
  return false;
}

type Auth = { spf?: string; dkim?: string; dmarc?: string } | null | undefined;
/** Expéditeur usurpable : DMARC en échec, ou ni SPF ni DKIM valides. Sans résultats : on fait confiance. */
export function authentificationDouteuse(a: Auth): boolean {
  if (!a) return false;
  if (a.dmarc === "fail") return true;
  return a.spf !== undefined && a.dkim !== undefined && a.spf !== "pass" && a.dkim !== "pass";
}

// ─── Agent destinataire ──────────────────────────────────────────────────────

/**
 * L'agent est désigné en tête d'objet — « [Hugo] … », « Hugo : … » — ou par son
 * prénom au début du message ; à défaut, l'agent par défaut de l'espace.
 */
export function choisirAgent(sujet: string, texte: string, agents: { id: string; prenom: string }[], defaut: string | null): string | null {
  const norm = (t: string) => sansAccents(t).toLowerCase();
  const s = norm(sujet), debut = norm(texte.slice(0, 120));
  for (const a of agents) {
    const p = norm(a.prenom);
    if (new RegExp(`^\\s*(\\[${p}\\]|${p}\\s*[:,-])`).test(s) || new RegExp(`^\\s*(bonjour |salut )?${p}\\b`).test(debut)) return a.id;
  }
  return agents.some((a) => a.id === defaut) ? defaut : agents[0]?.id ?? null;
}

/** Sujet sans préfixes « Re: », « Fwd: » ni désignation d'agent. */
export function sujetPropre(sujet: string, prenom?: string): string {
  let s = sujet.replace(/^\s*((re|fwd?|tr)\s*:\s*)+/i, "").trim();
  if (prenom) s = s.replace(new RegExp(`^\\[${prenom}\\]\\s*|^${prenom}\\s*[:,-]\\s*`, "i"), "").trim();
  return s || "Votre demande";
}

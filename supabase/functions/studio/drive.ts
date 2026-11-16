// Google Drive pour les agents du Studio, via la connexion Nango de l'espace.
//
// Lecture (chercher, lister, lire) : immédiate, pendant la conversation.
// Écriture (créer un document) : JAMAIS pendant la conversation. L'agent prépare
// une proposition, enregistrée comme livrable « à valider » ; le dépôt dans le
// Drive n'a lieu qu'au « VALIDÉ » du propriétaire (gouvernance.ts).
//
// Le jeton d'accès Google est obtenu à la demande auprès de Nango (qui le
// renouvelle), pour la connexion de l'espace de la session uniquement.

const GOOGLE = "https://www.googleapis.com";
export const LECTURE_MAX = 30_000;

// ─── Partie pure (testée) ────────────────────────────────────────────────────

/** Échappe une valeur pour le langage de requête de Drive (q=…). */
export const echapperQ = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export function requeteRecherche(texte: string): string {
  const t = echapperQ(texte.trim().slice(0, 200));
  return `(name contains '${t}' or fullText contains '${t}') and trashed = false`;
}

export function requeteDossier(dossierId?: string | null): string {
  return dossierId ? `'${echapperQ(dossierId)}' in parents and trashed = false` : "trashed = false";
}

/** Format d'export d'un fichier Google natif ; null = téléchargement direct ; "illisible" = binaire. */
export function formatLecture(mime: string): { export?: string; direct?: boolean; illisible?: boolean } {
  if (mime === "application/vnd.google-apps.document") return { export: "text/plain" };
  if (mime === "application/vnd.google-apps.spreadsheet") return { export: "text/csv" };
  if (mime === "application/vnd.google-apps.presentation") return { export: "text/plain" };
  if (mime.startsWith("text/") || ["application/json", "application/xml", "application/csv"].includes(mime)) return { direct: true };
  return { illisible: true };
}

const echapperHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enLigne = (t: string) => echapperHtml(t)
  .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");

/** Markdown simple → HTML, importé par Drive en Google Doc (titres, listes, gras, paragraphes). */
export function markdownVersHtml(md: string): string {
  const out: string[] = [];
  let liste: "ul" | "ol" | null = null;
  const fermer = () => { if (liste) { out.push(`</${liste}>`); liste = null; } };
  for (const brute of md.replace(/\r/g, "").split("\n")) {
    const l = brute.trimEnd();
    const titre = /^(#{1,4})\s+(.*)$/.exec(l);
    const puce = /^\s*[-*•]\s+(.*)$/.exec(l);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(l);
    if (titre) { fermer(); out.push(`<h${titre[1].length}>${enLigne(titre[2])}</h${titre[1].length}>`); }
    else if (puce || num) {
      const type = puce ? "ul" : "ol";
      if (liste !== type) { fermer(); out.push(`<${type}>`); liste = type; }
      out.push(`<li>${enLigne((puce ?? num)![1])}</li>`);
    } else if (!l.trim()) fermer();
    else { fermer(); out.push(`<p>${enLigne(l)}</p>`); }
  }
  fermer();
  return `<html><head><meta charset="utf-8"></head><body>${out.join("")}</body></html>`;
}

/** Corps multipart/related de l'API d'envoi de Drive (métadonnées JSON + contenu HTML). */
export function corpsMultipart(meta: Record<string, unknown>, html: string, frontiere: string): string {
  return [
    `--${frontiere}`, "Content-Type: application/json; charset=UTF-8", "", JSON.stringify(meta),
    `--${frontiere}`, "Content-Type: text/html; charset=UTF-8", "", html, `--${frontiere}--`, "",
  ].join("\r\n");
}

// ─── Appels Google ───────────────────────────────────────────────────────────

export type FichierDrive = { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string };
const CHAMPS = "files(id,name,mimeType,modifiedTime,webViewLink)";

async function google(jeton: string, url: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, { ...init, headers: { "Authorization": `Bearer ${jeton}`, ...(init.headers ?? {}) } });
  if (r.status === 401 || r.status === 403) {
    const t = await r.text();
    throw new Error(/insufficient|scope/i.test(t)
      ? "La connexion Google Drive n'autorise pas cette opération (droits insuffisants). Reconnectez le Drive en acceptant l'accès complet."
      : `Accès au Drive refusé (${r.status}).`);
  }
  if (!r.ok) throw new Error(`Google Drive ${r.status} : ${(await r.text()).slice(0, 200)}`);
  return r;
}

const parametres = (q: string, extra: Record<string, string> = {}) => new URLSearchParams({
  q, fields: CHAMPS, pageSize: "15", supportsAllDrives: "true", includeItemsFromAllDrives: "true", ...extra,
}).toString();

export async function rechercher(jeton: string, texte: string): Promise<FichierDrive[]> {
  const r = await google(jeton, `${GOOGLE}/drive/v3/files?${parametres(requeteRecherche(texte))}`);
  return ((await r.json()).files ?? []) as FichierDrive[];
}

export async function lister(jeton: string, dossierId?: string | null): Promise<FichierDrive[]> {
  const r = await google(jeton, `${GOOGLE}/drive/v3/files?${parametres(requeteDossier(dossierId), { orderBy: "modifiedTime desc" })}`);
  return ((await r.json()).files ?? []) as FichierDrive[];
}

export async function lire(jeton: string, fichierId: string): Promise<{ fichier: FichierDrive; texte: string; tronque: boolean }> {
  const id = encodeURIComponent(fichierId);
  const meta = await (await google(jeton, `${GOOGLE}/drive/v3/files/${id}?fields=id,name,mimeType,modifiedTime,webViewLink&supportsAllDrives=true`)).json() as FichierDrive;
  const f = formatLecture(meta.mimeType);
  if (f.illisible) {
    return { fichier: meta, tronque: false, texte: `(Fichier « ${meta.name} » au format ${meta.mimeType} : contenu non lisible directement. Seuls les Google Docs, Sheets, Slides et fichiers texte sont lus.)` };
  }
  const url = f.export
    ? `${GOOGLE}/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(f.export)}`
    : `${GOOGLE}/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;
  const texte = await (await google(jeton, url)).text();
  return { fichier: meta, texte: texte.slice(0, LECTURE_MAX), tronque: texte.length > LECTURE_MAX };
}

/** Crée un Google Doc à partir de Markdown (appelé uniquement après validation). */
export async function creerDocument(jeton: string, p: { titre: string; contenu: string; dossierId?: string | null }): Promise<FichierDrive> {
  const frontiere = `studio${crypto.randomUUID().replace(/-/g, "")}`;
  const meta: Record<string, unknown> = { name: p.titre.slice(0, 200), mimeType: "application/vnd.google-apps.document" };
  if (p.dossierId) meta.parents = [p.dossierId];
  const r = await google(jeton, `${GOOGLE}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${frontiere}` },
    body: corpsMultipart(meta, markdownVersHtml(p.contenu), frontiere),
  });
  return await r.json() as FichierDrive;
}

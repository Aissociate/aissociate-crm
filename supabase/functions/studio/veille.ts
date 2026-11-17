// Veille : flux RSS / Atom suivis par un espace, agrégés dans studio_veille.
// Les agents lisent les actualités (outil veille_actualites), peuvent ouvrir un
// article de la veille (veille_lire_article) et en tirer des articles de blog
// ou des newsletters, toujours soumis à validation.
//
// Sécurité : seules des adresses http(s) publiques sont lues (pas d'IP privée,
// pas de localhost), redirections suivies à la main et revérifiées, 2 Mo et
// 10 s au plus par lecture. Le contenu des flux est une DONNÉE, jamais une consigne.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export const FLUX_MAX = 30;
const TAILLE_MAX = 2_000_000;
const DELAI_MS = 10_000;
const FRAICHEUR_MS = 30 * 60_000;
const CONSERVATION_JOURS = 90;

// ─── Partie pure (testée) ────────────────────────────────────────────────────

/** Adresse http(s) publique, sans identifiants ni port exotique ; null sinon. */
export function urlPublique(brut: unknown): string | null {
  let u: URL;
  try { u = new URL(String(brut ?? "").trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && !["80", "443"].includes(u.port)) return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h)) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return null;
  }
  if (h.includes(":")) return null; // IPv6 littérale
  u.hash = "";
  return u.toString();
}

const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ecirc: "ê", ocirc: "ô", ucirc: "û", icirc: "î", mdash: "—", ndash: "–", laquo: "«", raquo: "»" };

export function decoderEntites(t: string): string {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITES[e.toLowerCase()] ?? m;
  });
}

/** HTML → texte lisible (balises retirées, blancs resserrés). */
export function texteDeHtml(h: string): string {
  return decoderEntites(
    h.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|section|article|blockquote)>/gi, "\n").replace(/<[^>]+>/g, " "),
  ).replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const cdata = (t: string) => t.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
function balise(bloc: string, nom: string): string | null {
  const m = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, "i").exec(bloc);
  return m ? cdata(m[1]) : null;
}

export type ArticleFlux = { guid: string; titre: string; lien: string; resume: string; date: string | null };

function dateIso(t: string | null): string | null {
  if (!t) return null;
  const d = new Date(t.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Flux RSS 2.0 / RSS 1.0 / Atom → titre et 50 derniers articles. null si ce n'est pas un flux. */
export function analyserFlux(xml: string): { titre: string; site: string | null; articles: ArticleFlux[] } | null {
  const atom = /<feed[\s>]/i.test(xml);
  if (!atom && !/<(rss|rdf:RDF)[\s>]/i.test(xml)) return null;
  const blocs = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const entete = xml.split(atom ? /<entry[\s>]/i : /<item[\s>]/i)[0];
  const titre = texteDeHtml(balise(entete, "title") ?? "").slice(0, 200) || "Flux sans titre";
  const siteAtom = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(entete)?.[1] ?? /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(entete)?.[1];
  const site = atom ? siteAtom ?? null : texteDeHtml(balise(entete, "link") ?? "") || null;
  const articles: ArticleFlux[] = [];
  for (const b of blocs.slice(0, 50)) {
    const lien = atom
      ? (/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(b)?.[1] ?? /<link[^>]*href=["']([^"']+)["']/i.exec(b)?.[1] ?? "")
      : texteDeHtml(balise(b, "link") ?? "") || texteDeHtml(balise(b, "guid") ?? "");
    const t = texteDeHtml(balise(b, "title") ?? "").slice(0, 300);
    // Résumé souvent en HTML échappé (&lt;p&gt;) : entités décodées avant de retirer les balises.
    const brutResume = balise(b, atom ? "summary" : "description") ?? balise(b, "content") ?? balise(b, "content:encoded") ?? "";
    const resume = texteDeHtml(/<!\[CDATA\[/.test(brutResume) ? brutResume : decoderEntites(brutResume)).slice(0, 1500);
    const guid = texteDeHtml(balise(b, atom ? "id" : "guid") ?? "") || lien || t;
    if (!t && !lien) continue;
    articles.push({
      guid: guid.slice(0, 500), titre: t || "(sans titre)", lien: decoderEntites(lien).trim().slice(0, 1000), resume,
      date: dateIso(balise(b, atom ? "updated" : "pubDate") ?? balise(b, "published") ?? balise(b, "dc:date")),
    });
  }
  return { titre, site, articles };
}

/** Page HTML → adresse de son flux RSS / Atom déclaré, résolue par rapport à la page. */
export function decouvrirFlux(html: string, base: string): string | null {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const l = m[0];
    if (!/rel=["'][^"']*alternate/i.test(l) || !/type=["']application\/(rss|atom)\+xml["']/i.test(l)) continue;
    const href = /href=["']([^"']+)["']/i.exec(l)?.[1];
    if (href) { try { return new URL(decoderEntites(href), base).toString(); } catch { /* suivant */ } }
  }
  return null;
}

/** Texte principal d'une page d'article (balise article ou main si présente). */
export function texteArticle(html: string): { titre: string; texte: string } {
  const titre = texteDeHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").slice(0, 300);
  const coeur = /<article[\s>][\s\S]*<\/article>/i.exec(html)?.[0] ?? /<main[\s>][\s\S]*<\/main>/i.exec(html)?.[0]
    ?? html.replace(/<(header|nav|footer|aside)[\s\S]*?<\/\1>/gi, " ");
  return { titre, texte: texteDeHtml(coeur) };
}

// ─── Réseau ──────────────────────────────────────────────────────────────────

/** GET d'une adresse publique (redirections revérifiées, taille et durée bornées). */
export async function lireAdresse(url: string): Promise<{ url: string; type: string; corps: string }> {
  let courante = urlPublique(url);
  for (let saut = 0; saut < 4 && courante; saut++) {
    const r = await fetch(courante, {
      redirect: "manual", signal: AbortSignal.timeout(DELAI_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StudioIA-Veille/1.0)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5" },
    });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      await r.body?.cancel();
      courante = loc ? urlPublique(new URL(loc, courante).toString()) : null;
      continue;
    }
    if (!r.ok) { await r.body?.cancel(); throw new Error(`HTTP ${r.status}`); }
    const lecteur = r.body?.getReader();
    const morceaux: Uint8Array[] = [];
    let total = 0;
    while (lecteur) {
      const { done, value } = await lecteur.read();
      if (done) break;
      total += value.length;
      if (total > TAILLE_MAX) { await lecteur.cancel(); throw new Error("Document trop volumineux"); }
      morceaux.push(value);
    }
    const tout = new Uint8Array(total);
    let i = 0;
    for (const m of morceaux) { tout.set(m, i); i += m.length; }
    const type = r.headers.get("content-type") ?? "";
    const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? /encoding=["']([\w-]+)["']/i.exec(new TextDecoder().decode(tout.subarray(0, 200)))?.[1] ?? "utf-8";
    let corps: string;
    try { corps = new TextDecoder(charset.toLowerCase()).decode(tout); } catch { corps = new TextDecoder().decode(tout); }
    return { url: courante, type, corps };
  }
  throw new Error("Adresse non publique ou trop de redirections");
}

/** Une adresse de flux, ou de site qui en déclare un → adresse du flux, titre et articles. */
export async function trouverFlux(url: string) {
  const premier = await lireAdresse(url);
  const direct = analyserFlux(premier.corps);
  if (direct) return { url: premier.url, ...direct };
  const decouvert = decouvrirFlux(premier.corps, premier.url);
  if (!decouvert) throw new Error("Aucun flux RSS trouvé à cette adresse");
  const second = await lireAdresse(decouvert);
  const flux = analyserFlux(second.corps);
  if (!flux) throw new Error("Le flux déclaré par le site est illisible");
  return { url: second.url, ...flux };
}

// ─── Base ────────────────────────────────────────────────────────────────────

async function enregistrerArticles(sb: SupabaseClient, wsId: string, fluxId: string, articles: ArticleFlux[]) {
  if (!articles.length) return;
  const maintenant = new Date().toISOString();
  await sb.from("studio_veille").upsert(articles.map((a) => ({
    workspace_id: wsId, flux_id: fluxId, guid: a.guid, titre: a.titre, lien: a.lien || null, resume: a.resume,
    publie_le: a.date && a.date <= maintenant ? a.date : maintenant,
  })), { onConflict: "flux_id,guid", ignoreDuplicates: true });
}

export async function ajouterFlux(sb: SupabaseClient, wsId: string, brut: unknown) {
  if (!urlPublique(brut)) return { erreur: "Adresse invalide : une adresse web publique (https://…) est attendue." };
  const { count } = await sb.from("studio_flux").select("id", { count: "exact", head: true }).eq("workspace_id", wsId);
  if ((count ?? 0) >= FLUX_MAX) return { erreur: `${FLUX_MAX} flux au maximum par espace.` };
  let f;
  try { f = await trouverFlux(String(brut)); } catch (e) { return { erreur: `Flux illisible : ${e instanceof Error ? e.message : String(e)}` }; }
  const { data, error } = await sb.from("studio_flux").insert({
    workspace_id: wsId, url: f.url, titre: f.titre, site: f.site, derniere_lecture: new Date().toISOString(),
  }).select("id").single();
  if (error) return { erreur: error.code === "23505" ? "Ce flux est déjà suivi." : error.message };
  await enregistrerArticles(sb, wsId, data.id, f.articles);
  return { ok: true, titre: f.titre, articles: f.articles.length };
}

/** Relit les flux actifs pas lus depuis 30 min (tous si `forcer`). */
export async function actualiserFlux(sb: SupabaseClient, wsId: string, forcer = false): Promise<number> {
  let q = sb.from("studio_flux").select("id, url").eq("workspace_id", wsId).eq("actif", true);
  if (!forcer) q = q.or(`derniere_lecture.is.null,derniere_lecture.lt.${new Date(Date.now() - FRAICHEUR_MS).toISOString()}`);
  const { data: flux } = await q.limit(FLUX_MAX);
  await Promise.all((flux ?? []).map(async (f) => {
    try {
      const r = await lireAdresse(String(f.url));
      const a = analyserFlux(r.corps);
      if (!a) throw new Error("Ce n'est plus un flux RSS");
      await enregistrerArticles(sb, wsId, String(f.id), a.articles);
      await sb.from("studio_flux").update({ derniere_lecture: new Date().toISOString(), erreur: null }).eq("id", f.id);
    } catch (e) {
      await sb.from("studio_flux").update({ derniere_lecture: new Date().toISOString(), erreur: (e instanceof Error ? e.message : String(e)).slice(0, 300) }).eq("id", f.id);
    }
  }));
  await sb.from("studio_veille").delete().eq("workspace_id", wsId).lt("publie_le", new Date(Date.now() - CONSERVATION_JOURS * 86_400_000).toISOString());
  return flux?.length ?? 0;
}

/** Actualités des `heures` dernières heures, les plus récentes d'abord (filtre texte facultatif). */
export async function actualites(sb: SupabaseClient, wsId: string, o: { heures?: number; recherche?: string; max?: number } = {}) {
  const heures = Math.min(Math.max(Number(o.heures) || 24, 1), 24 * 30);
  let q = sb.from("studio_veille").select("id, titre, lien, resume, publie_le, studio_flux!inner(titre)")
    .eq("workspace_id", wsId).gte("publie_le", new Date(Date.now() - heures * 3_600_000).toISOString())
    .order("publie_le", { ascending: false }).limit(Math.min(Math.max(Number(o.max) || 40, 1), 100));
  const r = String(o.recherche ?? "").trim().replace(/[%_,()\\]/g, " ").slice(0, 80);
  if (r) q = q.or(`titre.ilike.%${r}%,resume.ilike.%${r}%`);
  const { data } = await q;
  return (data ?? []).map((x) => ({
    id: x.id, source: (x.studio_flux as unknown as { titre: string }).titre, titre: x.titre, lien: x.lien,
    date: String(x.publie_le).slice(0, 16), resume: String(x.resume ?? "").slice(0, 400),
  }));
}

// Prospection locale : fiches Google Maps d'entreprises (activité + zone) via Apify
// (https://docs.apify.com/api/v2), acteur « Google Maps Scraper » (compass/crawler-google-places).
//
// - Un seul compte Apify, celui d'Aissociate (secret APIFY_TOKEN) : le client ne connecte rien.
// - Une recherche = un « run » Apify. L'API attend 60 s au plus par appel : prospects_chercher
//   lance le run et rend les fiches s'il finit à temps ; sinon l'agent rappelle prospects_resultats.
// - Coût : facturé à la fiche. Entrée minimale (ni avis, ni photos, ni enrichissement) et plafond
//   par recherche (maxItems). Côté client, les fiches puisent dans les contacts prépayés de
//   l'option Prospection (prospection_option.ts).
// - Les fiches décrivent des ENTREPRISES (nom, téléphone, site) : aucune adresse e-mail n'est
//   collectée ici, et rien n'est ajouté aux contacts des mailings (réservés aux abonnés consentants).
// Les fonctions sans réseau sont pures (testées).

const BASE = "https://api.apify.com/v2";
export const ACTEUR = "compass~crawler-google-places";
export const FICHES_MAX = 50;
export const FICHES_DEFAUT = 20;
/** Garde-fou de dépense par recherche, en dollars, quel que soit le tarif de l'acteur. */
const DEPENSE_MAX_USD = 1;
/** Agents qui disposent des outils de prospection. */
export const AGENTS_PROSPECTION = ["sam"];

export const apifyConfigure = () => Boolean(Deno.env.get("APIFY_TOKEN"));
export const prospectionActive = (agentId: string | null | undefined) => AGENTS_PROSPECTION.includes(String(agentId ?? ""));

export type Prospect = {
  nom: string; categorie: string; adresse: string; ville: string; code_postal: string;
  telephone: string; site: string; note: number | null; avis: number | null; lien: string; place_id: string;
};

/** Texte d'un champ de recherche : espaces réduits, longueur bornée. */
export function texteRecherche(brut: unknown, max = 120): string {
  return String(brut ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Nombre de fiches demandé, borné à [5, FICHES_MAX] (FICHES_DEFAUT sinon). */
export function nombreFiches(brut: unknown): number {
  const n = Math.round(Number(String(brut ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? Math.min(FICHES_MAX, Math.max(5, n)) : FICHES_DEFAUT;
}

/** Entrée de l'acteur, au coût le plus bas : la fiche seule, sans avis, photos ni enrichissement. */
export function entreeActeur(activite: string, zone: string, nombre: number): Record<string, unknown> {
  return {
    searchStringsArray: [activite], locationQuery: zone, maxCrawledPlacesPerSearch: nombre,
    language: "fr", skipClosedPlaces: true,
    scrapePlaceDetailPage: false, scrapeContacts: false, maxReviews: 0, maxImages: 0,
    maximumLeadsEnrichmentRecords: 0, enableCompetitorAnalysis: false,
  };
}

const adresseWeb = (brut: unknown): string => {
  const x = String(brut ?? "").trim();
  return /^https?:\/\/[^\s]+$/i.test(x) ? x.slice(0, 300) : "";
};
const nombreOuNul = (brut: unknown): number | null => {
  const n = Number(brut);
  return brut !== null && brut !== undefined && brut !== "" && Number.isFinite(n) ? n : null;
};
const court = (brut: unknown, max: number) => String(brut ?? "").replace(/[\s|]+/g, " ").trim().slice(0, max);

/** Fiches de l'acteur → prospects : sans nom, fermée définitivement ou en double = écartée. */
export function normaliser(items: unknown, max = FICHES_MAX): Prospect[] {
  const vus = new Set<string>();
  const out: Prospect[] = [];
  for (const brut of Array.isArray(items) ? items : []) {
    const i = (brut ?? {}) as Record<string, unknown>;
    const nom = court(i.title, 150);
    if (!nom || i.permanentlyClosed === true) continue;
    const place_id = court(i.placeId, 100);
    const cle = place_id || `${nom}|${court(i.address, 200)}`.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({
      nom, categorie: court(i.categoryName, 80), adresse: court(i.address, 200), ville: court(i.city, 80),
      code_postal: court(i.postalCode, 12), telephone: court(i.phone, 30), site: adresseWeb(i.website),
      note: nombreOuNul(i.totalScore), avis: nombreOuNul(i.reviewsCount), lien: adresseWeb(i.url), place_id,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Tableau Markdown des prospects, pour l'agent (et pour une note de l'espace). */
export function tableau(prospects: Prospect[]): string {
  if (!prospects.length) return "(aucune fiche)";
  const ligne = (p: Prospect, n: number) =>
    `| ${n} | ${p.nom} | ${p.categorie || "—"} | ${[p.code_postal, p.ville].filter(Boolean).join(" ") || p.adresse || "—"} | ${p.telephone || "—"} | ${p.site || "—"} | ${p.note === null ? "—" : `${p.note}${p.avis === null ? "" : ` (${p.avis} avis)`}`} |`;
  return ["| N° | Entreprise | Activité | Commune | Téléphone | Site | Note Google |", "|---|---|---|---|---|---|---|",
    ...prospects.map((p, k) => ligne(p, k + 1))].join("\n");
}

/** Début du mois en cours à La Réunion (UTC+4), en ISO. */
export function debutMois(maintenant = Date.now()): string {
  const d = new Date(maintenant + 4 * 3_600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - 4 * 3_600_000).toISOString();
}

export const refRecherche = (id: string) => `P-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
/** Préfixe d'identifiant (8 caractères hexadécimaux) d'une référence « P-XXXXXXXX » ; null si illisible. */
export function prefixeReference(brut: unknown): string | null {
  const m = /^\s*(?:P-)?([0-9a-f]{8})\s*$/i.exec(String(brut ?? ""));
  return m ? m[1].toLowerCase() : null;
}

// ─── Appels Apify ───────────────────────────────────────────────────────────
export type EtatRun = { id: string; statut: "en_cours" | "terminee" | "echec"; dataset: string; detail: string };

const ETATS_FINIS_KO = new Set(["FAILED", "TIMED-OUT", "ABORTED"]);
/** Objet « run » d'Apify → état simple. Un run interrompu par un plafond (maxItems) peut finir ABORTED avec des fiches : géré par l'appelant. */
export function etatRun(run: unknown): EtatRun {
  const r = (run ?? {}) as Record<string, unknown>;
  const s = String(r.status ?? "");
  return {
    id: String(r.id ?? ""), dataset: String(r.defaultDatasetId ?? ""), detail: String(r.statusMessage ?? "").slice(0, 200),
    statut: s === "SUCCEEDED" ? "terminee" : ETATS_FINIS_KO.has(s) ? "echec" : "en_cours",
  };
}

async function appel(chemin: string, init?: RequestInit): Promise<unknown> {
  const token = Deno.env.get("APIFY_TOKEN");
  if (!token) throw new Error("APIFY_TOKEN absent");
  const r = await fetch(`${BASE}${chemin}`, {
    ...init, signal: AbortSignal.timeout(75_000),
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Apify ${r.status} ${String((j as { error?: { message?: string } } | null)?.error?.message ?? "").slice(0, 150)}`.trim());
  return j;
}

/** Lance une recherche et attend 60 s au plus. */
export async function lancer(activite: string, zone: string, nombre: number): Promise<EtatRun> {
  const q = new URLSearchParams({ waitForFinish: "60", maxItems: String(nombre), maxTotalChargeUsd: String(DEPENSE_MAX_USD), timeout: "300" });
  const j = await appel(`/actors/${ACTEUR}/runs?${q}`, { method: "POST", body: JSON.stringify(entreeActeur(activite, zone, nombre)) });
  return etatRun((j as { data?: unknown } | null)?.data);
}

/** État d'un run déjà lancé ; attend 60 s au plus qu'il finisse. */
export async function suivre(runId: string): Promise<EtatRun> {
  const j = await appel(`/actor-runs/${encodeURIComponent(runId)}?waitForFinish=60`);
  return etatRun((j as { data?: unknown } | null)?.data);
}

const CHAMPS = "title,categoryName,address,city,postalCode,phone,website,totalScore,reviewsCount,url,placeId,permanentlyClosed";
/** Fiches d'un run (réponse = tableau JSON brut). */
export async function fiches(datasetId: string, nombre: number): Promise<Prospect[]> {
  const q = new URLSearchParams({ format: "json", clean: "true", limit: String(nombre + 10), fields: CHAMPS });
  return normaliser(await appel(`/datasets/${encodeURIComponent(datasetId)}/items?${q}`), nombre);
}

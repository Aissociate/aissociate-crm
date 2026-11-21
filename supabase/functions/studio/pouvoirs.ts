// Super-pouvoirs utilisés par les agents eux-mêmes, et pas seulement par le formulaire du chat.
//
// - rendrePouvoir : la consigne détaillée (gabarit) d'un super-pouvoir remplie avec des valeurs,
//   commune au formulaire, à l'outil des agents et aux missions confiées par Léa.
// - creer_media : un agent qui a un super-pouvoir média (visuel, vidéo) le lance lui-même, dans
//   une conversation libre ou une mission ; quotas et crédits comme pour le formulaire (index.ts).
// - Marqueur [[MEDIA:id:type]] : ajouté à la réponse, il affiche le média dans le chat.
// Module pur (testé).
import type { Champ, SuperPouvoir } from "./contexte.ts";
import type { DefinitionOutil } from "./outils.ts";

export const NOM_OUTIL_MEDIA = "creer_media";
/** Visuels et vidéos qu'un agent peut lancer dans une même demande. */
export const MAX_MEDIAS = 4;

export type Rendu = {
  question: string; affichage: string; titre: string;
  media: { type: "image" | "video"; format?: string; duree?: string } | null;
};

/** Valeur d'un champ, bornée ; un choix hors liste est ignoré. Un choix proche (casse, « Carré (1:1) » pour « 1:1 ») est accepté. */
export function valeurChamp(c: Champ, brut: unknown): string {
  const x = String(brut ?? "").trim().slice(0, c.type === "long" ? 12000 : 500);
  if (c.type !== "choix" || !c.options?.length || !x) return x;
  if (c.options.includes(x)) return x;
  const bas = x.toLowerCase();
  if (bas.length < 3) return c.options.find((o) => o.toLowerCase() === bas) ?? "";
  return c.options.find((o) => o.toLowerCase() === bas || o.toLowerCase().includes(bas) || bas.includes(o.toLowerCase())) ?? "";
}

/** Gabarit rempli, ou le premier champ requis manquant. */
export function rendrePouvoir(sp: SuperPouvoir, valeurs: Record<string, unknown>): Rendu | { manquant: Champ } {
  const val = (c: Champ) => valeurChamp(c, valeurs[c.nom]);
  const manquant = sp.champs.find((c) => c.requis && !val(c));
  if (manquant) return { manquant };
  const question = sp.gabarit.replace(/\{\{(\w+)\}\}/g, (_m, nom: string) => {
    const c = sp.champs.find((x) => x.nom === nom);
    return (c && val(c)) || "(non précisé)";
  });
  const affichage = `**${sp.titre}**\n` + sp.champs.filter((c) => val(c))
    .map((c) => `- ${c.label} : ${val(c).length > 300 ? val(c).slice(0, 300) + "…" : val(c)}`).join("\n");
  const titre = `${sp.titre} — ${(sp.champs[0] && val(sp.champs[0])) || ""}`.slice(0, 80);
  let media: Rendu["media"] = null;
  if (sp.media === "image" || sp.media === "video") {
    const champ = (nom: string) => { const c = sp.champs.find((x) => x.nom === nom); return c ? val(c) : undefined; };
    media = { type: sp.media, format: champ("format"), duree: champ("duree") };
  }
  return { question, affichage, titre, media };
}

export const pouvoirsMedia = (pouvoirs: SuperPouvoir[] | null | undefined) => (pouvoirs ?? []).filter((p) => p.media === "image" || p.media === "video");

const decrireChamps = (p: Pick<SuperPouvoir, "champs">) => p.champs.map((c) =>
  `${c.nom}${c.requis ? " (requis)" : ""}${c.options?.length ? ` : ${c.options.join(" | ")}` : ""}`).join(" ; ");

/** Outil « créer un visuel / une vidéo » d'un agent qui a des super-pouvoirs média. */
export function definitionMedia(pouvoirs: SuperPouvoir[]): DefinitionOutil {
  return {
    type: "function", function: {
      name: NOM_OUTIL_MEDIA,
      description: "Crée un visuel (image) ou une vidéo avec ton super-pouvoir, et l'affiche au client dans la conversation. "
        + `Compte sur les quotas de visuels et de vidéos du client. ${MAX_MEDIAS} au plus par demande. Super-pouvoirs : `
        + pouvoirs.map((p) => `${p.id} = ${p.titre} (${p.media === "video" ? "vidéo" : "image"} ; champs : ${decrireChamps(p)})`).join(" · "),
      parameters: {
        type: "object",
        properties: {
          pouvoir: { type: "string", enum: pouvoirs.map((p) => p.id), description: "Super-pouvoir média utilisé" },
          valeurs: {
            type: "object", additionalProperties: { type: "string" },
            description: "Valeurs des champs du super-pouvoir, par nom de champ. Le sujet : une description visuelle précise et concrète (scène, cadrage, ambiance), sans texte incrusté.",
          },
        },
        required: ["pouvoir", "valeurs"],
      },
    },
  };
}

export function consigneMedia(pouvoirs: SuperPouvoir[]): string {
  return `## Outil : créer un visuel ou une vidéo
- ${NOM_OUTIL_MEDIA} lance tes super-pouvoirs média (${pouvoirs.map((p) => `« ${p.titre} »`).join(", ")}) : utilise-le dès qu'on te demande un visuel, une image, une illustration ou une vidéo, au lieu d'en écrire seulement la description.
- Le média s'affiche tout seul au client sous ta réponse (création en cours, puis prêt) et rejoint « Mes contenus » : ne colle pas de lien, dis simplement ce que tu as lancé.
- Une image ne contient pas de texte lisible : le message s'écrit dans le post, pas dans l'image.
- Pour publier le média avec un post, donne sa référence « media:… » (renvoyée par ${NOM_OUTIL_MEDIA}) dans medias de reseaux_proposer_publication : le dirigeant le verra dans la décision à valider.`;
}

// ─── Marqueur de média dans une réponse ─────────────────────────────────────
export const marqueurMedia = (id: string, type: "image" | "video") => `[[MEDIA:${id}:${type}]]`;
const MARQUEUR = /\[\[MEDIA:([0-9a-f-]{36}):(image|video)\]\]/gi;

/** Médias cités dans un texte, dans l'ordre, sans doublon. */
export function mediasDe(texte: string): { id: string; type: "image" | "video" }[] {
  const vus = new Set<string>();
  const out: { id: string; type: "image" | "video" }[] = [];
  for (const m of texte.matchAll(MARQUEUR)) {
    const id = m[1].toLowerCase();
    if (vus.has(id)) continue;
    vus.add(id);
    out.push({ id, type: m[2].toLowerCase() as "image" | "video" });
  }
  return out;
}

export const sansMarqueurs = (texte: string) => texte.replace(MARQUEUR, "").replace(/\n{3,}/g, "\n\n").trim();

/** Ligne de marqueurs à ajouter à la réponse finale pour les médias absents du texte. */
export function ajoutMedias(texte: string, medias: { id: string; type: "image" | "video" }[]): string {
  const deja = new Set(mediasDe(texte).map((m) => m.id));
  const manquants = medias.filter((m) => !deja.has(m.id.toLowerCase()));
  return manquants.length ? `\n\n${manquants.map((m) => marqueurMedia(m.id, m.type)).join("\n")}` : "";
}

// ─── Missions : Léa active le super-pouvoir d'un spécialiste ────────────────
export type PouvoirCollegue = { id: string; titre: string; media?: "image" | "video"; champs: Champ[] };

/** Liste lisible des super-pouvoirs d'un spécialiste, pour le prompt de Léa. */
export const listePouvoirs = (pouvoirs: PouvoirCollegue[] | undefined) =>
  (pouvoirs ?? []).map((p) => `${p.id} (${p.titre}${p.media ? `, ${p.media === "video" ? "vidéo" : "visuel"} créé directement` : ""} ; champs : ${decrireChamps(p)})`).join(" · ");

// ─── Visuels du Studio dans une publication à valider ───────────────────────
export const referenceMedia = (id: string) => `media:${id}`;
const REFERENCE = /^(?:media:([0-9a-f-]{36})|\[\[MEDIA:([0-9a-f-]{36}):(?:image|video)\]\])$/i;

/**
 * Références « media:… » d'un texte (document, publication) complétées en identifiant entier :
 * un agent abrège parfois l'identifiant (« media:de54207b »), que ni l'aperçu ni la publication
 * ne savent alors retrouver. Seul un préfixe désignant un unique média de l'espace est complété.
 */
export function completerReferences(texte: string, ids: string[]): string {
  const connus = ids.map((i) => i.toLowerCase());
  return texte.replace(/media:([0-9a-f][0-9a-f-]{5,35})/gi, (tout, brut: string) => {
    const p = brut.toLowerCase().replace(/-+$/, "");
    if (p.length === 36) return tout;
    const trouves = connus.filter((i) => i.startsWith(p));
    return trouves.length === 1 ? `media:${trouves[0]}${brut.slice(p.length)}` : tout;
  });
}

/** Sépare les médias d'une publication : visuels du Studio (media:id ou repère) et adresses https. */
export function separerMedias(brut: unknown): { studio: string[]; adresses: string[] } {
  const liste = (Array.isArray(brut) ? brut.map(String) : String(brut ?? "").split(/[\s,]+/)).map((x) => x.trim()).filter(Boolean);
  const studio: string[] = [], adresses: string[] = [];
  for (const x of liste) {
    const m = REFERENCE.exec(x);
    if (m) { const id = (m[1] ?? m[2]).toLowerCase(); if (!studio.includes(id)) studio.push(id); }
    else adresses.push(x);
  }
  return { studio, adresses };
}

/** Durée du lien signé d'un visuel publié : jusqu'à la publication programmée + 2 jours (30 jours au plus). */
export function dureeLien(programme: string | null | undefined, maintenant = Date.now()): number {
  const t = programme ? Date.parse(`${programme}:00+04:00`) : NaN;
  const s = Number.isNaN(t) ? 0 : Math.ceil((t - maintenant) / 1000);
  return Math.min(30 * 86_400, Math.max(0, s) + 2 * 86_400);
}

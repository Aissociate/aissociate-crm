// Recharges de crédits du Studio : au-delà des quotas mensuels (missions, visuels, vidéos),
// chaque usage puise dans un solde de crédits acheté par packs (10 € / 30 € HT par défaut).
// Le solde est un registre de mouvements (studio_recharges) : il ne s'efface jamais et se
// reporte de mois en mois. Packs et coûts : studio_config, packs modifiables par espace.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type Ressource = "demande" | "image" | "video";
export type Pack = { prix: number; credits: number };
export type Couts = Record<Ressource, number>;

const CLES = [
  "recharge_petit_prix_ht", "recharge_petit_credits", "recharge_grand_prix_ht", "recharge_grand_credits",
  "recharge_cout_demande", "recharge_cout_image", "recharge_cout_video",
];
export const PACKS_DEFAUT: Pack[] = [{ prix: 10, credits: 100 }, { prix: 30, credits: 350 }];
export const COUTS_DEFAUT: Couts = { demande: 1, image: 5, video: 30 };
const LIBELLE: Record<Ressource, string> = { demande: "demande", image: "visuel", video: "vidéo" };

const positif = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Packs de l'espace : réglage du client s'il est valide, sinon ceux des Paramètres, sinon défaut. */
export function packsEffectifs(cfg: Record<string, string>, propres: unknown): Pack[] {
  const globaux: Pack[] = [
    { prix: positif(cfg.recharge_petit_prix_ht) ?? PACKS_DEFAUT[0].prix, credits: Math.round(positif(cfg.recharge_petit_credits) ?? PACKS_DEFAUT[0].credits) },
    { prix: positif(cfg.recharge_grand_prix_ht) ?? PACKS_DEFAUT[1].prix, credits: Math.round(positif(cfg.recharge_grand_credits) ?? PACKS_DEFAUT[1].credits) },
  ];
  if (!Array.isArray(propres)) return globaux;
  return globaux.map((g, i) => {
    const p = propres[i] as Partial<Pack> | undefined;
    return { prix: positif(p?.prix) ?? g.prix, credits: Math.round(positif(p?.credits) ?? g.credits) };
  });
}

export function coutsEffectifs(cfg: Record<string, string>): Couts {
  return {
    demande: Math.round(positif(cfg.recharge_cout_demande) ?? COUTS_DEFAUT.demande),
    image: Math.round(positif(cfg.recharge_cout_image) ?? COUTS_DEFAUT.image),
    video: Math.round(positif(cfg.recharge_cout_video) ?? COUTS_DEFAUT.video),
  };
}

/** Message affiché quand le quota du mois et les crédits sont épuisés. */
export function messageEpuise(ressource: Ressource, quota: number, achatLibre: boolean): string {
  const quoi = ressource === "demande" ? `${quota} demandes` : ressource === "image" ? `${quota} visuels` : `${quota} vidéos`;
  return `Quota mensuel atteint (${quoi}) et crédits de recharge insuffisants. ` +
    (achatLibre ? "Ajoutez une recharge depuis « Mon périmètre » pour continuer." : "Contactez Aissociate pour ajouter des crédits.");
}

async function config(sb: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await sb.from("studio_config").select("cle, valeur").in("cle", CLES);
  return Object.fromEntries((data ?? []).map((r) => [r.cle, String(r.valeur ?? "")]));
}

/** Réglages de l'espace (colonnes absentes = migration non appliquée → valeurs par défaut). */
async function reglages(sb: SupabaseClient, wsId: string) {
  const [cfg, w] = await Promise.all([
    config(sb),
    sb.from("studio_workspaces").select("recharge_packs, recharge_achat_libre").eq("id", wsId).maybeSingle(),
  ]);
  return {
    packs: packsEffectifs(cfg, w.data?.recharge_packs),
    couts: coutsEffectifs(cfg),
    achatLibre: w.error ? false : w.data?.recharge_achat_libre !== false,
  };
}

export async function solde(sb: SupabaseClient, wsId: string): Promise<number> {
  const { data, error } = await sb.from("studio_recharges").select("credits").eq("workspace_id", wsId).limit(10000);
  if (error) return 0;
  return (data ?? []).reduce((t, r) => t + (Number(r.credits) || 0), 0);
}

/** Vérifie qu'un usage au-delà du quota peut être couvert ; renvoie le message de refus sinon. */
export async function couvrable(sb: SupabaseClient, wsId: string, ressource: Ressource, quota: number): Promise<string | null> {
  const [r, s] = await Promise.all([reglages(sb, wsId), solde(sb, wsId)]);
  return s >= r.couts[ressource] ? null : messageEpuise(ressource, quota, r.achatLibre);
}

/** Débite un usage au-delà du quota. */
export async function puiser(sb: SupabaseClient, wsId: string, ressource: Ressource, acteur: string, mediaId?: string): Promise<void> {
  const { couts } = await reglages(sb, wsId);
  await sb.from("studio_recharges").insert({
    workspace_id: wsId, nature: "consommation", credits: -couts[ressource], ressource,
    media_id: mediaId ?? null, acteur, note: `1 ${LIBELLE[ressource]} au-delà du quota`,
  });
}

/** Annule le débit d'un usage qui ne doit pas compter (demande relayée). */
export async function recrediter(sb: SupabaseClient, wsId: string, ressource: Ressource, note: string): Promise<void> {
  const { couts } = await reglages(sb, wsId);
  await sb.from("studio_recharges").insert({ workspace_id: wsId, nature: "correction", credits: couts[ressource], ressource, acteur: "studio", note });
}

/** Visuel ou vidéo en échec : la consommation est annulée. */
export async function rembourserMedia(sb: SupabaseClient, mediaId: string): Promise<void> {
  await sb.from("studio_recharges").delete().eq("media_id", mediaId).eq("nature", "consommation");
}

function debutMois(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** État affiché au client (Mon périmètre). */
export async function etat(sb: SupabaseClient, wsId: string) {
  const [r, s, { data: mvts }] = await Promise.all([
    reglages(sb, wsId), solde(sb, wsId),
    sb.from("studio_recharges").select("nature, credits, ressource, prix_ht, note, created_at")
      .eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(200),
  ]);
  const mois = debutMois();
  const duMois = (mvts ?? []).filter((m) => String(m.created_at) >= mois);
  return {
    solde: s, packs: r.packs, couts: r.couts, achat_libre: r.achatLibre,
    consommes_mois: -duMois.filter((m) => m.nature === "consommation").reduce((t, m) => t + Number(m.credits), 0),
    // Consommations regroupées : l'historique montre les ajouts, pas chaque demande ni les recrédits automatiques.
    historique: (mvts ?? []).filter((m) => m.nature === "achat" || m.nature === "offert" || (m.nature === "correction" && !m.ressource)).slice(0, 20),
  };
}

/** Achat en libre-service d'un pack par le propriétaire de l'espace. */
export async function acheter(sb: SupabaseClient, wsId: string, index: number, acteur: string): Promise<{ ok: true; pack: Pack } | { erreur: string; statut: number }> {
  const r = await reglages(sb, wsId);
  if (!r.achatLibre) return { erreur: "L'achat de recharges en ligne n'est pas ouvert pour cet espace. Contactez Aissociate.", statut: 403 };
  const pack = r.packs[index];
  if (!pack) return { erreur: "Recharge inconnue", statut: 400 };
  const { error } = await sb.from("studio_recharges").insert({
    workspace_id: wsId, nature: "achat", credits: pack.credits, prix_ht: pack.prix, acteur,
    note: `Recharge de ${pack.credits} crédits`,
  });
  return error ? { erreur: error.message, statut: 500 } : { ok: true, pack };
}

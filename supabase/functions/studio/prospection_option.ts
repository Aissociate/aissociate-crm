// Option « Prospection » de Sam : les fiches Google Maps (prospection.ts) sont facturées à part,
// par packs de contacts prépayés (15 € HT les 1 000 par défaut), distincts des crédits de recharge.
//
// - Registre de mouvements (studio_prospection_contacts) : achat, offert, découverte, correction,
//   consommation. Le solde est la somme des contacts ; il se reporte sans date limite.
// - L'option est « activée » dès que le solde est positif : sans contact, prospects_chercher
//   refuse et renvoie vers « Mon périmètre ».
// - Une recherche réserve ses fiches au lancement (une ligne de consommation par recherche),
//   puis la réserve est ramenée au nombre de fiches réellement trouvées ; un échec ne coûte rien.
// - Stage (contrat gratuit) : 10 contacts offerts, une seule fois par espace (nature
//   « decouverte », index unique).
// Pack : studio_config `prospection_pack_prix_ht` / `prospection_pack_contacts`.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type Pack = { prix: number; contacts: number };
export const PACK_DEFAUT: Pack = { prix: 15, contacts: 1000 };
export const OFFERTS_STAGE = 10;
const CLES = ["prospection_pack_prix_ht", "prospection_pack_contacts"];
const TABLE = "studio_prospection_contacts";

// ─── Partie pure (testée) ────────────────────────────────────────────────────

const positif = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Pack vendu : réglage des Paramètres s'il est valide, sinon 15 € HT les 1 000 contacts. */
export function packEffectif(cfg: Record<string, string>): Pack {
  return {
    prix: positif(cfg.prospection_pack_prix_ht) ?? PACK_DEFAUT.prix,
    contacts: Math.round(positif(cfg.prospection_pack_contacts) ?? PACK_DEFAUT.contacts),
  };
}

const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const euros = (n: number) => `${n.toFixed(2).replace(".", ",").replace(/,00$/, "")} €`;
/** « 15 € HT les 1 000 contacts ». */
export const libellePack = (p: Pack) => `${euros(p.prix)} HT les ${milliers(p.contacts)} contacts`;

/** Fiches qu'une recherche peut demander : la demande, bornée par le solde (0 = refus). */
export function fichesPossibles(demande: number, solde: number): number {
  return Math.max(0, Math.min(Math.floor(demande), Math.floor(solde)));
}

/** Refus de l'outil quand le solde ne couvre aucune fiche : dit à l'agent quoi répondre. */
export function messageEpuise(pack: Pack, dejaAchete: boolean): string {
  return `${dejaAchete ? "Les contacts de l'option Prospection sont épuisés" : "L'option Prospection n'est pas activée pour cet espace"} : `
    + `aucune recherche n'est lancée. Dis au dirigeant que le propriétaire de l'espace peut ${dejaAchete ? "en racheter" : "l'activer"} `
    + `depuis « Mon périmètre » (${libellePack(pack)}, paiement en ligne). Les recherches déjà faites restent lisibles avec prospects_resultats.`;
}

// ─── Base ────────────────────────────────────────────────────────────────────

export async function pack(sb: SupabaseClient): Promise<Pack> {
  const { data } = await sb.from("studio_config").select("cle, valeur").in("cle", CLES);
  return packEffectif(Object.fromEntries((data ?? []).map((r) => [r.cle, String(r.valeur ?? "")])));
}

export async function solde(sb: SupabaseClient, wsId: string): Promise<number> {
  const { data, error } = await sb.from(TABLE).select("contacts").eq("workspace_id", wsId).limit(10000);
  if (error) return 0;
  return (data ?? []).reduce((t, r) => t + (Number(r.contacts) || 0), 0);
}

/** Espace en Stage : 10 contacts offerts, une seule fois (l'index unique écarte le doublon). */
export async function offrirDecouverte(sb: SupabaseClient, wsId: string): Promise<void> {
  const { data: w } = await sb.from("studio_workspaces").select("contrat").eq("id", wsId).maybeSingle();
  if (w?.contrat !== "stage") return;
  await sb.from(TABLE).insert({
    workspace_id: wsId, nature: "decouverte", contacts: OFFERTS_STAGE, acteur: "studio",
    note: `${OFFERTS_STAGE} contacts offerts (Stage)`,
  });
}

/** Solde utilisable, cadeau du Stage compris. */
export async function disponible(sb: SupabaseClient, wsId: string): Promise<number> {
  await offrirDecouverte(sb, wsId);
  return solde(sb, wsId);
}

/** Un achat (ou un geste d'Aissociate) a-t-il déjà eu lieu ? Sert au ton du message de refus. */
export async function dejaAchete(sb: SupabaseClient, wsId: string): Promise<boolean> {
  const { count } = await sb.from(TABLE).select("id", { count: "exact", head: true }).eq("workspace_id", wsId).in("nature", ["achat", "offert"]);
  return (count ?? 0) > 0;
}

/** Réserve les fiches d'une recherche au lancement. */
export async function reserver(sb: SupabaseClient, p: { wsId: string; prospectionId: string; fiches: number; acteur: string; note: string }): Promise<string | null> {
  const { error } = await sb.from(TABLE).insert({
    workspace_id: p.wsId, nature: "consommation", contacts: -Math.abs(Math.floor(p.fiches)), prospection_id: p.prospectionId,
    acteur: p.acteur, note: p.note.slice(0, 200),
  });
  return error ? error.message : null;
}

/** Recherche close : la réserve devient le nombre de fiches trouvées ; aucune fiche ou échec = rien de compté. */
export async function solder(sb: SupabaseClient, prospectionId: string, trouvees: number): Promise<void> {
  const q = sb.from(TABLE);
  if (trouvees > 0) await q.update({ contacts: -Math.floor(trouvees) }).eq("prospection_id", prospectionId).eq("nature", "consommation");
  else await q.delete().eq("prospection_id", prospectionId).eq("nature", "consommation");
}

function debutMois(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** État affiché au client (Mon périmètre). */
export async function etat(sb: SupabaseClient, wsId: string) {
  await offrirDecouverte(sb, wsId);
  const [pk, { data: mvts }] = await Promise.all([
    pack(sb),
    sb.from(TABLE).select("nature, contacts, prix_ht, note, created_at").eq("workspace_id", wsId).order("created_at", { ascending: false }).limit(1000),
  ]);
  const tous = mvts ?? [];
  const mois = debutMois();
  return {
    solde: tous.reduce((t, m) => t + (Number(m.contacts) || 0), 0), pack: pk,
    utilises_mois: -tous.filter((m) => m.nature === "consommation" && String(m.created_at) >= mois).reduce((t, m) => t + Number(m.contacts), 0),
    historique: tous.filter((m) => m.nature !== "consommation").slice(0, 20),
  };
}

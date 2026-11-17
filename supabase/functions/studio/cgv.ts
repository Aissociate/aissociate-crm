// CGV et accord de traitement des données (RGPD) acceptés à la première connexion.
// Les textes sont des livrables publiés de l'espace Aissociate, désignés dans studio_config
// (`cgv_livrables` = ids séparés par des virgules, dans l'ordre d'affichage). La version est
// l'empreinte des textes : toute modification redemande l'acceptation à chacun.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type Cgv = { version: string; documents: { titre: string; contenu: string }[] };

let cache: { quand: number; valeur: Cgv | null } | null = null;
const DUREE_CACHE_MS = 5 * 60_000;

/** Titre lisible : sans le préfixe « Drive — » ni la mention de modèle. */
export function titreCgv(t: string): string {
  return t.replace(/^Drive\s+—\s+/, "").replace(/\s*\(modèle[^)]*\)\s*$/i, "").trim();
}

async function empreinte(texte: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Textes en vigueur (null si aucun n'est configuré : pas d'acceptation demandée). */
export async function chargerCgv(sb: SupabaseClient): Promise<Cgv | null> {
  if (cache && Date.now() - cache.quand < DUREE_CACHE_MS) return cache.valeur;
  const { data: cfg } = await sb.from("studio_config").select("valeur").eq("cle", "cgv_livrables").maybeSingle();
  const ids = String(cfg?.valeur ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  let valeur: Cgv | null = null;
  if (ids.length) {
    const { data } = await sb.from("studio_livrables").select("id, titre, contenu").in("id", ids);
    const docs = ids.map((id) => (data ?? []).find((d) => d.id === id)).filter(Boolean)
      .map((d) => ({ titre: titreCgv(String(d!.titre)), contenu: String(d!.contenu ?? "") }));
    if (docs.length) valeur = { version: await empreinte(docs.map((d) => d.contenu).join("\n\u0000\n")), documents: docs };
  }
  cache = { quand: Date.now(), valeur };
  return valeur;
}

export async function accepter(sb: SupabaseClient, userId: string, version: string, preuve: Record<string, unknown>) {
  await sb.from("studio_users").update({
    cgv_version: version, cgv_acceptees_le: new Date().toISOString(), cgv_preuve: preuve,
  }).eq("id", userId);
}

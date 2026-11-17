// Dossiers du Studio : le client et ses agents rangent ressources (notes, fichiers,
// compétences), livrables et médias dans une arborescence propre à l'espace.
// Un dossier se désigne par son chemin « Clients/Dupont » ; ranger crée les dossiers manquants.
// Supprimer un dossier ne supprime aucun contenu : tout remonte au dossier parent.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type Dossier = { id: string; parent_id: string | null; nom: string };
export type Element = "ressource" | "livrable" | "media";
export const TABLES: Record<Element, string> = { ressource: "studio_documents", livrable: "studio_livrables", media: "studio_medias" };
const PROFONDEUR_MAX = 5;

/** « / Clients // Dupont / » → ["Clients", "Dupont"] ; null si un segment est trop long ou s'il y en a trop. */
export function segments(chemin: string): string[] | null {
  const s = String(chemin ?? "").split("/").map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (s.length > PROFONDEUR_MAX || s.some((x) => x.length > 80)) return null;
  return s;
}

/** Chemin complet d'un dossier (« Clients/Dupont »). */
export function cheminDe(dossiers: Dossier[], id: string | null): string {
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const noms: string[] = [];
  for (let d = id ? parId.get(id) : undefined, n = 0; d && n < 20; d = d.parent_id ? parId.get(d.parent_id) : undefined, n++) noms.unshift(d.nom);
  return noms.join("/");
}

/** Dossier existant au chemin donné (casse ignorée), sinon null. */
export function trouver(dossiers: Dossier[], noms: string[]): Dossier | null {
  let parent: string | null = null, courant: Dossier | null = null;
  for (const nom of noms) {
    courant = dossiers.find((d) => d.parent_id === parent && d.nom.toLowerCase() === nom.toLowerCase()) ?? null;
    if (!courant) return null;
    parent = courant.id;
  }
  return courant;
}

/** Id du dossier et de tous ses descendants. */
export function descendants(dossiers: Dossier[], id: string): string[] {
  const res = [id];
  for (let i = 0; i < res.length; i++) for (const d of dossiers) if (d.parent_id === res[i]) res.push(d.id);
  return res;
}

/** Arborescence lisible pour un agent : un chemin par ligne, avec le nombre d'éléments. */
export function arbreTexte(dossiers: Dossier[], comptes: Map<string, number> = new Map()): string[] {
  return dossiers.map((d) => ({ chemin: cheminDe(dossiers, d.id), n: comptes.get(d.id) ?? 0 }))
    .sort((a, b) => a.chemin.localeCompare(b.chemin, "fr"))
    .map((x) => `${x.chemin}${x.n ? ` (${x.n})` : ""}`);
}

export async function listerDossiers(sb: SupabaseClient, wsId: string): Promise<Dossier[]> {
  const { data } = await sb.from("studio_dossiers").select("id, parent_id, nom").eq("workspace_id", wsId).order("nom");
  return (data ?? []) as Dossier[];
}

/** Dossier au chemin donné, créé (avec ses parents) s'il n'existe pas. Chemin vide = racine (null). */
export async function assurerChemin(sb: SupabaseClient, wsId: string, chemin: string, par: string): Promise<{ id: string | null } | { erreur: string }> {
  const noms = segments(chemin);
  if (!noms) return { erreur: `Chemin de dossier invalide (${PROFONDEUR_MAX} niveaux et 80 caractères par nom au plus).` };
  const dossiers = await listerDossiers(sb, wsId);
  let parent: string | null = null;
  for (const nom of noms) {
    const existe = dossiers.find((d) => d.parent_id === parent && d.nom.toLowerCase() === nom.toLowerCase());
    if (existe) { parent = existe.id; continue; }
    const ins = await sb.from("studio_dossiers").insert({ workspace_id: wsId, parent_id: parent, nom, cree_par: par }).select("id, parent_id, nom").single();
    if (ins.error) return { erreur: ins.error.message };
    const cree = ins.data as Dossier;
    dossiers.push(cree);
    parent = cree.id;
  }
  return { id: parent };
}

/** Vérifie qu'un dossier appartient à l'espace (null = racine, toujours valide). */
export async function dossierDeLEspace(sb: SupabaseClient, wsId: string, id: unknown): Promise<string | null | false> {
  if (id === null || id === undefined || id === "") return null;
  const { data } = await sb.from("studio_dossiers").select("id").eq("id", String(id)).eq("workspace_id", wsId).maybeSingle();
  return data ? data.id : false;
}

/** Range un élément de l'espace dans un dossier (null = racine). */
export async function ranger(sb: SupabaseClient, wsId: string, element: Element, id: string, dossierId: string | null): Promise<{ ok: true } | { erreur: string }> {
  const { data, error } = await sb.from(TABLES[element]).update({ dossier_id: dossierId }).eq("id", id).eq("workspace_id", wsId).select("id");
  if (error) return { erreur: error.message };
  return data?.length ? { ok: true } : { erreur: "Élément introuvable dans cet espace." };
}

export async function renommer(sb: SupabaseClient, wsId: string, id: string, nom: string): Promise<{ ok: true } | { erreur: string }> {
  const n = segments(nom);
  if (!n || n.length !== 1) return { erreur: "Nom de dossier invalide (sans « / », 80 caractères au plus)." };
  const { data, error } = await sb.from("studio_dossiers").update({ nom: n[0] }).eq("id", id).eq("workspace_id", wsId).select("id");
  if (error) return { erreur: error.code === "23505" ? "Un dossier porte déjà ce nom à cet endroit." : error.message };
  return data?.length ? { ok: true } : { erreur: "Dossier introuvable." };
}

/** Déplace un dossier sous un autre (null = racine), sans boucle. */
export async function deplacer(sb: SupabaseClient, wsId: string, id: string, parentId: string | null): Promise<{ ok: true } | { erreur: string }> {
  const dossiers = await listerDossiers(sb, wsId);
  if (!dossiers.some((d) => d.id === id)) return { erreur: "Dossier introuvable." };
  if (parentId && (!dossiers.some((d) => d.id === parentId) || descendants(dossiers, id).includes(parentId))) {
    return { erreur: "Impossible de placer un dossier dans lui-même ou dans un de ses sous-dossiers." };
  }
  const { error } = await sb.from("studio_dossiers").update({ parent_id: parentId }).eq("id", id).eq("workspace_id", wsId);
  if (error) return { erreur: error.code === "23505" ? "Un dossier porte déjà ce nom à cet endroit." : error.message };
  return { ok: true };
}

/** Supprime un dossier : contenu et sous-dossiers remontent au parent. */
export async function supprimer(sb: SupabaseClient, wsId: string, id: string): Promise<{ ok: true } | { erreur: string }> {
  const { data: d } = await sb.from("studio_dossiers").select("id, parent_id").eq("id", id).eq("workspace_id", wsId).maybeSingle();
  if (!d) return { erreur: "Dossier introuvable." };
  for (const t of Object.values(TABLES)) {
    await sb.from(t).update({ dossier_id: d.parent_id }).eq("workspace_id", wsId).eq("dossier_id", id);
  }
  const { data: enfants } = await sb.from("studio_dossiers").select("id, nom").eq("workspace_id", wsId).eq("parent_id", id);
  for (const e of enfants ?? []) {
    const { error } = await sb.from("studio_dossiers").update({ parent_id: d.parent_id }).eq("id", e.id);
    // Nom déjà pris au niveau du parent : on suffixe plutôt que de perdre le dossier.
    if (error?.code === "23505") await sb.from("studio_dossiers").update({ parent_id: d.parent_id, nom: `${e.nom} (2)`.slice(0, 80) }).eq("id", e.id);
  }
  await sb.from("studio_dossiers").delete().eq("id", id).eq("workspace_id", wsId);
  return { ok: true };
}

/** Nombre d'éléments rangés par dossier (toutes rubriques confondues). */
export async function comptes(sb: SupabaseClient, wsId: string): Promise<Map<string, number>> {
  const res = new Map<string, number>();
  const lignes = await Promise.all(Object.values(TABLES).map((t) =>
    sb.from(t).select("dossier_id").eq("workspace_id", wsId).not("dossier_id", "is", null).limit(2000)));
  for (const { data } of lignes) for (const l of data ?? []) res.set(l.dossier_id, (res.get(l.dossier_id) ?? 0) + 1);
  return res;
}

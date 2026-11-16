// Journal d'audit par espace, chaîné par SHA-256 (repris du paquet : audit.log
// append-only à chaîne de hachage). Chaque ligne porte le hachage de la
// précédente : une ligne supprimée, insérée ou modifiée rompt la chaîne.
// Partie pure (calcul, vérification) testée par vitest ; écriture en base dans
// `journaliser`, appelée par l'Edge Function `studio`.

export type LigneJournal = {
  id: number; workspace_id: string; acteur: string; agent_id: string | null; action: string;
  detail: Record<string, unknown>; hash_precedent: string | null; hash: string; created_at: string;
};

async function sha256Hex(texte: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Sérialisation stable (clés triées) : le même contenu donne toujours le même hachage. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export function hacherLigne(l: Omit<LigneJournal, "id" | "hash">): Promise<string> {
  return sha256Hex([l.hash_precedent ?? "", l.workspace_id, l.acteur, l.agent_id ?? "", l.action, stable(l.detail), l.created_at].join("|"));
}

/** Vérifie la chaîne d'un espace (lignes triées par id croissant). */
export async function verifierChaine(lignes: LigneJournal[]): Promise<{ ok: boolean; lignes: number; rupture?: number; motif?: string }> {
  let precedent: string | null = null;
  for (const l of lignes) {
    if ((l.hash_precedent ?? null) !== precedent) return { ok: false, lignes: lignes.length, rupture: l.id, motif: "maillon manquant ou inséré" };
    if (await hacherLigne(l) !== l.hash) return { ok: false, lignes: lignes.length, rupture: l.id, motif: "ligne modifiée" };
    precedent = l.hash;
  }
  return { ok: true, lignes: lignes.length };
}

// Écriture : type minimal du client Supabase (évite d'importer le SDK ici).
type Db = {
  from: (t: string) => {
    select: (c: string) => { eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: { hash: string }[] | null }> } } };
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  };
};

/**
 * Ajoute une ligne au journal de l'espace. Ne lève jamais : un échec de
 * journalisation ne bloque pas la mission, il est tracé dans les logs.
 * (Deux écritures simultanées peuvent se disputer le même maillon : la
 * vérification le signalera ; le volume d'un espace rend ce cas rare.)
 */
export async function journaliser(sb: unknown, e: {
  wsId: string; acteur: string; action: string; agentId?: string | null; detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const db = sb as Db;
    const { data } = await db.from("studio_journal").select("hash").eq("workspace_id", e.wsId).order("id", { ascending: false }).limit(1);
    const ligne = {
      workspace_id: e.wsId, acteur: e.acteur.slice(0, 200), agent_id: e.agentId ?? null, action: e.action,
      detail: e.detail ?? {}, hash_precedent: data?.[0]?.hash ?? null, created_at: new Date().toISOString(),
    };
    const hash = await hacherLigne(ligne);
    const { error } = await db.from("studio_journal").insert({ ...ligne, hash });
    if (error) console.error("[studio] journal:", error.message);
  } catch (err) {
    console.error("[studio] journal:", err instanceof Error ? err.message : String(err));
  }
}

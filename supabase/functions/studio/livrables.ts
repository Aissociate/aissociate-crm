// Décision sur un livrable : a_valider → valide | refuse → publie.
// Seul chemin qui exécute une action externe (e-mail, publication, agenda, dépôt) :
// rien ne part sans une validation enregistrée du propriétaire de l'espace.
// Module sans dépendance au SDK ni à Deno (testé par vitest) : l'exécution et le
// journal sont injectés par gouvernance.ts.

export type StatutLivrable = "a_valider" | "valide" | "refuse" | "publie";

export const TRANSITIONS: Record<string, string[]> = {
  a_valider: ["valide", "refuse"], refuse: ["a_valider"], valide: ["publie", "a_valider"], publie: [],
};

export function transitionPermise(de: string, vers: string): boolean {
  return TRANSITIONS[de]?.includes(vers) === true;
}

type Erreur = { message: string } | null;
type Filtre<T> = PromiseLike<{ data: T[] | null; error: Erreur }> & {
  eq: (colonne: string, valeur: unknown) => Filtre<T>;
  select: (colonnes: string) => Filtre<T>;
  maybeSingle: () => PromiseLike<{ data: T | null; error: Erreur }>;
};
/** Type minimal du client Supabase (évite d'importer le SDK ici). */
export type Db = {
  from: (table: string) => {
    select: (colonnes: string) => Filtre<Record<string, unknown>>;
    update: (valeurs: Record<string, unknown>) => Filtre<Record<string, unknown>>;
  };
};

export type ResultatAction = { ok: true; lien: string | null; id: string } | { ok: false; erreur: string };
export type Dependances = {
  /** Exécute l'action portée par le livrable (outils.ts › executerAction). */
  executer: (action: unknown, livrableId: string) => Promise<ResultatAction>;
  journaliser: (e: { acteur: string; agentId?: string | null; action: string; detail?: Record<string, unknown> }) => Promise<void>;
};

export type Decision =
  | { erreur: string; statut: number }
  | { ok: true; execute?: boolean; lien?: string | null; erreur_action?: string };

export async function deciderLivrable(
  sb: unknown, wsId: string, decideur: { acteur: string; proprietaire: boolean },
  body: Record<string, unknown>, deps: Dependances,
): Promise<Decision> {
  // Vérifié ici aussi, pas seulement par l'appelant : aucune entrée (chat, e-mail, tâche) n'y échappe.
  if (!decideur.proprietaire) return { erreur: "Seul le propriétaire de l'espace valide les livrables.", statut: 403 };
  const db = sb as Db;
  const statut = String(body.statut ?? "");
  const { data: l } = await db.from("studio_livrables").select("id, statut, titre, agent_id, action")
    .eq("id", String(body.id ?? "")).eq("workspace_id", wsId).maybeSingle();
  if (!l) return { erreur: "Livrable introuvable", statut: 404 };
  const avant = String(l.statut), id = String(l.id), agentId = (l.agent_id as string | null) ?? null;
  if (!transitionPermise(avant, statut)) return { erreur: `Passage « ${avant} » → « ${statut} » impossible.`, statut: 400 };
  const commentaire = String(body.commentaire ?? "").trim().slice(0, 1000) || null;

  // Écriture conditionnée au statut lu : deux décisions simultanées (double-clic, ou clic
  // + « VALIDÉ » par e-mail) ne passent pas toutes les deux, donc l'action ne part qu'une fois.
  const { data: pris, error } = await db.from("studio_livrables").update({
    statut, commentaire, decide_par: decideur.acteur, decide_le: new Date().toISOString(),
  }).eq("id", id).eq("workspace_id", wsId).eq("statut", avant).select("id");
  if (error) return { erreur: error.message, statut: 400 };
  if (!pris?.length) return { erreur: "Ce livrable vient d'être traité : rechargez la page.", statut: 409 };
  await deps.journaliser({ acteur: decideur.acteur, agentId, action: `livrable_${statut}`, detail: { livrable: id, titre: l.titre, commentaire } });

  // Livrable porteur d'une action (ex. créer un document dans le Drive) : le « VALIDÉ »
  // déclenche l'exécution. Réussite → publié avec le lien ; échec → reste validé, erreur notée.
  if (statut === "valide" && l.action) {
    const r = await deps.executer(l.action, id);
    if (r.ok) {
      await db.from("studio_livrables").update({ statut: "publie", resultat: { id: r.id, lien: r.lien } }).eq("id", id).eq("statut", "valide");
      await deps.journaliser({ acteur: "systeme", agentId, action: "action_executee", detail: { livrable: id, titre: l.titre, lien: r.lien } });
      return { ok: true, execute: true, lien: r.lien };
    }
    await db.from("studio_livrables").update({ resultat: { erreur: r.erreur } }).eq("id", id);
    await deps.journaliser({ acteur: "systeme", agentId, action: "action_echec", detail: { livrable: id, titre: l.titre, erreur: r.erreur } });
    return { ok: true, execute: false, erreur_action: r.erreur };
  }
  return { ok: true };
}

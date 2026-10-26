// Pièces jointes des e-mails proposés par l'assistant IA.
//
// Une pièce est désignée par une clé « source:id » — mêmes sources que la
// modale de composition (ComposeMessageModal) :
//   • piece:<id>    → `dossier_pieces` (bucket privé « pieces ») ;
//   • coffre:<id>   → `contact_documents` (bucket privé « coffre ») ;
//   • document:<id> → `documents`, l'espace documentaire (bucket public).
// Toutes les lectures passent par le client RLS : l'IA (et l'utilisateur qui
// retouche la proposition) ne peut joindre qu'un fichier qu'il voit déjà.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type PieceJointe = { cle: string; nom: string; origine: string };
type Resolue = PieceJointe & { bucket: string; valeur: string };

const MAX_PJ = 10;

// Le libellé ne porte pas l'extension : on la reprend du fichier stocké pour
// que la pièce s'ouvre correctement chez le destinataire.
function extensionDe(valeur: string): string {
  const nom = valeur.split("?")[0].split("/").filter(Boolean).pop() ?? "";
  return nom.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? "";
}
const nomFichier = (libelle: string, valeur: string) => {
  const ext = extensionDe(valeur);
  return ext && !libelle.toLowerCase().endsWith(ext.toLowerCase()) ? `${libelle}${ext}` : libelle;
};

/** Pièces joignables pour un contact et/ou un dossier (dossiers du contact inclus). */
export async function listerPiecesJointes(
  db: SupabaseClient, a: { contact_id?: string; dossier_id?: string; recherche?: string },
): Promise<PieceJointe[]> {
  const dossierIds = new Set<string>();
  if (a.dossier_id) dossierIds.add(a.dossier_id);
  if (a.contact_id) {
    const { data } = await db.from("dossiers").select("id").eq("contact_id", a.contact_id);
    for (const d of data ?? []) dossierIds.add(d.id as string);
  }
  const [pieces, coffre, docs] = await Promise.all([
    dossierIds.size
      ? db.from("dossier_pieces").select("id, libelle, fichier_url, dossiers(reference)")
        .in("dossier_id", [...dossierIds]).not("fichier_url", "is", null)
      : Promise.resolve({ data: [] }),
    a.contact_id
      ? db.from("contact_documents").select("id, titre, fichier_url").eq("contact_id", a.contact_id).not("fichier_url", "is", null)
      : Promise.resolve({ data: [] }),
    db.from("documents").select("id, titre, categorie, fichier_url").not("fichier_url", "is", null)
      .order("created_at", { ascending: false }).limit(60),
  ]);
  const liste: PieceJointe[] = [
    ...((pieces.data ?? []) as Record<string, unknown>[]).map((p) => ({
      cle: `piece:${p.id}`, nom: nomFichier(String(p.libelle), String(p.fichier_url)),
      origine: `Dossier ${(p.dossiers as { reference?: string } | null)?.reference ?? ""}`.trim(),
    })),
    ...((coffre.data ?? []) as Record<string, unknown>[]).map((d) => ({
      cle: `coffre:${d.id}`, nom: nomFichier(String(d.titre), String(d.fichier_url)), origine: "Coffre-fort du contact",
    })),
    ...((docs.data ?? []) as Record<string, unknown>[]).map((d) => ({
      cle: `document:${d.id}`, nom: nomFichier(String(d.titre), String(d.fichier_url)),
      origine: `Espace documentaire${d.categorie ? ` · ${d.categorie}` : ""}`,
    })),
  ];
  const s = (a.recherche ?? "").trim().toLowerCase();
  return s ? liste.filter((p) => p.nom.toLowerCase().includes(s) || p.origine.toLowerCase().includes(s)) : liste;
}

/** Relit chaque clé (RLS) ; les clés inconnues ou hors périmètre sont écartées. */
async function resoudre(db: SupabaseClient, cles: string[]): Promise<{ ok: Resolue[]; rejetees: string[] }> {
  const ids = { piece: [] as string[], coffre: [] as string[], document: [] as string[] };
  const uniques = [...new Set(cles.map(String))].slice(0, MAX_PJ);
  for (const c of uniques) {
    const [src, id] = c.split(":");
    if (id && src in ids) ids[src as keyof typeof ids].push(id);
  }
  const [p, c, d] = await Promise.all([
    ids.piece.length ? db.from("dossier_pieces").select("id, libelle, fichier_url").in("id", ids.piece) : Promise.resolve({ data: [] }),
    ids.coffre.length ? db.from("contact_documents").select("id, titre, fichier_url").in("id", ids.coffre) : Promise.resolve({ data: [] }),
    ids.document.length ? db.from("documents").select("id, titre, fichier_url").in("id", ids.document) : Promise.resolve({ data: [] }),
  ]);
  const trouvees = new Map<string, Resolue>();
  for (const r of (p.data ?? []) as Record<string, unknown>[]) if (r.fichier_url) trouvees.set(`piece:${r.id}`, {
    cle: `piece:${r.id}`, nom: nomFichier(String(r.libelle), String(r.fichier_url)), origine: "Dossier", bucket: "pieces", valeur: String(r.fichier_url),
  });
  for (const r of (c.data ?? []) as Record<string, unknown>[]) if (r.fichier_url) trouvees.set(`coffre:${r.id}`, {
    cle: `coffre:${r.id}`, nom: nomFichier(String(r.titre), String(r.fichier_url)), origine: "Coffre-fort", bucket: "coffre", valeur: String(r.fichier_url),
  });
  for (const r of (d.data ?? []) as Record<string, unknown>[]) if (r.fichier_url) trouvees.set(`document:${r.id}`, {
    cle: `document:${r.id}`, nom: nomFichier(String(r.titre), String(r.fichier_url)), origine: "Espace documentaire", bucket: "documents", valeur: String(r.fichier_url),
  });
  return {
    ok: uniques.map((k) => trouvees.get(k)).filter((x): x is Resolue => !!x),
    rejetees: uniques.filter((k) => !trouvees.has(k)),
  };
}

/** Clés → pièces affichables (nom, origine), rangées dans les args de la proposition. */
export async function decrirePiecesJointes(db: SupabaseClient, cles: unknown): Promise<{ pieces: PieceJointe[]; rejetees: string[] }> {
  if (!Array.isArray(cles) || !cles.length) return { pieces: [], rejetees: [] };
  const { ok, rejetees } = await resoudre(db, cles.map((x) => typeof x === "string" ? x : String((x as { cle?: string })?.cle ?? "")));
  return { pieces: ok.map(({ cle, nom, origine }) => ({ cle, nom, origine })), rejetees };
}

/** Pièces → { filename, url } pour send-email (URL signée 24 h pour les buckets privés). */
export async function piecesPourEnvoi(db: SupabaseClient, pieces: unknown): Promise<{ filename: string; url: string }[] | { erreur: string }> {
  if (!Array.isArray(pieces) || !pieces.length) return [];
  const cles = pieces.map((x) => typeof x === "string" ? x : String((x as { cle?: string })?.cle ?? ""));
  const { ok, rejetees } = await resoudre(db, cles);
  if (rejetees.length) return { erreur: `Pièce(s) jointe(s) introuvable(s) ou sans fichier : ${rejetees.join(", ")}. Retirez-les puis validez à nouveau.` };
  const out: { filename: string; url: string }[] = [];
  for (const r of ok) {
    if (/^https?:\/\//i.test(r.valeur)) { out.push({ filename: r.nom, url: r.valeur }); continue; }
    const { data, error } = await db.storage.from(r.bucket).createSignedUrl(r.valeur, 86400);
    if (error || !data?.signedUrl) return { erreur: `Fichier « ${r.nom} » inaccessible : ${error?.message ?? "URL signée impossible"}` };
    out.push({ filename: r.nom, url: data.signedUrl });
  }
  return out;
}

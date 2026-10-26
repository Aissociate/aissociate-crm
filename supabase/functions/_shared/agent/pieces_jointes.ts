// Pièces jointes des e-mails proposés par l'assistant IA.
//
// Une pièce est désignée par une clé « source:id » :
//   • piece:<id>    → `dossier_pieces` (bucket privé « pieces ») ;
//   • coffre:<id>   → `contact_documents` (bucket privé « coffre ») ;
//   • devis:<id>    → PDF d'un devis (bucket « devis ») ;
//   • facture:<id>  → PDF d'une facture (bucket « factures ») ;
//   • plan:<id>     → `plan_pdfs`, plans et documents AGEFICE (bucket « plans ») ;
//   • document:<id> → `documents`, l'espace documentaire (bucket public).
// Toutes les lectures passent par le client RLS : l'IA (et l'utilisateur qui
// retouche la proposition) ne peut joindre qu'un fichier qu'il voit déjà.
// Un devis ou un document créé par une action validée dans la conversation est
// donc joignable dès que son PDF existe.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type PieceJointe = { cle: string; nom: string; origine: string };
type Resolue = PieceJointe & { bucket: string; valeur: string };
type Ligne = Record<string, unknown>;

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

type Source = { table: string; select: string; bucket: string; libelle: (r: Ligne) => string; origine: (r: Ligne) => string };
const SOURCES: Record<string, Source> = {
  piece: {
    table: "dossier_pieces", select: "id, libelle, fichier_url, dossiers(reference)", bucket: "pieces",
    libelle: (r) => String(r.libelle),
    origine: (r) => `Dossier ${(r.dossiers as { reference?: string } | null)?.reference ?? ""}`.trim(),
  },
  coffre: {
    table: "contact_documents", select: "id, titre, fichier_url", bucket: "coffre",
    libelle: (r) => String(r.titre), origine: () => "Coffre-fort du contact",
  },
  devis: {
    table: "devis", select: "id, numero, objet, fichier_url", bucket: "devis",
    libelle: (r) => `Devis ${r.numero}`, origine: (r) => `Devis${r.objet ? ` · ${r.objet}` : ""}`,
  },
  facture: {
    table: "factures", select: "id, numero, objet, fichier_url", bucket: "factures",
    libelle: (r) => `Facture ${r.numero}`, origine: (r) => `Facture${r.objet ? ` · ${r.objet}` : ""}`,
  },
  plan: {
    table: "plan_pdfs", select: "id, titre, fichier_url", bucket: "plans",
    libelle: (r) => String(r.titre), origine: () => "Plan / document AGEFICE",
  },
  document: {
    table: "documents", select: "id, titre, categorie, fichier_url", bucket: "documents",
    libelle: (r) => String(r.titre), origine: (r) => `Espace documentaire${r.categorie ? ` · ${r.categorie}` : ""}`,
  },
};

const enPiece = (src: string, r: Ligne): Resolue => {
  const s = SOURCES[src];
  return {
    cle: `${src}:${r.id}`, nom: nomFichier(s.libelle(r), String(r.fichier_url)), origine: s.origine(r),
    bucket: s.bucket, valeur: String(r.fichier_url),
  };
};
const vide = Promise.resolve({ data: [] as Ligne[] });

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
  // Devis, factures et plans : rattachés au contact OU à l'un de ses dossiers.
  const lien = [
    ...(a.contact_id ? [`contact_id.eq.${a.contact_id}`] : []),
    ...(dossierIds.size ? [`dossier_id.in.(${[...dossierIds].join(",")})`] : []),
  ].join(",");
  const lies = (src: string) => {
    const s = SOURCES[src];
    return lien
      ? db.from(s.table).select(s.select).or(lien).not("fichier_url", "is", null).order("created_at", { ascending: false }).limit(30)
      : vide;
  };
  const plans = lien
    ? await db.from("plans_formation").select("id").or(lien).limit(50)
    : { data: [] as Ligne[] };
  const planIds = (plans.data ?? []).map((p) => String((p as Ligne).id));

  const [pieces, coffre, devis, factures, planPdfs, docs] = await Promise.all([
    dossierIds.size
      ? db.from("dossier_pieces").select(SOURCES.piece.select).in("dossier_id", [...dossierIds]).not("fichier_url", "is", null)
      : vide,
    a.contact_id
      ? db.from("contact_documents").select(SOURCES.coffre.select).eq("contact_id", a.contact_id).not("fichier_url", "is", null)
      : vide,
    lies("devis"),
    lies("facture"),
    planIds.length
      ? db.from("plan_pdfs").select(SOURCES.plan.select).in("plan_id", planIds).not("fichier_url", "is", null).order("created_at", { ascending: false })
      : vide,
    db.from("documents").select(SOURCES.document.select).not("fichier_url", "is", null)
      .order("created_at", { ascending: false }).limit(60),
  ]);
  const liste: PieceJointe[] = ([
    ["devis", devis], ["facture", factures], ["plan", planPdfs], ["piece", pieces], ["coffre", coffre], ["document", docs],
  ] as [string, { data: unknown }][]).flatMap(([src, r]) =>
    ((r.data ?? []) as Ligne[]).map((x) => { const { cle, nom, origine } = enPiece(src, x); return { cle, nom, origine }; }));
  const s = (a.recherche ?? "").trim().toLowerCase();
  return s ? liste.filter((p) => p.nom.toLowerCase().includes(s) || p.origine.toLowerCase().includes(s)) : liste;
}

/** Relit chaque clé (RLS) ; les clés inconnues, hors périmètre ou sans fichier sont écartées. */
async function resoudre(db: SupabaseClient, cles: string[]): Promise<{ ok: Resolue[]; rejetees: string[] }> {
  const uniques = [...new Set(cles.map(String))].slice(0, MAX_PJ);
  const parSource = new Map<string, string[]>();
  for (const c of uniques) {
    const [src, id] = c.split(":");
    if (id && SOURCES[src]) parSource.set(src, [...(parSource.get(src) ?? []), id]);
  }
  const trouvees = new Map<string, Resolue>();
  await Promise.all([...parSource].map(async ([src, ids]) => {
    const s = SOURCES[src];
    const { data } = await db.from(s.table).select(s.select).in("id", ids);
    for (const r of (data ?? []) as Ligne[]) if (r.fichier_url) trouvees.set(`${src}:${r.id}`, enPiece(src, r));
  }));
  return {
    ok: uniques.map((k) => trouvees.get(k)).filter((x): x is Resolue => !!x),
    rejetees: uniques.filter((k) => !trouvees.has(k)),
  };
}

const clesDe = (v: unknown[]) => v.map((x) => typeof x === "string" ? x : String((x as { cle?: string })?.cle ?? ""));

/** Clés → pièces affichables (nom, origine), rangées dans les args de la proposition. */
export async function decrirePiecesJointes(db: SupabaseClient, cles: unknown): Promise<{ pieces: PieceJointe[]; rejetees: string[] }> {
  if (!Array.isArray(cles) || !cles.length) return { pieces: [], rejetees: [] };
  const { ok, rejetees } = await resoudre(db, clesDe(cles));
  return { pieces: ok.map(({ cle, nom, origine }) => ({ cle, nom, origine })), rejetees };
}

/** Pièces → { filename, url } pour send-email (URL signée 24 h pour les buckets privés). */
export async function piecesPourEnvoi(db: SupabaseClient, pieces: unknown): Promise<{ filename: string; url: string }[] | { erreur: string }> {
  if (!Array.isArray(pieces) || !pieces.length) return [];
  const { ok, rejetees } = await resoudre(db, clesDe(pieces));
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

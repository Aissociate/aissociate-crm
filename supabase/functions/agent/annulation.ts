// Annulation d'une action de l'IA déjà exécutée.
//
// Au moment de l'exécution, on mémorise de quoi revenir en arrière :
//   • mise à jour → les valeurs d'AVANT, relues juste avant d'écrire ;
//   • création    → la ligne créée, à supprimer.
// Ce plan est rangé dans `ai_actions.resultat.annulation` ; le mode `undo` de
// l'agent le rejoue avec le JWT de l'utilisateur (la RLS s'applique).
//
// Garde-fou : la plupart des clés étrangères sont en ON DELETE SET NULL.
// Supprimer un contact créé par l'IA détacherait donc en silence le devis ou
// le dossier ouverts depuis. Une suppression est refusée dès que la ligne est
// référencée ailleurs : l'utilisateur fait le ménage à la main, en connaissance
// de cause.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type EtapeAnnulation =
  | { op: "delete"; table: string; id: string }
  | { op: "update"; table: string; id: string; valeurs: Record<string, unknown> };

export type Annulation =
  | { possible: true; etapes: EtapeAnnulation[] }
  | { possible: false; raison: string };

type ResultatExec = { entite: string; entite_id: string | null; resultat?: unknown };

const NON_ANNULABLES: Record<string, string> = {
  proposer_envoi_email: "Un e-mail envoyé ne peut pas être rappelé.",
  proposer_envoi_emargement: "Les e-mails d'émargement sont partis : ils ne peuvent pas être rappelés.",
  proposer_envoi_evaluation: "L'évaluation a été créée ou envoyée : gérez-la depuis la page Évaluations.",
  proposer_generation_document: "Le document généré reste disponible ; supprimez-le depuis sa fiche si besoin.",
};

/** Champs des contacts modifiables par `proposer_maj_contact` (miroir d'outils_metier.ts). */
const CHAMPS_CONTACT = ["prenom", "nom", "email", "telephone", "ville", "fonction", "besoin_resume", "formation_envisagee", "financement_envisage", "interet", "entreprise_id"];

/** Mises à jour : quelle ligne, quels champs relire avant d'écrire. */
const MISES_A_JOUR: Record<string, { table: string; idArg: string; champs: (a: Record<string, unknown>) => string[] }> = {
  proposer_maj_statut_contact: { table: "contacts", idArg: "contact_id", champs: () => ["statut_prospect"] },
  proposer_note_contact: { table: "contacts", idArg: "contact_id", champs: () => ["notes"] },
  proposer_deplacement_opportunite: { table: "opportunites", idArg: "opportunite_id", champs: () => ["stage", "colonne_manuelle", "position"] },
  proposer_maj_statut_dossier: { table: "dossiers", idArg: "dossier_id", champs: () => ["statut"] },
  proposer_maj_contact: { table: "contacts", idArg: "contact_id", champs: (a) => CHAMPS_CONTACT.filter((k) => a[k] != null && a[k] !== "") },
  proposer_action_faite: { table: "contact_actions", idArg: "action_id", champs: () => ["faite", "description"] },
  proposer_maj_statut_devis: { table: "devis", idArg: "devis_id", champs: () => ["statut"] },
  proposer_maj_statut_facture: { table: "factures", idArg: "facture_id", champs: () => ["statut", "date_reglement", "mode_reglement"] },
  // Créations qui modifient aussi une ligne existante.
  proposer_creation_entreprise: { table: "contacts", idArg: "contact_id", champs: () => ["entreprise_id"] },
  proposer_conversion_lead: { table: "contact_requests", idArg: "lead_id", champs: () => ["status", "contact_id"] },
};

/** Avant exécution : valeurs actuelles des champs que l'action va écraser. */
export async function instantane(db: SupabaseClient, outil: string, a: Record<string, unknown>): Promise<EtapeAnnulation[]> {
  const m = MISES_A_JOUR[outil];
  if (!m || !a[m.idArg]) return [];
  const champs = m.champs(a);
  if (!champs.length) return [];
  const id = String(a[m.idArg]);
  const { data } = await db.from(m.table).select(champs.join(", ")).eq("id", id).maybeSingle();
  return data ? [{ op: "update", table: m.table, id, valeurs: data as unknown as Record<string, unknown> }] : [];
}

/** Après exécution réussie : le plan complet pour revenir en arrière. */
export function planAnnulation(outil: string, a: Record<string, unknown>, res: ResultatExec, avant: EtapeAnnulation[]): Annulation {
  if (NON_ANNULABLES[outil]) return { possible: false, raison: NON_ANNULABLES[outil] };
  const r = (res.resultat ?? {}) as Record<string, unknown>;
  const id = res.entite_id;
  const supprimer = (table: string, ligne: unknown): EtapeAnnulation[] =>
    typeof ligne === "string" && ligne ? [{ op: "delete", table, id: ligne }] : [];

  let etapes: EtapeAnnulation[];
  switch (outil) {
    case "proposer_creation_action": etapes = supprimer("contact_actions", id); break;
    case "proposer_creation_contact": etapes = supprimer("contacts", id); break;
    case "proposer_creation_opportunite": etapes = supprimer("opportunites", id); break;
    case "proposer_creation_facture": etapes = supprimer("factures", id); break;
    case "proposer_creation_plan": etapes = supprimer("plans_formation", id); break;
    case "proposer_creation_session": etapes = supprimer("sessions_formation", id); break;
    // Le contact retrouve son entreprise d'avant, PUIS l'entreprise disparaît.
    case "proposer_creation_entreprise": etapes = [...avant, ...supprimer("entreprises", id)]; break;
    // Le devis d'abord (lignes en cascade), puis le dossier s'il a été ouvert pour lui.
    case "proposer_creation_devis":
      etapes = [...supprimer("devis", id), ...(r.dossier_cree ? supprimer("dossiers", r.dossier_id) : [])];
      break;
    case "proposer_creation_dossier": etapes = r.existait_deja ? [] : supprimer("dossiers", id); break;
    case "proposer_inscription_session": etapes = r.deja_inscrit ? [] : supprimer("session_participants", id); break;
    // La demande redevient « nouvelle », puis le contact créé pour elle disparaît.
    case "proposer_conversion_lead": etapes = [...avant, ...(r.contact_cree ? supprimer("contacts", id) : [])]; break;
    default: etapes = avant;
  }
  if (!etapes.length) return { possible: false, raison: "Rien à défaire : l'action n'a rien créé ni modifié." };
  return { possible: true, etapes };
}

/** Lignes qui pointent encore vers celle qu'on s'apprête à supprimer. */
const REFERENCES: Record<string, [string, string][]> = {
  contacts: [["contact_actions", "contact_id"], ["emails", "contact_id"], ["devis", "contact_id"], ["dossiers", "contact_id"], ["opportunites", "contact_id"], ["factures", "contact_id"], ["session_participants", "contact_id"], ["plans_formation", "contact_id"]],
  dossiers: [["devis", "dossier_id"], ["factures", "dossier_id"], ["plans_formation", "dossier_id"], ["sessions_formation", "dossier_id"]],
  devis: [["factures", "devis_id"], ["signatures", "devis_id"]],
  factures: [["tresorerie_encaissements", "facture_id"]],
  entreprises: [["contacts", "entreprise_id"], ["devis", "entreprise_id"], ["dossiers", "entreprise_id"], ["opportunites", "entreprise_id"]],
  opportunites: [["tresorerie_encaissements", "opportunite_id"]],
  plans_formation: [["dossiers", "plan_id"], ["plan_pdfs", "plan_id"]],
  sessions_formation: [["session_participants", "session_id"]],
};

const LIBELLES: Record<string, string> = {
  devis: "devis", dossiers: "dossier(s)", opportunites: "opportunité(s)", factures: "facture(s)",
  session_participants: "inscription(s)", plans_formation: "plan(s) de formation", signatures: "demande(s) de signature",
  tresorerie_encaissements: "encaissement(s)", contact_actions: "action(s) sur la fiche", emails: "e-mail(s)", contacts: "contact(s)", sessions_formation: "session(s)", plan_pdfs: "PDF de plan",
};

async function references(db: SupabaseClient, table: string, id: string): Promise<string[]> {
  const out: string[] = [];
  for (const [t, col] of REFERENCES[table] ?? []) {
    const { count } = await db.from(t).select("id", { count: "exact", head: true }).eq(col, id);
    if (count) out.push(`${count} ${LIBELLES[t] ?? t}`);
  }
  return out;
}

/** Rejoue le plan. S'arrête à la première étape impossible et dit pourquoi. */
export async function appliquerAnnulation(db: SupabaseClient, etapes: EtapeAnnulation[]): Promise<{ ok: true } | { ok: false; erreur: string; faites: number }> {
  let faites = 0;
  for (const e of etapes) {
    if (e.op === "delete") {
      const liees = await references(db, e.table, e.id);
      if (liees.length) {
        return { ok: false, faites, erreur: `Impossible de supprimer : la fiche est déjà utilisée (${liees.join(", ")}). Faites le ménage à la main.` };
      }
      const { error } = await db.from(e.table).delete().eq("id", e.id);
      if (error) return { ok: false, faites, erreur: error.message };
    } else {
      const { error } = await db.from(e.table).update(e.valeurs).eq("id", e.id);
      if (error) return { ok: false, faites, erreur: error.message };
    }
    faites++;
  }
  return { ok: true };
}

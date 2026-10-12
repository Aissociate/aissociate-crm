// Outils « métier » de l'agent : commercial (entreprises, opportunités, devis,
// factures, leads), formation (dossiers, plans, sessions, inscriptions,
// émargement, évaluations) et production de documents (PDF devis/facture,
// documents AGEFICE).
//
// Même contrat que les outils historiques d'index.ts :
//   • lecture  → client RLS de l'utilisateur, montants masqués sans droit finances ;
//   • écriture → `proposer_*` : on vérifie la cible et on rédige la description
//     de la proposition ; l'exécution n'a lieu qu'après validation explicite,
//     avec le JWT de l'utilisateur (la RLS s'applique aussi à l'exécution).
//
// Chaque fonction renvoie `null` quand l'outil ne relève pas de ce module :
// index.ts garde ainsi la main sur ses propres outils.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export type DroitsMetier = {
  contacts?: boolean; dossiers?: boolean; formations?: boolean; pipeline?: boolean;
  entreprises?: boolean; devis?: boolean; agenda?: boolean; leads?: boolean;
};

export type CtxMetier = {
  db: SupabaseClient;
  user: { id: string };
  isDirection: boolean;
  finances: boolean;
  droits: DroitsMetier;
};

export type ExecMetier = {
  db: SupabaseClient;
  authHeader: string;
  supabaseUrl: string;
  /** Origine du CRM (liens publics d'émargement, d'évaluation). */
  origin: string | null;
};

type Res = { ok: true; entite: string; entite_id: string | null; resultat?: unknown } | { ok: false; erreur: string };
type Tool = (name: string, description: string, properties: Record<string, unknown>, required?: string[]) => void;

const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const num = (v: unknown): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const plusJours = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fullName = (p: string | null | undefined, n: string | null | undefined) => `${p ?? ""} ${n ?? ""}`.trim();

const DEVIS_STATUTS = ["brouillon", "envoye", "accepte", "refuse", "expire"];
const FACTURE_STATUTS = ["brouillon", "envoyee", "payee", "annulee"];
const DEMIS = { matin: "Matin", apres_midi: "Après-midi" } as const;
const TYPES_DOCUMENT = ["devis_pdf", "facture_pdf", "agefice_demande", "convention", "feuille_emargement", "attestation_assiduite"];
const AGEFICE: Record<string, string> = {
  agefice_demande: "demande", convention: "convention",
  feuille_emargement: "emargement", attestation_assiduite: "attestation",
};
/** Pièces créées avec un dossier (miroir de src/lib/dossierClient.ts). */
const PIECES_DEFAUT = [
  "Devis signé", "Programme de formation", "Convention / contrat de formation",
  "Pièce d'identité du bénéficiaire", "Justificatif d'éligibilité", "Demande de prise en charge",
  "Feuille d'émargement", "Attestation d'assiduité", "Attestation CPF", "RIB", "Avis Sirene",
];

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue
// ─────────────────────────────────────────────────────────────────────────────

export function definitionsMetier(ctx: CtxMetier, tool: Tool): void {
  const on = (k: keyof DroitsMetier) => ctx.droits[k] !== false;
  const ligneDevis = {
    type: "object",
    properties: {
      designation: { type: "string" }, description: { type: "string" },
      quantite: { type: "number" }, unite: { type: "string", description: "heure, jour, forfait, personne…" },
      prix_unitaire_ht: { type: "number" },
    },
    required: ["designation", "quantite", "prix_unitaire_ht"],
  };

  // ── Lectures ──
  if (on("devis")) {
    tool("fiche_devis", "Détail d'un devis : en-tête, lignes, contact et dossier liés.",
      { devis_id: { type: "string" }, numero: { type: "string" } });
  }
  if (ctx.finances && on("devis")) {
    tool("lister_factures", "Factures (numéro, statut, échéance, objet, total, règlement).",
      { statut: { type: "string", enum: FACTURE_STATUTS }, contact_id: { type: "string" } });
  }
  if (on("dossiers")) {
    tool("lister_financeurs", "Financeurs actifs (CPF, OPCO, AGEFICE…) avec leur id — à utiliser avant de rattacher un financeur.", {});
    tool("lister_plans", "Plans de formation (nom, statut, effectif, dates), filtrables par contact ou dossier. Nécessaires pour les documents AGEFICE.",
      { contact_id: { type: "string" }, dossier_id: { type: "string" } });
  }
  if (on("agenda")) {
    tool("fiche_session", "Détail d'une session : participants inscrits, demi-journées d'émargement, liens d'évaluation.",
      { session_id: { type: "string" } }, ["session_id"]);
  }

  // ── Écritures (propositions) ──
  if (on("contacts")) {
    tool("proposer_maj_contact",
      "Propose de compléter ou corriger la fiche d'un contact (coordonnées, qualification, rattachement entreprise). Ne renseigner que les champs à modifier.",
      {
        contact_id: { type: "string" }, prenom: { type: "string" }, nom: { type: "string" },
        email: { type: "string" }, telephone: { type: "string" }, ville: { type: "string" }, fonction: { type: "string" },
        besoin_resume: { type: "string" }, formation_envisagee: { type: "string" },
        financement_envisage: { type: "string" }, interet: { type: "string" },
        entreprise_id: { type: "string", description: "Entreprise à rattacher (id vu via rechercher_entreprises)" },
      }, ["contact_id"]);
    tool("proposer_action_faite",
      "Propose de marquer comme faite une action/relance planifiée (id vu via lister_actions_a_faire), avec un compte-rendu facultatif.",
      { action_id: { type: "string" }, compte_rendu: { type: "string" } }, ["action_id"]);
  }
  if (on("entreprises")) {
    tool("proposer_creation_entreprise",
      "Propose de créer une entreprise (vérifier d'abord qu'elle n'existe pas avec rechercher_entreprises), éventuellement rattachée à un contact.",
      {
        raison_sociale: { type: "string" }, siret: { type: "string" }, ville: { type: "string" },
        secteur: { type: "string" }, telephone: { type: "string" }, email: { type: "string" },
        contact_id: { type: "string", description: "Contact à rattacher à cette entreprise" },
      }, ["raison_sociale"]);
  }
  if (on("pipeline")) {
    tool("proposer_creation_opportunite",
      "Propose de créer une opportunité commerciale dans le pipeline (clé d'étape existante, défaut « nouveau »).",
      {
        titre: { type: "string" }, contact_id: { type: "string" }, entreprise_id: { type: "string" },
        montant: { type: "number" }, etape: { type: "string" }, probabilite: { type: "number" },
        date_cloture_prev: { type: "string", description: "AAAA-MM-JJ" }, notes: { type: "string" },
      }, ["titre"]);
  }
  if (on("devis") && ctx.finances) {
    tool("proposer_creation_devis",
      "Propose de créer un devis en brouillon (numéro attribué automatiquement, TVA exonérée comme les devis du CRM). Rattaché au dossier client du contact (créé si besoin). Prix : partir du catalogue (catalogue_formations) sauf indication contraire.",
      {
        contact_id: { type: "string" }, objet: { type: "string" },
        lignes: { type: "array", items: ligneDevis },
        formation_id: { type: "string" }, financeur_id: { type: "string" },
        date_validite: { type: "string", description: "AAAA-MM-JJ (défaut : +30 jours)" },
        conditions: { type: "string" },
        generer_pdf: { type: "boolean", description: "Générer aussi le PDF du devis" },
      }, ["contact_id", "objet", "lignes"]);
    tool("proposer_maj_statut_devis", "Propose de changer le statut d'un devis.",
      { devis_id: { type: "string" }, statut: { type: "string", enum: DEVIS_STATUTS } }, ["devis_id", "statut"]);
  }
  if (on("devis") && ctx.finances && ctx.isDirection) {
    tool("proposer_creation_facture",
      "Propose de créer une facture en brouillon à partir d'un devis (lignes et montants repris).",
      { devis_id: { type: "string" }, date_echeance: { type: "string", description: "AAAA-MM-JJ (défaut : +30 jours)" } }, ["devis_id"]);
    tool("proposer_maj_statut_facture",
      "Propose de changer le statut d'une facture (ex. payée, avec date et mode de règlement).",
      {
        facture_id: { type: "string" }, statut: { type: "string", enum: FACTURE_STATUTS },
        date_reglement: { type: "string", description: "AAAA-MM-JJ" }, mode_reglement: { type: "string" },
      }, ["facture_id", "statut"]);
  }
  if (on("dossiers")) {
    tool("proposer_creation_dossier",
      "Propose d'ouvrir un dossier client (un par couple contact + formation ; l'existant est réutilisé), avec sa checklist de pièces.",
      { contact_id: { type: "string" }, formation_id: { type: "string" }, financeur_id: { type: "string" } }, ["contact_id"]);
    tool("proposer_creation_plan",
      "Propose de créer un plan de formation (programme repris du catalogue) pour un contact — préalable aux documents AGEFICE.",
      {
        contact_id: { type: "string" }, formation_id: { type: "string" }, dossier_id: { type: "string" },
        nom: { type: "string" }, nb_participants: { type: "number" },
        dates_session: { type: "string", description: "Texte libre, ex. « 12 et 13 novembre 2026 »" },
        objectifs: { type: "string" },
      }, ["contact_id", "formation_id"]);
    tool("proposer_generation_document",
      "Propose de générer un document : PDF d'un devis (devis_id) ou d'une facture (facture_id), ou un document AGEFICE à partir d'un plan (plan_id) : demande préalable, convention, feuille d'émargement, attestation d'assiduité.",
      {
        type: { type: "string", enum: TYPES_DOCUMENT },
        devis_id: { type: "string" }, facture_id: { type: "string" }, plan_id: { type: "string" },
      }, ["type"]);
  }
  if (on("agenda")) {
    tool("proposer_creation_session",
      "Propose de planifier une session de formation.",
      {
        titre: { type: "string" }, formation_id: { type: "string" }, dossier_id: { type: "string" },
        date_debut: { type: "string", description: "AAAA-MM-JJTHH:MM" }, date_fin: { type: "string", description: "AAAA-MM-JJTHH:MM" },
        lieu: { type: "string" }, modalite: { type: "string", enum: ["presentiel", "distanciel", "mixte"] },
        formateur: { type: "string" },
      }, ["titre", "date_debut"]);
    tool("proposer_inscription_session",
      "Propose d'inscrire un contact à une session (sans doublon).",
      { session_id: { type: "string" }, contact_id: { type: "string" } }, ["session_id", "contact_id"]);
    tool("proposer_envoi_emargement",
      "Propose d'ouvrir les demi-journées d'émargement d'une date et d'envoyer à chaque participant inscrit (avec e-mail) le lien de sa feuille.",
      {
        session_id: { type: "string" }, date: { type: "string", description: "AAAA-MM-JJ" },
        demi_journees: { type: "array", items: { type: "string", enum: ["matin", "apres_midi"] } },
      }, ["session_id", "date", "demi_journees"]);
    tool("proposer_envoi_evaluation",
      "Propose d'envoyer l'évaluation de fin de formation : « chaud » (envoyée tout de suite) ou « froid » (créée maintenant, à envoyer à J+30 depuis la page Évaluations).",
      {
        type: { type: "string", enum: ["chaud", "froid"] }, contact_id: { type: "string" },
        session_id: { type: "string" }, dossier_id: { type: "string" },
      }, ["type", "contact_id"]);
  }
  if (ctx.isDirection && on("leads")) {
    tool("proposer_conversion_lead",
      "Propose de convertir une demande entrante du site (id vu via lister_leads) en contact prospect (réutilise le contact existant s'il a le même e-mail).",
      { lead_id: { type: "string" } }, ["lead_id"]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectures
// ─────────────────────────────────────────────────────────────────────────────

export async function lireMetier(ctx: CtxMetier, name: string, a: Record<string, unknown>): Promise<unknown | null> {
  const { db, finances } = ctx;
  switch (name) {
    case "fiche_devis": {
      let q = db.from("devis").select("id, numero, statut, date_emission, date_validite, objet, conditions, total_ht, total_ttc, contact_id, dossier_id, financeur_id, fichier_url");
      q = a.devis_id ? q.eq("id", String(a.devis_id)) : q.ilike("numero", `%${a.numero ?? ""}%`);
      const { data: devis } = await q.limit(1).maybeSingle();
      if (!devis) return { erreur: "Devis introuvable (ou hors de votre périmètre)." };
      const { data: lignes } = await db.from("devis_lignes")
        .select("designation, description, quantite, unite, prix_unitaire_ht").eq("devis_id", devis.id).order("ordre");
      const d = { ...devis } as Record<string, unknown>;
      if (!finances) { delete d.total_ht; delete d.total_ttc; }
      return { devis: d, lignes: finances ? lignes ?? [] : (lignes ?? []).map(({ prix_unitaire_ht: _p, ...l }) => l) };
    }
    case "lister_factures": {
      if (!finances) return { erreur: "Accès aux montants non autorisé." };
      let q = db.from("factures")
        .select("id, numero, statut, date_emission, date_echeance, objet, total_ttc, date_reglement, contact_id, devis_id")
        .order("date_emission", { ascending: false }).limit(100);
      if (a.statut) q = q.eq("statut", String(a.statut));
      if (a.contact_id) q = q.eq("contact_id", String(a.contact_id));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { total: data?.length ?? 0, factures: data ?? [] };
    }
    case "lister_financeurs": {
      const { data } = await db.from("financeurs").select("id, code, nom, type").eq("actif", true).order("code");
      return { financeurs: data ?? [] };
    }
    case "lister_plans": {
      let q = db.from("plans_formation")
        .select("id, nom, statut, formation_id, contact_id, dossier_id, nb_participants, dates_session, duree_heures, modalite")
        .order("updated_at", { ascending: false }).limit(50);
      if (a.contact_id) q = q.eq("contact_id", String(a.contact_id));
      if (a.dossier_id) q = q.eq("dossier_id", String(a.dossier_id));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { plans: data ?? [] };
    }
    case "fiche_session": {
      const id = String(a.session_id);
      const { data: session } = await db.from("sessions_formation")
        .select("id, titre, formation_id, dossier_id, date_debut, date_fin, lieu, modalite, formateur, notes").eq("id", id).maybeSingle();
      if (!session) return { erreur: "Session introuvable (ou hors de votre périmètre)." };
      const [{ data: participants }, { data: creneaux }, { data: evaluations }] = await Promise.all([
        db.from("session_participants").select("id, contact_id, nom, prenom, email, statut").eq("session_id", id).order("nom"),
        db.from("emargement_creneaux").select("date, demi_journee").eq("session_id", id).order("date"),
        db.from("evaluation_liens").select("type, destinataire_nom, statut, envoi_prevu_le").eq("session_id", id),
      ]);
      return { session, participants: participants ?? [], demi_journees_emargement: creneaux ?? [], evaluations: evaluations ?? [] };
    }
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Propositions : vérification de la cible + description lisible
// ─────────────────────────────────────────────────────────────────────────────

async function libelleContact(db: SupabaseClient, id: unknown): Promise<string | null> {
  if (!id) return null;
  const { data } = await db.from("contacts").select("nom, prenom").eq("id", String(id)).maybeSingle();
  return data ? fullName(data.prenom, data.nom) : null;
}

async function libelleFormation(db: SupabaseClient, id: unknown): Promise<string | null> {
  if (!id) return null;
  const { data } = await db.from("formations").select("intitule").eq("id", String(id)).maybeSingle();
  return data?.intitule ?? null;
}

const CHAMPS_CONTACT = ["prenom", "nom", "email", "telephone", "ville", "fonction", "besoin_resume", "formation_envisagee", "financement_envisage", "interet", "entreprise_id"];

export async function decrireMetier(ctx: CtxMetier, name: string, a: Record<string, unknown>): Promise<string | { erreur: string } | null> {
  const { db } = ctx;
  const introuvable = (quoi: string) => ({ erreur: `${quoi} introuvable (ou hors de votre périmètre) : proposition impossible.` });

  switch (name) {
    case "proposer_maj_contact": {
      const who = await libelleContact(db, a.contact_id); if (!who) return introuvable("Contact");
      const champs = CHAMPS_CONTACT.filter((k) => a[k] != null && a[k] !== "");
      if (!champs.length) return { erreur: "Aucun champ à modifier." };
      let entreprise: string | null = null;
      if (a.entreprise_id) {
        const { data } = await db.from("entreprises").select("raison_sociale").eq("id", String(a.entreprise_id)).maybeSingle();
        if (!data) return introuvable("Entreprise");
        entreprise = data.raison_sociale;
      }
      const detail = champs.map((k) => k === "entreprise_id" ? `entreprise : ${entreprise}` : `${k.replaceAll("_", " ")} : ${String(a[k]).slice(0, 80)}`);
      return `Mettre à jour la fiche de ${who} — ${detail.join(" · ")}`;
    }
    case "proposer_action_faite": {
      const { data } = await db.from("contact_actions").select("type, description, date_action, contact_id").eq("id", String(a.action_id)).maybeSingle();
      if (!data) return introuvable("Action");
      const who = await libelleContact(db, data.contact_id);
      return `Marquer comme faite l'action « ${data.type} » du ${data.date_action} (${who ?? "contact"}) — ${String(data.description).slice(0, 100)}${a.compte_rendu ? ` · compte-rendu : ${String(a.compte_rendu).slice(0, 120)}` : ""}`;
    }
    case "proposer_creation_entreprise": {
      const who = a.contact_id ? await libelleContact(db, a.contact_id) : null;
      if (a.contact_id && !who) return introuvable("Contact");
      return `Créer l'entreprise ${a.raison_sociale}${a.ville ? ` (${a.ville})` : ""}${who ? ` et y rattacher ${who}` : ""}`;
    }
    case "proposer_creation_opportunite": {
      const who = a.contact_id ? await libelleContact(db, a.contact_id) : null;
      if (a.contact_id && !who) return introuvable("Contact");
      const etape = String(a.etape ?? "nouveau");
      const { data: pRow } = await db.from("parametres").select("valeur").eq("cle", "pipeline").maybeSingle();
      const colonnes = ((pRow?.valeur as { colonnes?: { cle: string }[] } | null)?.colonnes ?? []).map((c) => c.cle);
      const valides = colonnes.length ? colonnes : ["nouveau", "qualifie", "proposition", "negociation", "gagne", "perdu"];
      if (!valides.includes(etape)) return { erreur: `Étape inconnue « ${etape} ». Étapes valides : ${valides.join(", ")}.` };
      return `Créer l'opportunité « ${a.titre} »${who ? ` pour ${who}` : ""} à l'étape « ${etape} »${num(a.montant) != null ? ` — ${euros(num(a.montant)!)}` : ""}`;
    }
    case "proposer_creation_devis": {
      const who = await libelleContact(db, a.contact_id); if (!who) return introuvable("Contact");
      const lignes = Array.isArray(a.lignes) ? a.lignes as Record<string, unknown>[] : [];
      if (!lignes.length) return { erreur: "Un devis doit comporter au moins une ligne." };
      if (a.formation_id && !(await libelleFormation(db, a.formation_id))) return introuvable("Formation");
      const total = lignes.reduce((t, l) => t + (num(l.quantite) ?? 1) * (num(l.prix_unitaire_ht) ?? 0), 0);
      const detail = lignes.map((l) => `${num(l.quantite) ?? 1} ${l.unite ?? "×"} ${l.designation} à ${euros(num(l.prix_unitaire_ht) ?? 0)}`).join(" ; ");
      return `Créer un devis brouillon pour ${who} — « ${a.objet} » : ${detail} — total ${euros(total)} HT (TVA exonérée)${a.generer_pdf ? ", avec son PDF" : ""}`;
    }
    case "proposer_maj_statut_devis": {
      const { data } = await db.from("devis").select("numero").eq("id", String(a.devis_id)).maybeSingle();
      if (!data) return introuvable("Devis");
      return `Passer le devis ${data.numero} au statut « ${a.statut} »`;
    }
    case "proposer_creation_facture": {
      const { data } = await db.from("devis").select("numero, objet, total_ttc").eq("id", String(a.devis_id)).maybeSingle();
      if (!data) return introuvable("Devis");
      return `Créer une facture brouillon depuis le devis ${data.numero} (${data.objet ?? "sans objet"}) — ${euros(Number(data.total_ttc ?? 0))} TTC`;
    }
    case "proposer_maj_statut_facture": {
      const { data } = await db.from("factures").select("numero").eq("id", String(a.facture_id)).maybeSingle();
      if (!data) return introuvable("Facture");
      return `Passer la facture ${data.numero} au statut « ${a.statut} »${a.date_reglement ? ` (réglée le ${a.date_reglement}${a.mode_reglement ? `, ${a.mode_reglement}` : ""})` : ""}`;
    }
    case "proposer_creation_dossier": {
      const who = await libelleContact(db, a.contact_id); if (!who) return introuvable("Contact");
      const formation = a.formation_id ? await libelleFormation(db, a.formation_id) : null;
      if (a.formation_id && !formation) return introuvable("Formation");
      return `Ouvrir le dossier client de ${who}${formation ? ` pour « ${formation} »` : ""} (réutilisé s'il existe déjà)`;
    }
    case "proposer_creation_plan": {
      const who = await libelleContact(db, a.contact_id); if (!who) return introuvable("Contact");
      const formation = await libelleFormation(db, a.formation_id); if (!formation) return introuvable("Formation");
      return `Créer le plan de formation « ${a.nom ?? formation} » pour ${who}${a.nb_participants ? ` — ${a.nb_participants} participant(s)` : ""}${a.dates_session ? ` — ${a.dates_session}` : ""}`;
    }
    case "proposer_generation_document": {
      const type = String(a.type);
      if (type === "devis_pdf") {
        const { data } = await db.from("devis").select("numero").eq("id", String(a.devis_id ?? "")).maybeSingle();
        return data ? `Générer le PDF du devis ${data.numero}` : introuvable("Devis");
      }
      if (type === "facture_pdf") {
        const { data } = await db.from("factures").select("numero").eq("id", String(a.facture_id ?? "")).maybeSingle();
        return data ? `Générer le PDF de la facture ${data.numero}` : introuvable("Facture");
      }
      if (!AGEFICE[type]) return { erreur: `Type de document inconnu : ${type}` };
      const { data } = await db.from("plans_formation").select("nom").eq("id", String(a.plan_id ?? "")).maybeSingle();
      if (!data) return introuvable("Plan de formation (requis pour un document AGEFICE)");
      const libelles: Record<string, string> = {
        agefice_demande: "la demande préalable AGEFICE", convention: "la convention de formation",
        feuille_emargement: "la feuille d'émargement", attestation_assiduite: "l'attestation d'assiduité",
      };
      return `Générer ${libelles[type]} du plan « ${data.nom} »`;
    }
    case "proposer_creation_session": {
      if (a.formation_id && !(await libelleFormation(db, a.formation_id))) return introuvable("Formation");
      return `Planifier la session « ${a.titre} » le ${String(a.date_debut).replace("T", " à ")}${a.lieu ? ` — ${a.lieu}` : ""}${a.modalite ? ` (${a.modalite})` : ""}`;
    }
    case "proposer_inscription_session": {
      const who = await libelleContact(db, a.contact_id); if (!who) return introuvable("Contact");
      const { data } = await db.from("sessions_formation").select("titre, date_debut").eq("id", String(a.session_id)).maybeSingle();
      if (!data) return introuvable("Session");
      return `Inscrire ${who} à la session « ${data.titre} » du ${String(data.date_debut).slice(0, 10)}`;
    }
    case "proposer_envoi_emargement": {
      const { data } = await db.from("sessions_formation").select("titre").eq("id", String(a.session_id)).maybeSingle();
      if (!data) return introuvable("Session");
      const demis = (Array.isArray(a.demi_journees) ? a.demi_journees : []).filter((d): d is keyof typeof DEMIS => typeof d === "string" && d in DEMIS);
      if (!demis.length) return { erreur: "Indiquer au moins une demi-journée (matin, apres_midi)." };
      const { count } = await db.from("session_participants").select("id", { count: "exact", head: true })
        .eq("session_id", String(a.session_id)).not("email", "is", null);
      if (!count) return { erreur: "Aucun participant inscrit avec une adresse e-mail sur cette session." };
      return `Envoyer la feuille d'émargement du ${a.date} (${demis.map((d) => DEMIS[d].toLowerCase()).join(" et ")}) aux ${count} participant(s) de « ${data.titre} »`;
    }
    case "proposer_envoi_evaluation": {
      const { data: c } = await db.from("contacts").select("nom, prenom, email").eq("id", String(a.contact_id)).maybeSingle();
      if (!c) return introuvable("Contact");
      if (!c.email) return { erreur: "Ce contact n'a pas d'adresse e-mail." };
      return a.type === "chaud"
        ? `Envoyer l'évaluation à chaud à ${fullName(c.prenom, c.nom)} <${c.email}>`
        : `Préparer l'évaluation à froid (J+30) de ${fullName(c.prenom, c.nom)} — à envoyer depuis la page Évaluations à l'échéance`;
    }
    case "proposer_conversion_lead": {
      const { data } = await db.from("contact_requests").select("first_name, last_name, email, status").eq("id", String(a.lead_id)).maybeSingle();
      if (!data) return introuvable("Demande");
      if (data.status === "converti") return { erreur: "Cette demande est déjà convertie." };
      return `Convertir la demande de ${fullName(data.first_name, data.last_name) || data.email} en contact prospect`;
    }
    default: return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exécution d'une proposition validée
// ─────────────────────────────────────────────────────────────────────────────

async function appelFonction(x: ExecMetier, nom: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null; erreur?: string }> {
  const resp = await fetch(`${x.supabaseUrl}/functions/v1/${nom}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": x.authHeader },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => null) as Record<string, unknown> | null;
  if (!resp.ok || data?.error) return { ok: false, data, erreur: `${nom} : ${String(data?.error ?? resp.status)}` };
  return { ok: true, data };
}

async function moi(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.auth.getUser();
  return data?.user?.id ?? null;
}

/** Envoi d'un e-mail + trace en Messagerie, comme les écrans du CRM. */
async function envoyerMail(
  x: ExecMetier, to: string, sujet: string, html: string, texte: string,
  liens: { contact_id?: string | null; dossier_id?: string | null },
): Promise<string | null> {
  const r = await appelFonction(x, "send-email", { to, subject: sujet, html, text: texte });
  if (!r.ok) return r.erreur ?? "Envoi impossible";
  await x.db.from("emails").insert({
    destinataires: [to], copie: [], sujet, corps: texte,
    statut: "envoye", canal: "email", direction: "sortant",
    contact_id: liens.contact_id ?? null, dossier_id: liens.dossier_id ?? null,
    sent_at: new Date().toISOString(), owner_id: await moi(x.db), attachments: [],
  });
  return null;
}

/** Dossier client unique par (contact, formation) — miroir de ensureDossierClient. */
async function assurerDossier(db: SupabaseClient, contactId: string, formationId: string | null, financeurId: string | null): Promise<{ id: string; cree: boolean } | { erreur: string }> {
  let q = db.from("dossiers").select("id").eq("contact_id", contactId);
  q = formationId ? q.eq("formation_id", formationId) : q.is("formation_id", null);
  const { data: existant } = await q.limit(1).maybeSingle();
  if (existant) return { id: existant.id, cree: false };

  const { data: c } = await db.from("contacts").select("nom, prenom, entreprise_id").eq("id", contactId).maybeSingle();
  if (!c) return { erreur: "Contact introuvable" };
  const formation = formationId ? await libelleFormation(db, formationId) : null;
  const nom = fullName(c.prenom, c.nom);
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(2, 14);
  const { data: cree, error } = await db.from("dossiers").insert({
    reference: `DOS-${stamp}-${Math.random().toString(36).slice(2, 5)}`,
    intitule: formation ? `${nom} — ${formation}` : `Dossier ${nom}`,
    contact_id: contactId, formation_id: formationId, entreprise_id: c.entreprise_id ?? null,
    financeur_id: financeurId, statut: "brouillon", owner_id: await moi(db),
  }).select("id").single();
  if (error || !cree) return { erreur: error?.message ?? "Création du dossier impossible" };
  await db.from("dossier_pieces").insert(PIECES_DEFAUT.map((libelle) => ({
    dossier_id: cree.id, libelle, obligatoire: true, statut: "manquante",
  })));
  return { id: cree.id, cree: true };
}

export async function executerMetier(x: ExecMetier, outil: string, a: Record<string, unknown>): Promise<Res | null> {
  const { db } = x;
  const echec = (e: { message: string } | null | undefined, defaut = "Erreur inconnue"): Res => ({ ok: false, erreur: e?.message ?? defaut });

  switch (outil) {
    case "proposer_maj_contact": {
      const maj: Record<string, unknown> = {};
      for (const k of CHAMPS_CONTACT) if (a[k] != null && a[k] !== "") maj[k] = String(a[k]);
      const { error } = await db.from("contacts").update(maj).eq("id", String(a.contact_id));
      return error ? echec(error) : { ok: true, entite: "contacts", entite_id: String(a.contact_id) };
    }
    case "proposer_action_faite": {
      const id = String(a.action_id);
      const { data: act, error: e1 } = await db.from("contact_actions").select("description").eq("id", id).single();
      if (e1) return echec(e1);
      const description = a.compte_rendu ? `${act.description}\n— Compte-rendu : ${a.compte_rendu}` : act.description;
      const { error } = await db.from("contact_actions").update({ faite: true, description }).eq("id", id);
      return error ? echec(error) : { ok: true, entite: "contact_actions", entite_id: id };
    }
    case "proposer_creation_entreprise": {
      const { data, error } = await db.from("entreprises").insert({
        raison_sociale: String(a.raison_sociale), siret: str(a.siret), ville: str(a.ville), secteur: str(a.secteur),
        telephone: str(a.telephone), email: str(a.email), owner_id: await moi(db),
      }).select("id").single();
      if (error) return echec(error);
      if (a.contact_id) await db.from("contacts").update({ entreprise_id: data.id }).eq("id", String(a.contact_id));
      return { ok: true, entite: "entreprises", entite_id: data.id };
    }
    case "proposer_creation_opportunite": {
      const { data, error } = await db.from("opportunites").insert({
        titre: String(a.titre), contact_id: str(a.contact_id), entreprise_id: str(a.entreprise_id),
        montant: num(a.montant) ?? 0, stage: String(a.etape ?? "nouveau"), probabilite: num(a.probabilite) ?? 10,
        date_cloture_prev: str(a.date_cloture_prev), notes: str(a.notes), owner_id: await moi(db),
      }).select("id").single();
      return error ? echec(error) : { ok: true, entite: "opportunites", entite_id: data.id };
    }
    case "proposer_creation_devis": {
      const contactId = String(a.contact_id);
      const dossier = await assurerDossier(db, contactId, str(a.formation_id), str(a.financeur_id));
      if ("erreur" in dossier) return { ok: false, erreur: dossier.erreur };
      const { data: c } = await db.from("contacts").select("entreprise_id").eq("id", contactId).maybeSingle();
      const lignes = (Array.isArray(a.lignes) ? a.lignes : []) as Record<string, unknown>[];
      const total = lignes.reduce((t, l) => t + (num(l.quantite) ?? 1) * (num(l.prix_unitaire_ht) ?? 0), 0);
      const { data: devis, error } = await db.from("devis").insert({
        contact_id: contactId, entreprise_id: c?.entreprise_id ?? null, financeur_id: str(a.financeur_id),
        dossier_id: dossier.id, date_emission: aujourdhui(), date_validite: str(a.date_validite) ?? plusJours(30),
        objet: String(a.objet), conditions: str(a.conditions) ?? "Règlement à 30 jours. Acompte de 30 % à la commande.",
        statut: "brouillon", tva_exoneree: true, tva_taux: 0, total_ht: total, total_tva: 0, total_ttc: total,
        owner_id: await moi(db),
      }).select("id, numero").single();
      if (error) return echec(error);
      const { error: eL } = await db.from("devis_lignes").insert(lignes.map((l, i) => ({
        devis_id: devis.id, designation: String(l.designation), description: str(l.description),
        quantite: num(l.quantite) ?? 1, unite: str(l.unite) ?? "heure", prix_unitaire_ht: num(l.prix_unitaire_ht) ?? 0, ordre: i,
      })));
      if (eL) return { ok: false, erreur: `Devis ${devis.numero} créé, mais lignes non enregistrées : ${eL.message}` };
      let pdf: string | null = null;
      if (a.generer_pdf) {
        const r = await appelFonction(x, "generate-devis", { devisId: devis.id });
        pdf = r.ok ? "généré" : `échec (${r.erreur})`;
      }
      return { ok: true, entite: "devis", entite_id: devis.id, resultat: { numero: devis.numero, dossier_id: dossier.id, ...(pdf ? { pdf } : {}) } };
    }
    case "proposer_maj_statut_devis": {
      const { error } = await db.from("devis").update({ statut: String(a.statut) }).eq("id", String(a.devis_id));
      return error ? echec(error) : { ok: true, entite: "devis", entite_id: String(a.devis_id) };
    }
    case "proposer_creation_facture": {
      const { data: d, error: e1 } = await db.from("devis").select("*").eq("id", String(a.devis_id)).single();
      if (e1) return echec(e1);
      const { data: dossier } = d.dossier_id
        ? await db.from("dossiers").select("formation_id").eq("id", d.dossier_id).maybeSingle()
        : { data: null };
      const { data: f, error } = await db.from("factures").insert({
        devis_id: d.id, contact_id: d.contact_id, entreprise_id: d.entreprise_id, financeur_id: d.financeur_id,
        dossier_id: d.dossier_id, formation_id: dossier?.formation_id ?? null,
        date_emission: aujourdhui(), date_echeance: str(a.date_echeance) ?? plusJours(30), statut: "brouillon",
        tva_taux: d.tva_taux, tva_exoneree: d.tva_exoneree, total_ht: d.total_ht, total_tva: d.total_tva, total_ttc: d.total_ttc,
        objet: d.objet, conditions: d.conditions, owner_id: await moi(db),
      }).select("id, numero").single();
      if (error) return echec(error);
      const { data: lignes } = await db.from("devis_lignes").select("designation, description, quantite, unite, prix_unitaire_ht, ordre").eq("devis_id", d.id);
      if (lignes?.length) await db.from("facture_lignes").insert(lignes.map((l) => ({ ...l, facture_id: f.id })));
      return { ok: true, entite: "factures", entite_id: f.id, resultat: { numero: f.numero } };
    }
    case "proposer_maj_statut_facture": {
      const maj: Record<string, unknown> = { statut: String(a.statut) };
      if (a.statut === "payee") { maj.date_reglement = str(a.date_reglement) ?? aujourdhui(); if (a.mode_reglement) maj.mode_reglement = String(a.mode_reglement); }
      const { error } = await db.from("factures").update(maj).eq("id", String(a.facture_id));
      return error ? echec(error) : { ok: true, entite: "factures", entite_id: String(a.facture_id) };
    }
    case "proposer_creation_dossier": {
      const r = await assurerDossier(db, String(a.contact_id), str(a.formation_id), str(a.financeur_id));
      if ("erreur" in r) return { ok: false, erreur: r.erreur };
      return { ok: true, entite: "dossiers", entite_id: r.id, resultat: { existait_deja: !r.cree } };
    }
    case "proposer_creation_plan": {
      const { data: fo, error: e1 } = await db.from("formations").select("intitule, objectifs, programme, duree_heures, modalite").eq("id", String(a.formation_id)).single();
      if (e1) return echec(e1);
      const contenu = (Array.isArray(fo.programme) ? fo.programme : []).map((m: unknown) => {
        if (m && typeof m === "object") { const o = m as { titre?: string; contenu?: string }; return [o.titre, o.contenu].filter(Boolean).join(" — "); }
        return String(m ?? "");
      });
      const { data: c } = await db.from("contacts").select("entreprise_id").eq("id", String(a.contact_id)).maybeSingle();
      const { data, error } = await db.from("plans_formation").insert({
        nom: str(a.nom) ?? fo.intitule, formation_id: String(a.formation_id), contact_id: String(a.contact_id),
        entreprise_id: c?.entreprise_id ?? null, dossier_id: str(a.dossier_id), objectifs: str(a.objectifs) ?? fo.objectifs,
        contenu, duree_heures: fo.duree_heures ?? 0, modalite: fo.modalite ?? "presentiel", statut: "brouillon", version: 1,
        nb_participants: num(a.nb_participants), dates_session: str(a.dates_session), owner_id: await moi(db),
      }).select("id").single();
      return error ? echec(error) : { ok: true, entite: "plans_formation", entite_id: data.id };
    }
    case "proposer_generation_document": {
      const type = String(a.type);
      if (type === "devis_pdf") {
        const r = await appelFonction(x, "generate-devis", { devisId: String(a.devis_id) });
        return r.ok ? { ok: true, entite: "devis", entite_id: String(a.devis_id), resultat: r.data } : { ok: false, erreur: r.erreur! };
      }
      if (type === "facture_pdf") {
        const r = await appelFonction(x, "generate-facture", { factureId: String(a.facture_id) });
        return r.ok ? { ok: true, entite: "factures", entite_id: String(a.facture_id), resultat: r.data } : { ok: false, erreur: r.erreur! };
      }
      const r = await appelFonction(x, "generate-agefice", { planId: String(a.plan_id), type: AGEFICE[type], userId: await moi(db) });
      return r.ok ? { ok: true, entite: "plans_formation", entite_id: String(a.plan_id), resultat: r.data } : { ok: false, erreur: r.erreur! };
    }
    case "proposer_creation_session": {
      const { data, error } = await db.from("sessions_formation").insert({
        titre: String(a.titre), formation_id: str(a.formation_id), dossier_id: str(a.dossier_id),
        date_debut: String(a.date_debut), date_fin: str(a.date_fin), lieu: str(a.lieu),
        modalite: str(a.modalite), formateur: str(a.formateur), created_by: await moi(db),
      }).select("id").single();
      return error ? echec(error) : { ok: true, entite: "sessions_formation", entite_id: data.id };
    }
    case "proposer_inscription_session": {
      const sessionId = String(a.session_id), contactId = String(a.contact_id);
      const { data: c, error: e1 } = await db.from("contacts").select("nom, prenom, email").eq("id", contactId).single();
      if (e1) return echec(e1);
      const { data: inscrits } = await db.from("session_participants").select("id, contact_id, email").eq("session_id", sessionId);
      const email = c.email?.trim().toLowerCase() ?? null;
      const deja = (inscrits ?? []).find((p) => p.contact_id === contactId || (email && p.email?.toLowerCase() === email));
      if (deja) return { ok: true, entite: "session_participants", entite_id: deja.id, resultat: { deja_inscrit: true } };
      const { data, error } = await db.from("session_participants").insert({
        session_id: sessionId, contact_id: contactId, nom: c.nom, prenom: c.prenom,
        email, statut: "inscrit",
      }).select("id").single();
      return error ? echec(error) : { ok: true, entite: "session_participants", entite_id: data.id };
    }
    case "proposer_envoi_emargement": {
      if (!x.origin) return { ok: false, erreur: "Adresse du CRM inconnue : impossible de construire les liens." };
      const sessionId = String(a.session_id), date = String(a.date);
      const demis = (a.demi_journees as string[]).filter((d): d is keyof typeof DEMIS => d in DEMIS);
      const { data: s, error: e1 } = await db.from("sessions_formation").select("titre").eq("id", sessionId).single();
      if (e1) return echec(e1);
      const { error: eC } = await db.from("emargement_creneaux").upsert(
        demis.map((d) => ({ session_id: sessionId, date, demi_journee: d })),
        { onConflict: "session_id,date,demi_journee", ignoreDuplicates: true },
      );
      if (eC) return echec(eC);
      const [{ data: participants }, { data: acces }] = await Promise.all([
        db.from("session_participants").select("id, contact_id, nom, prenom, email").eq("session_id", sessionId).not("email", "is", null),
        db.from("emargement_acces").select("participant_id, token").eq("session_id", sessionId),
      ]);
      const tokens = new Map((acces ?? []).map((r) => [r.participant_id, r.token]));
      const quand = `${new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} (${demis.map((d) => DEMIS[d].toLowerCase()).join(" et ")})`;
      const sujet = `Feuille d'émargement — ${s.titre}`;
      const envoyes: string[] = [], echecs: string[] = [];
      for (const p of participants ?? []) {
        let token = tokens.get(p.id);
        if (!token) {
          const { data: cree } = await db.from("emargement_acces").insert({ session_id: sessionId, participant_id: p.id }).select("token").single();
          token = cree?.token;
        }
        if (!token) { echecs.push(p.email!); continue; }
        const url = `${x.origin}/emargement/${token}`;
        const html = `
          <p>Bonjour ${escHtml(p.prenom ?? p.nom)},</p>
          <p>Voici votre feuille d'émargement pour la formation «&nbsp;<strong>${escHtml(s.titre)}</strong>&nbsp;» du ${escHtml(quand)}.</p>
          <p><a href="${url}" style="background:#ea6a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Signer ma feuille d'émargement</a></p>
          <p>Sur la page, cliquez sur « Recevoir mon code » : un code vous est envoyé par e-mail pour valider votre signature. Vous pouvez signer à partir du jour de la formation.</p>
          <p>Ou copiez ce lien : ${url}</p>
          <p>Merci,<br/>L'équipe Aissociate</p>`;
        const texte = [
          `Bonjour ${p.prenom ?? p.nom},`, "",
          `Voici votre feuille d'émargement pour la formation « ${s.titre} » du ${quand}.`, "",
          `Signer ma feuille d'émargement : ${url}`, "",
          "Sur la page, cliquez sur « Recevoir mon code » : un code vous est envoyé par e-mail pour valider votre signature. Vous pouvez signer à partir du jour de la formation.", "",
          "Merci,", "L'équipe Aissociate",
        ].join("\n");
        const err = await envoyerMail(x, p.email!, sujet, html, texte, { contact_id: p.contact_id });
        (err ? echecs : envoyes).push(p.email!);
      }
      if (!envoyes.length) return { ok: false, erreur: `Aucun envoi réussi (${echecs.join(", ") || "pas de destinataire"}).` };
      return { ok: true, entite: "sessions_formation", entite_id: sessionId, resultat: { envoyes, echecs } };
    }
    case "proposer_envoi_evaluation": {
      if (!x.origin) return { ok: false, erreur: "Adresse du CRM inconnue : impossible de construire le lien." };
      const type = a.type === "froid" ? "froid" : "chaud";
      const { data: c, error: e1 } = await db.from("contacts").select("nom, prenom, email").eq("id", String(a.contact_id)).single();
      if (e1) return echec(e1);
      let titre: string | null = null, fin: string | null = null;
      if (a.session_id) {
        const { data: s } = await db.from("sessions_formation").select("titre, date_debut, date_fin").eq("id", String(a.session_id)).maybeSingle();
        titre = s?.titre ?? null; fin = (s?.date_fin ?? s?.date_debut ?? null)?.slice(0, 10) ?? null;
      }
      const echeance = (() => { const d = new Date(`${fin ?? aujourdhui()}T12:00:00`); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
      const nom = fullName(c.prenom, c.nom);
      const { data: lien, error } = await db.from("evaluation_liens").insert({
        type, libelle: type === "chaud" ? "Évaluation de fin de formation" : "Votre formation, un mois après",
        contact_id: String(a.contact_id), destinataire_nom: nom, destinataire_email: c.email,
        dossier_id: str(a.dossier_id), session_id: str(a.session_id), formation_intitule: titre,
        date_fin_formation: fin, envoi_prevu_le: type === "froid" ? echeance : null, multi: false,
        created_by: await moi(db),
      }).select("id, token, libelle").single();
      if (error) return echec(error);
      if (type === "froid") return { ok: true, entite: "evaluation_liens", entite_id: lien.id, resultat: { envoi_prevu_le: echeance } };
      const url = `${x.origin}/evaluation/${lien.token}`;
      const intro = "Merci d'avoir participé à la formation. Pourriez-vous prendre 5 minutes pour nous dire ce que vous en avez pensé ? Vos réponses nous servent directement à améliorer nos formations.";
      const texte = [`Bonjour ${nom},`, "", intro, "", `Donner mon avis : ${url}`, "", "Merci,", "L'équipe Aissociate"].join("\n");
      const html = `<p>Bonjour ${escHtml(nom)},</p><p>${intro}</p>
        <p><a href="${url}" style="background:#ea6a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Donner mon avis</a></p>
        <p>Ou copiez ce lien : ${url}</p><p>Merci,<br/>L'équipe Aissociate</p>`;
      const err = await envoyerMail(x, c.email!, lien.libelle, html, texte, { contact_id: String(a.contact_id), dossier_id: str(a.dossier_id) });
      if (err) return { ok: false, erreur: `Lien créé mais e-mail non envoyé : ${err}` };
      await db.from("evaluation_liens").update({ statut: "envoye", sent_at: new Date().toISOString() }).eq("id", lien.id);
      return { ok: true, entite: "evaluation_liens", entite_id: lien.id };
    }
    case "proposer_conversion_lead": {
      const { data: l, error: e1 } = await db.from("contact_requests").select("*").eq("id", String(a.lead_id)).single();
      if (e1) return echec(e1);
      let contactId: string | null = l.contact_id;
      if (!contactId && l.email) {
        const { data: ex } = await db.from("contacts").select("id").ilike("email", l.email).limit(1).maybeSingle();
        contactId = ex?.id ?? null;
      }
      if (!contactId) {
        const { data: c, error } = await db.from("contacts").insert({
          type: "prospect", nom: l.last_name || l.email || "Sans nom", prenom: l.first_name,
          email: l.email, telephone: l.phone, besoin_resume: l.message,
          statut_prospect: "nouveau", owner_id: await moi(db),
        }).select("id").single();
        if (error) return echec(error);
        contactId = c.id;
      }
      await db.from("contact_requests").update({ status: "converti", contact_id: contactId }).eq("id", l.id);
      return { ok: true, entite: "contacts", entite_id: contactId };
    }
    default: return null;
  }
}

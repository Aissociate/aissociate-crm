// Catalogue d'outils de l'assistant IA, partagé par l'Edge Function `agent`
// (chat du CRM) et par le serveur MCP distant (`mcp`).
//
// Contrat (inchangé) :
//   • lecture  → client RLS de l'utilisateur (`ctx.db`), montants masqués sans
//     droit finances : la RLS est l'unique périmètre ;
//   • écriture → `proposer_*` crée une ligne `ai_actions` (statut 'proposee').
//     Rien n'est écrit dans la donnée métier tant que l'utilisateur n'a pas
//     validé la proposition dans le CRM (mode `execute` de `agent`).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";
import { decrireMetier, definitionsMetier, lireMetier } from "./outils_metier.ts";
import { decrirePiecesJointes, listerPiecesJointes } from "./pieces_jointes.ts";

export type Droits = {
  documents?: boolean; contacts?: boolean; dossiers?: boolean; formations?: boolean;
  pipeline?: boolean; entreprises?: boolean; devis?: boolean; agenda?: boolean;
  recrutement?: boolean; leads?: boolean; finances?: boolean; scope?: string;
};

export type Ctx = {
  user: { id: string };
  db: SupabaseClient;          // client RLS (JWT utilisateur)
  isDirection: boolean;
  finances: boolean;           // droit de voir les montants
  droits: Droits;
  authHeader: string;
  supabaseUrl: string;
  conversationId: string | null;
  emit: (event: string, payload: unknown) => void;
  sources: { label: string; url: string | null }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue d'outils (format OpenAI tools, compris par OpenRouter)
// ─────────────────────────────────────────────────────────────────────────────

export function buildTools(ctx: Ctx) {
  const t: Record<string, unknown>[] = [];
  const d = ctx.droits;
  const on = (k: keyof Droits) => d[k] !== false;
  const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
    t.push({ type: "function", function: { name, description, parameters: { type: "object", properties, additionalProperties: false, required } } });

  if (on("contacts")) {
    tool("rechercher_contacts",
      "Recherche des contacts (prospects, apprenants…). Retourne une liste compacte. Utiliser fiche_contact pour le détail.",
      {
        recherche: { type: "string", description: "Texte cherché dans nom, prénom, email, téléphone" },
        statut: { type: "string", description: "Filtre exact sur statut_prospect (ex: 'nouveau', 'non assigné')" },
        type: { type: "string", enum: ["prospect", "contact", "apprenant", "contact_entreprise", "contact_financeur", "formateur", "encadrement"] },
        ville: { type: "string" },
        limite: { type: "number", description: "Max résultats (défaut 25, max 100)" },
      });
    tool("fiche_contact",
      "Fiche complète d'un contact : coordonnées, suivi commercial, dernières actions, opportunités et dossiers liés.",
      { contact_id: { type: "string" }, email: { type: "string" }, nom: { type: "string", description: "Recherche par nom si l'id est inconnu" } });
    tool("lister_actions_a_faire",
      "Actions/relances planifiées non faites (tâches). Peut filtrer sur un contact ou sur le retard.",
      { contact_id: { type: "string" }, en_retard: { type: "boolean", description: "true = uniquement les actions dont la date est passée" } });
  }
  if (on("entreprises")) {
    tool("rechercher_entreprises", "Recherche des entreprises (raison sociale, SIRET, ville, secteur).",
      { recherche: { type: "string" } });
  }
  if (on("pipeline")) {
    tool("lister_pipeline", "Opportunités commerciales du pipeline, avec étape, probabilité et échéance.",
      { etape: { type: "string", description: "Clé d'étape (colonne du pipeline, configurable) : nouveau, qualifie, proposition, negociation, gagne, perdu, ou une colonne personnalisée vue dans les données" } });
  }
  if (on("dossiers")) {
    tool("lister_dossiers", "Dossiers de financement (référence, intitulé, statut, montants).",
      { statut: { type: "string", enum: ["brouillon", "montage", "depose", "en_instruction", "accorde", "refuse", "en_cours", "solde", "cloture"] } });
    tool("fiche_dossier", "Détail d'un dossier : pièces justificatives et leur statut, dates, montants.",
      { dossier_id: { type: "string" }, reference: { type: "string" } });
  }
  if (on("devis")) {
    tool("lister_devis", "Devis émis (numéro, statut, validité, objet, total).",
      { statut: { type: "string" } });
  }
  if (on("formations")) {
    tool("catalogue_formations", "Catalogue des formations proposées (durée, modalité, prix, certification).", {});
  }
  if (on("agenda")) {
    tool("lister_sessions", "Sessions de formation planifiées (dates, lieu, modalité, formateur).",
      { periode: { type: "string", enum: ["a_venir", "passees", "toutes"] } });
  }
  if (on("documents")) {
    tool("rechercher_documents",
      "Recherche full-text dans la base documentaire interne (procédures, modèles, référentiels). À utiliser pour toute question de procédure ou de réglementation.",
      { recherche: { type: "string" } }, ["recherche"]);
  }
  if (ctx.isDirection && on("leads")) {
    tool("lister_leads", "Demandes de contact reçues via le site vitrine (leads entrants).", {});
  }
  if (ctx.isDirection && on("recrutement")) {
    tool("lister_candidats", "Candidats du module recrutement (statut, score).", {});
  }
  tool("statistiques",
    "Agrégats chiffrés calculés en base (fiables). Toujours préférer cet outil à un comptage manuel de listes.",
    { domaine: { type: "string", enum: ["pipeline", "contacts", "devis", "dossiers", "activite", "sessions"] } }, ["domaine"]);

  // ── Écritures : créent une PROPOSITION à valider par l'utilisateur ──
  if (on("contacts")) {
    tool("proposer_creation_action",
      "Propose de planifier une action/relance sur un contact (à valider par l'utilisateur).",
      {
        contact_id: { type: "string" }, date_action: { type: "string", description: "AAAA-MM-JJ" },
        heure_action: { type: "string", description: "HH:MM (optionnel)" },
        type: { type: "string", description: "Ex: appel, email, rdv, relance" },
        description: { type: "string" },
      }, ["contact_id", "date_action", "type", "description"]);
    tool("proposer_maj_statut_contact",
      "Propose de changer le statut prospect d'un contact (à valider).",
      { contact_id: { type: "string" }, statut_prospect: { type: "string" } }, ["contact_id", "statut_prospect"]);
    tool("proposer_note_contact",
      "Propose d'ajouter une note datée à la fiche d'un contact (à valider).",
      { contact_id: { type: "string" }, note: { type: "string" } }, ["contact_id", "note"]);
    tool("proposer_creation_contact",
      "Propose de créer un nouveau contact/prospect (à valider).",
      {
        nom: { type: "string" }, prenom: { type: "string" }, email: { type: "string" },
        telephone: { type: "string" }, ville: { type: "string" }, besoin_resume: { type: "string" },
      }, ["nom"]);
    tool("lister_pieces_jointes",
      "Fichiers joignables à un email : pièces des dossiers du contact (ou du dossier donné), coffre-fort du contact et espace documentaire. Renvoie pour chacun une `cle` à passer dans `pieces_jointes` de proposer_envoi_email.",
      {
        contact_id: { type: "string" }, dossier_id: { type: "string" },
        recherche: { type: "string", description: "Filtre sur le nom du fichier ou son origine (ex. « devis », « programme »)" },
      });
    tool("proposer_envoi_email",
      "Propose l'envoi d'un email (à valider ; rien ne part sans validation). Rédiger un corps complet et professionnel. Si le texte annonce un document (« ci-joint », « vous trouverez », devis, programme, convention…), appeler d'abord lister_pieces_jointes et joindre le fichier correspondant via `pieces_jointes` ; ne jamais annoncer une pièce qui n'est pas jointe.",
      {
        destinataire: { type: "string" }, sujet: { type: "string" },
        corps: { type: "string", description: "Corps du message en texte simple" },
        contact_id: { type: "string", description: "Contact lié, si applicable" },
        dossier_id: { type: "string", description: "Dossier lié, si applicable" },
        pieces_jointes: { type: "array", items: { type: "string" }, description: "Clés renvoyées par lister_pieces_jointes (ex. « piece:… », « coffre:… », « document:… »)" },
      }, ["destinataire", "sujet", "corps"]);
  }
  if (on("pipeline")) {
    tool("proposer_deplacement_opportunite",
      "Propose de déplacer une opportunité vers une autre étape du pipeline (à valider). Les colonnes sont configurables : utiliser une clé d'étape existante (vue via lister_pipeline), jamais une clé inventée.",
      { opportunite_id: { type: "string" }, etape: { type: "string", description: "Clé d'étape cible (ex. nouveau, qualifie, proposition, negociation, gagne, perdu, ou colonne personnalisée)" } },
      ["opportunite_id", "etape"]);
  }
  if (on("dossiers")) {
    tool("proposer_maj_statut_dossier",
      "Propose de changer le statut d'un dossier de financement (à valider).",
      // Les 9 valeurs de l'enum `dossier_statut` — `en_instruction` manquait.
      { dossier_id: { type: "string" }, statut: { type: "string", enum: ["brouillon", "montage", "depose", "en_instruction", "accorde", "refuse", "en_cours", "solde", "cloture"] } },
      ["dossier_id", "statut"]);
  }
  // Commercial, formation et documents : voir outils_metier.ts.
  definitionsMetier(ctx, tool);
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exécution des outils de LECTURE (client RLS — le périmètre est celui du user)
// ─────────────────────────────────────────────────────────────────────────────

export async function runReadTool(ctx: Ctx, name: string, a: Record<string, unknown>): Promise<unknown> {
  const { db, finances } = ctx;

  switch (name) {
    case "rechercher_contacts": {
      const limite = Math.min(Number(a.limite) || 25, 100);
      let q = db.from("contacts")
        .select("id, nom, prenom, email, telephone, ville, type, statut_prospect, formation_envisagee, besoin_resume, date_fixee")
        .order("updated_at", { ascending: false }).limit(limite);
      if (a.recherche) {
        const s = String(a.recherche).replaceAll(",", " ").trim();
        q = q.or(`nom.ilike.%${s}%,prenom.ilike.%${s}%,email.ilike.%${s}%,telephone.ilike.%${s}%`);
      }
      if (a.statut) q = q.eq("statut_prospect", String(a.statut));
      if (a.type) q = q.eq("type", String(a.type));
      if (a.ville) q = q.ilike("ville", `%${a.ville}%`);
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { total: data?.length ?? 0, contacts: data };
    }

    case "fiche_contact": {
      let contact: Record<string, unknown> | null = null;
      if (a.contact_id) {
        const { data } = await db.from("contacts").select("*").eq("id", String(a.contact_id)).maybeSingle();
        contact = data;
      } else if (a.email) {
        const { data } = await db.from("contacts").select("*").ilike("email", String(a.email)).limit(1).maybeSingle();
        contact = data;
      } else if (a.nom) {
        const { data } = await db.from("contacts").select("*").ilike("nom", `%${a.nom}%`).limit(1).maybeSingle();
        contact = data;
      }
      if (!contact) return { erreur: "Contact introuvable (ou hors de votre périmètre)." };
      if (!finances) { delete contact.financement_envisage; delete contact.assiette_commission; }
      delete contact.unsubscribe_token;
      const id = contact.id as string;
      const [{ data: actions }, { data: opps }, { data: dossiers }] = await Promise.all([
        db.from("contact_actions").select("date_action, heure_action, type, description, faite").eq("contact_id", id).order("date_action", { ascending: false }).limit(20),
        db.from("opportunites").select("id, titre, stage, montant, probabilite, date_cloture_prev").eq("contact_id", id),
        db.from("dossiers").select("id, reference, intitule, statut, montant_demande, montant_accorde").eq("contact_id", id),
      ]);
      if (!finances) {
        for (const o of opps ?? []) delete (o as Record<string, unknown>).montant;
        for (const x of dossiers ?? []) { const r = x as Record<string, unknown>; delete r.montant_demande; delete r.montant_accorde; }
      }
      return { contact, dernieres_actions: actions ?? [], opportunites: opps ?? [], dossiers: dossiers ?? [] };
    }

    case "lister_actions_a_faire": {
      let q = db.from("contact_actions")
        .select("id, contact_id, date_action, heure_action, type, description, contacts(nom, prenom)")
        .eq("faite", false).order("date_action", { ascending: true }).limit(100);
      if (a.contact_id) q = q.eq("contact_id", String(a.contact_id));
      if (a.en_retard) q = q.lt("date_action", new Date().toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { total: data?.length ?? 0, actions: data };
    }

    case "rechercher_entreprises": {
      let q = db.from("entreprises")
        .select("id, raison_sociale, siret, secteur, effectif, ville, statut_juridique, idcc").limit(50);
      if (a.recherche) {
        const s = String(a.recherche).replaceAll(",", " ").trim();
        q = q.or(`raison_sociale.ilike.%${s}%,siret.ilike.%${s}%,ville.ilike.%${s}%,secteur.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { total: data?.length ?? 0, entreprises: data };
    }

    case "lister_pipeline": {
      let q = db.from("opportunites")
        .select("id, titre, stage, montant, probabilite, date_cloture_prev, contact_id, contacts(nom, prenom)")
        .order("created_at", { ascending: false }).limit(200);
      if (a.etape) q = q.eq("stage", String(a.etape));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      const rows = (data ?? []).map((o) => { const r = { ...o } as Record<string, unknown>; if (!finances) delete r.montant; return r; });
      return { total: rows.length, opportunites: rows };
    }

    case "lister_dossiers": {
      let q = db.from("dossiers")
        .select("id, reference, intitule, statut, montant_demande, montant_accorde, date_depot, date_debut, date_fin, contact_id")
        .order("updated_at", { ascending: false }).limit(200);
      if (a.statut) q = q.eq("statut", String(a.statut));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      const rows = (data ?? []).map((x) => { const r = { ...x } as Record<string, unknown>; if (!finances) { delete r.montant_demande; delete r.montant_accorde; } return r; });
      return { total: rows.length, dossiers: rows };
    }

    case "fiche_dossier": {
      let dossier: Record<string, unknown> | null = null;
      if (a.dossier_id) {
        const { data } = await db.from("dossiers").select("*").eq("id", String(a.dossier_id)).maybeSingle();
        dossier = data;
      } else if (a.reference) {
        const { data } = await db.from("dossiers").select("*").ilike("reference", `%${a.reference}%`).limit(1).maybeSingle();
        dossier = data;
      }
      if (!dossier) return { erreur: "Dossier introuvable (ou hors de votre périmètre)." };
      if (!finances) { delete dossier.montant_demande; delete dossier.montant_accorde; }
      // `dossier_pieces` n'a pas de colonne `date_reception` : la sélectionner
      // faisait échouer la requête, l'erreur était ignorée et la liste des
      // pièces remontait donc toujours vide. La date utile est `updated_at`
      // (dernier changement de statut : manquante, recue, validee, rejetee).
      const { data: pieces, error: pErr } = await db.from("dossier_pieces")
        .select("libelle, statut, obligatoire, commentaire, updated_at").eq("dossier_id", dossier.id as string);
      if (pErr) return { dossier, pieces: [], erreur_pieces: pErr.message };
      return { dossier, pieces: pieces ?? [] };
    }

    case "lister_devis": {
      let q = db.from("devis")
        .select("id, numero, statut, date_emission, date_validite, objet, total_ttc, contact_id")
        .order("date_emission", { ascending: false }).limit(100);
      if (a.statut) q = q.eq("statut", String(a.statut));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      const rows = (data ?? []).map((x) => { const r = { ...x } as Record<string, unknown>; if (!finances) delete r.total_ttc; return r; });
      return { total: rows.length, devis: rows };
    }

    case "catalogue_formations": {
      const { data } = await db.from("formations")
        .select("id, intitule, reference, duree_heures, modalite, prix, certifiante, code_certification, actif").limit(100);
      const rows = (data ?? []).map((x) => { const r = { ...x } as Record<string, unknown>; if (!finances) delete r.prix; return r; });
      return { formations: rows };
    }

    case "lister_sessions": {
      const today = new Date().toISOString().slice(0, 10);
      let q = db.from("sessions_formation")
        .select("id, titre, date_debut, date_fin, lieu, modalite, formateur")
        .order("date_debut", { ascending: true }).limit(100);
      if (a.periode === "a_venir" || !a.periode) q = q.gte("date_debut", today);
      if (a.periode === "passees") q = q.lt("date_debut", today);
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { sessions: data ?? [] };
    }

    case "rechercher_documents": {
      const flag = ctx.isDirection ? "chat_direction" : "chat_conseiller";
      const s = String(a.recherche ?? "").trim();
      // Full-text français + repli ilike sur le titre.
      const [fts, byTitle] = await Promise.all([
        db.from("documents").select("id, titre, categorie, description, contenu_texte, fichier_url")
          .eq(flag, true).textSearch("contenu_texte", s, { type: "websearch", config: "french" }).limit(6),
        db.from("documents").select("id, titre, categorie, description, contenu_texte, fichier_url")
          .eq(flag, true).ilike("titre", `%${s}%`).limit(4),
      ]);
      const seen = new Set<string>();
      const docs = [...(fts.data ?? []), ...(byTitle.data ?? [])].filter((x) => {
        if (seen.has(x.id)) return false; seen.add(x.id); return true;
      });
      for (const x of docs) ctx.sources.push({ label: x.titre, url: x.fichier_url ?? null });
      return {
        documents: docs.map((x) => ({
          titre: x.titre, categorie: x.categorie, description: x.description,
          extrait: String(x.contenu_texte ?? "").slice(0, 4000),
        })),
      };
    }

    case "lister_leads": {
      const { data } = await db.from("contact_requests")
        .select("id, first_name, last_name, email, phone, request_type, status, source, created_at, contact_id")
        .order("created_at", { ascending: false }).limit(50);
      return { leads: data ?? [] };
    }

    case "lister_candidats": {
      const { data } = await db.from("candidats")
        .select("id, nom, prenom, statut, score_total, created_at")
        .order("created_at", { ascending: false }).limit(100);
      return { candidats: data ?? [] };
    }

    case "lister_pieces_jointes": {
      const pieces = await listerPiecesJointes(db, {
        contact_id: a.contact_id ? String(a.contact_id) : undefined,
        dossier_id: a.dossier_id ? String(a.dossier_id) : undefined,
        recherche: a.recherche ? String(a.recherche) : undefined,
      });
      return { total: pieces.length, pieces_jointes: pieces };
    }

    case "statistiques": {
      switch (String(a.domaine)) {
        case "pipeline": {
          const { data } = await db.from("opportunites").select("stage, montant, probabilite").limit(1000);
          const byStage: Record<string, { nombre: number; montant_total: number }> = {};
          for (const o of data ?? []) {
            const s = byStage[o.stage] ?? (byStage[o.stage] = { nombre: 0, montant_total: 0 });
            s.nombre++; s.montant_total += Number(o.montant ?? 0);
          }
          if (!finances) for (const k of Object.keys(byStage)) delete (byStage[k] as Record<string, unknown>).montant_total;
          const actives = (data ?? []).filter((o) => !["gagne", "perdu"].includes(o.stage));
          const pondere = actives.reduce((t, o) => t + Number(o.montant ?? 0) * Number(o.probabilite ?? 0) / 100, 0);
          return { par_etape: byStage, opportunites_actives: actives.length, ...(finances ? { ca_pondere: Math.round(pondere) } : {}) };
        }
        case "contacts": {
          const { data } = await db.from("contacts").select("statut_prospect, type").limit(3000);
          const parStatut: Record<string, number> = {}; const parType: Record<string, number> = {};
          for (const c of data ?? []) {
            parStatut[c.statut_prospect ?? "(sans statut)"] = (parStatut[c.statut_prospect ?? "(sans statut)"] ?? 0) + 1;
            parType[c.type] = (parType[c.type] ?? 0) + 1;
          }
          return { total: data?.length ?? 0, par_statut: parStatut, par_type: parType };
        }
        case "devis": {
          const { data } = await db.from("devis").select("statut, total_ttc, date_validite").limit(500);
          const par: Record<string, { nombre: number; total_ttc: number }> = {};
          const today = new Date().toISOString().slice(0, 10);
          let expirent = 0;
          for (const v of data ?? []) {
            const s = par[v.statut] ?? (par[v.statut] = { nombre: 0, total_ttc: 0 });
            s.nombre++; s.total_ttc += Number(v.total_ttc ?? 0);
            if (v.statut === "envoye" && v.date_validite && v.date_validite < today) expirent++;
          }
          if (!finances) for (const k of Object.keys(par)) delete (par[k] as Record<string, unknown>).total_ttc;
          return { par_statut: par, envoyes_expires: expirent };
        }
        case "dossiers": {
          const { data } = await db.from("dossiers").select("statut, montant_demande, montant_accorde").limit(500);
          const par: Record<string, { nombre: number; demande: number; accorde: number }> = {};
          for (const x of data ?? []) {
            const s = par[x.statut] ?? (par[x.statut] = { nombre: 0, demande: 0, accorde: 0 });
            s.nombre++; s.demande += Number(x.montant_demande ?? 0); s.accorde += Number(x.montant_accorde ?? 0);
          }
          if (!finances) for (const k of Object.keys(par)) { const r = par[k] as Record<string, unknown>; delete r.demande; delete r.accorde; }
          return { par_statut: par };
        }
        case "activite": {
          const today = new Date().toISOString().slice(0, 10);
          const [{ count: aFaire }, { count: enRetard }] = await Promise.all([
            db.from("contact_actions").select("id", { count: "exact", head: true }).eq("faite", false),
            db.from("contact_actions").select("id", { count: "exact", head: true }).eq("faite", false).lt("date_action", today),
          ]);
          return { actions_a_faire: aFaire ?? 0, actions_en_retard: enRetard ?? 0 };
        }
        case "sessions": {
          const today = new Date().toISOString().slice(0, 10);
          const [{ count: aVenir }, { count: total }] = await Promise.all([
            db.from("sessions_formation").select("id", { count: "exact", head: true }).gte("date_debut", today),
            db.from("sessions_formation").select("id", { count: "exact", head: true }),
          ]);
          return { sessions_a_venir: aVenir ?? 0, sessions_total: total ?? 0 };
        }
        default: return { erreur: "Domaine de statistiques inconnu." };
      }
    }

    default:
      return (await lireMetier(ctx, name, a)) ?? { erreur: `Outil inconnu : ${name}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outils d'ÉCRITURE : création d'une proposition (jamais d'exécution directe)
// ─────────────────────────────────────────────────────────────────────────────

async function contactLabel(db: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await db.from("contacts").select("nom, prenom").eq("id", id).maybeSingle();
  return data ? `${data.prenom ?? ""} ${data.nom}`.trim() : null;
}

async function buildProposalDescription(ctx: Ctx, name: string, a: Record<string, unknown>): Promise<string | { erreur: string }> {
  const { db } = ctx;
  const needContact = async (): Promise<string | { erreur: string }> => {
    const label = await contactLabel(db, String(a.contact_id));
    return label ?? { erreur: "Contact introuvable (ou hors périmètre) : action impossible." };
  };
  switch (name) {
    case "proposer_creation_action": {
      const who = await needContact(); if (typeof who !== "string") return who;
      return `Planifier « ${a.type} » pour ${who} le ${a.date_action}${a.heure_action ? ` à ${a.heure_action}` : ""} — ${a.description}`;
    }
    case "proposer_maj_statut_contact": {
      const who = await needContact(); if (typeof who !== "string") return who;
      return `Passer ${who} au statut « ${a.statut_prospect} »`;
    }
    case "proposer_note_contact": {
      const who = await needContact(); if (typeof who !== "string") return who;
      return `Ajouter une note à la fiche de ${who} : « ${String(a.note).slice(0, 160)}${String(a.note).length > 160 ? "…" : ""} »`;
    }
    case "proposer_creation_contact":
      return `Créer le contact ${[a.prenom, a.nom].filter(Boolean).join(" ")}${a.email ? ` <${a.email}>` : ""}`;
    case "proposer_envoi_email": {
      const pj = Array.isArray(a.pieces_jointes) ? a.pieces_jointes.length : 0;
      return `Envoyer un email à ${a.destinataire} — objet : « ${a.sujet} »${pj ? ` (${pj} pièce${pj > 1 ? "s" : ""} jointe${pj > 1 ? "s" : ""})` : ""}`;
    }
    case "proposer_deplacement_opportunite": {
      const { data } = await ctx.db.from("opportunites").select("titre").eq("id", String(a.opportunite_id)).maybeSingle();
      if (!data) return { erreur: "Opportunité introuvable (ou hors périmètre)." };
      return `Déplacer l'opportunité « ${data.titre} » vers l'étape « ${a.etape} »`;
    }
    case "proposer_maj_statut_dossier": {
      const { data } = await ctx.db.from("dossiers").select("reference, intitule").eq("id", String(a.dossier_id)).maybeSingle();
      if (!data) return { erreur: "Dossier introuvable (ou hors périmètre)." };
      return `Passer le dossier ${data.reference} (${data.intitule}) au statut « ${a.statut} »`;
    }
    default: return (await decrireMetier(ctx, name, a)) ?? { erreur: `Proposition inconnue : ${name}` };
  }
}

export async function runWriteProposal(ctx: Ctx, name: string, a: Record<string, unknown>): Promise<unknown> {
  // Garde-fou : une étape cible doit exister dans la config du pipeline.
  if (name === "proposer_deplacement_opportunite") {
    const { data: pRow } = await ctx.db.from("parametres").select("valeur").eq("cle", "pipeline").maybeSingle();
    const colonnes = ((pRow?.valeur as { colonnes?: { cle: string }[] } | null)?.colonnes ?? []).map((c) => c.cle);
    const defaut = ["nouveau", "qualifie", "proposition", "negociation", "gagne", "perdu"];
    const valides = colonnes.length ? colonnes : defaut;
    if (!valides.includes(String(a.etape))) {
      return { erreur: `Étape inconnue « ${a.etape} ». Étapes valides : ${valides.join(", ")}.` };
    }
  }
  // Pièces jointes : les clés de l'IA sont relues (RLS) et rangées avec leur
  // nom, pour que la carte de validation les affiche et permette de les retirer.
  if (name === "proposer_envoi_email" && a.pieces_jointes !== undefined) {
    const { pieces, rejetees } = await decrirePiecesJointes(ctx.db, a.pieces_jointes);
    if (rejetees.length) {
      return { erreur: `Pièce(s) jointe(s) inconnue(s) : ${rejetees.join(", ")}. Utiliser une clé renvoyée par lister_pieces_jointes.` };
    }
    a = { ...a, pieces_jointes: pieces };
  }
  const desc = await buildProposalDescription(ctx, name, a);
  if (typeof desc !== "string") return desc;
  const { data, error } = await ctx.db.from("ai_actions").insert({
    conversation_id: ctx.conversationId,
    user_id: ctx.user.id,
    outil: name,
    args: a,
    description: desc,
  }).select("id, outil, description, args, statut").single();
  if (error) return { erreur: error.message };
  ctx.emit("action", data);
  return {
    proposition_creee: true, action_id: data.id, description: desc,
    note: "Cette action est en ATTENTE DE VALIDATION par l'utilisateur (carte affichée dans le chat). Ne pas la considérer comme exécutée. Ne pas re-proposer la même action.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Droits de l'utilisateur : rôle (profiles) + réglages `Paramètres > Chatbot`
// ─────────────────────────────────────────────────────────────────────────────

export type Profil = {
  isDirection: boolean;
  droits: Droits;
  finances: boolean;           // droit de voir les montants
  /** Réglages `chatbot` bruts (prompts maîtres…). */
  chatbot: Record<string, unknown>;
};

export const estDirection = (role: string | null | undefined) => role === "admin" || role === "directeur_commercial";

/**
 * `admin` : client service — `profiles` et `parametres` seulement, jamais la
 * donnée métier. Les droits par rôle filtrent le catalogue ; la RLS reste le
 * vrai périmètre des données.
 */
export async function chargerDroits(admin: SupabaseClient, userId: string): Promise<Profil> {
  const [{ data: profile }, { data: cbRow }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin.from("parametres").select("valeur").eq("cle", "chatbot").maybeSingle(),
  ]);
  const isDirection = estDirection((profile?.role as string) ?? "conseiller");
  const chatbot = (cbRow?.valeur ?? {}) as Record<string, unknown>;
  const allDroits = (chatbot.droits ?? {}) as Record<string, Droits>;
  const droits: Droits = isDirection ? (allDroits.direction ?? {}) : (allDroits.conseiller ?? {});
  const finances = isDirection ? (droits.finances !== false) : (droits.finances === true);
  return { isDirection, droits, finances, chatbot };
}

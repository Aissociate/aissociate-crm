#!/usr/bin/env node
/**
 * Serveur MCP local — accès au CRM AIssociate depuis Claude Code.
 *
 * Il expose le même catalogue d'outils que l'assistant interne (Edge Function
 * `agent`) : lectures métier, et écritures sous forme de PROPOSITIONS à valider
 * dans le CRM. Rien n'est jamais écrit directement en base.
 *
 * Sécurité — le serveur se connecte avec le compte CRM de l'utilisateur
 * (email + mot de passe, via la clé anonyme publique) : toutes les requêtes
 * passent donc par la RLS, avec exactement le périmètre et les droits de ce
 * compte. La clé de service n'est jamais utilisée ici.
 *
 * Démarrage : node mcp/crm-server.mjs   (voir mcp/README.md)
 */
import { createClient } from '@supabase/supabase-js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.CRM_SUPABASE_URL || 'https://vkirutbpxzybucuiyjnb.supabase.co';
const SUPABASE_ANON_KEY = process.env.CRM_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZraXJ1dGJweHp5YnVjdWl5am5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzE4MTYsImV4cCI6MjA5NTY0NzgxNn0.AHMDxQdgBD3fMhnsTLMI-i7b-zymC33vbL4BXay_w-M';
const CRM_EMAIL = process.env.CRM_EMAIL;
const CRM_PASSWORD = process.env.CRM_PASSWORD;

// Sortie de diagnostic : stderr uniquement. stdout porte le protocole MCP,
// un console.log y casserait la connexion.
const log = (...a) => console.error('[crm-mcp]', ...a);

if (!CRM_EMAIL || !CRM_PASSWORD) {
  log('CRM_EMAIL et CRM_PASSWORD sont requis (voir mcp/README.md).');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: true },
});

// Contexte de session, rempli au démarrage.
const ctx = {
  userId: null,
  isDirection: false,
  finances: false,
  droits: {},
  conversationId: null, // créée à la première proposition
};

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue d'outils (aligné sur supabase/functions/agent/index.ts)
// ─────────────────────────────────────────────────────────────────────────────

const S = (description) => ({ type: 'string', description });

function buildTools() {
  const t = [];
  const on = (k) => ctx.droits[k] !== false;
  const tool = (name, description, properties = {}, required = []) =>
    t.push({ name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false } });

  if (on('contacts')) {
    tool('rechercher_contacts',
      'Recherche des contacts (prospects, apprenants…). Retourne une liste compacte. Utiliser fiche_contact pour le détail.',
      {
        recherche: S('Texte cherché dans nom, prénom, email, téléphone'),
        statut: S("Filtre exact sur statut_prospect (ex: 'nouveau', 'non assigné')"),
        type: { type: 'string', enum: ['prospect', 'contact', 'apprenant', 'contact_entreprise', 'contact_financeur', 'formateur', 'encadrement'] },
        ville: { type: 'string' },
        limite: { type: 'number', description: 'Max résultats (défaut 25, max 100)' },
      });
    tool('fiche_contact',
      'Fiche complète d’un contact : coordonnées, suivi commercial, dernières actions, opportunités et dossiers liés.',
      { contact_id: { type: 'string' }, email: { type: 'string' }, nom: S('Recherche par nom si l’id est inconnu') });
    tool('lister_actions_a_faire',
      'Actions/relances planifiées non faites (tâches). Peut filtrer sur un contact ou sur le retard.',
      { contact_id: { type: 'string' }, en_retard: { type: 'boolean', description: 'true = uniquement les actions dont la date est passée' } });
  }
  if (on('entreprises')) {
    tool('rechercher_entreprises', 'Recherche des entreprises (raison sociale, SIRET, ville, secteur).',
      { recherche: { type: 'string' } });
  }
  if (on('pipeline')) {
    tool('lister_pipeline', 'Opportunités commerciales du pipeline, avec étape, probabilité et échéance.',
      { etape: S('Clé d’étape (colonne du pipeline, configurable) : nouveau, qualifie, proposition, negociation, gagne, perdu, ou une colonne personnalisée') });
  }
  if (on('dossiers')) {
    tool('lister_dossiers', 'Dossiers de financement (référence, intitulé, statut, montants).',
      { statut: { type: 'string', enum: ['brouillon', 'montage', 'depose', 'en_instruction', 'accorde', 'refuse', 'en_cours', 'solde', 'cloture'] } });
    tool('fiche_dossier', 'Détail d’un dossier : pièces justificatives et leur statut, dates, montants.',
      { dossier_id: { type: 'string' }, reference: { type: 'string' } });
  }
  if (on('devis')) {
    tool('lister_devis', 'Devis émis (numéro, statut, validité, objet, total).', { statut: { type: 'string' } });
  }
  if (on('formations')) {
    tool('catalogue_formations', 'Catalogue des formations proposées (durée, modalité, prix, certification).', {});
  }
  if (on('agenda')) {
    tool('lister_sessions', 'Sessions de formation planifiées (dates, lieu, modalité, formateur).',
      { periode: { type: 'string', enum: ['a_venir', 'passees', 'toutes'] } });
  }
  if (on('documents')) {
    tool('rechercher_documents',
      'Recherche full-text dans la base documentaire interne (procédures, modèles, référentiels). À utiliser pour toute question de procédure ou de réglementation.',
      { recherche: { type: 'string' } }, ['recherche']);
  }
  if (ctx.isDirection && on('leads')) {
    tool('lister_leads', 'Demandes de contact reçues via le site vitrine (leads entrants).', {});
  }
  if (ctx.isDirection && on('recrutement')) {
    tool('lister_candidats', 'Candidats du module recrutement (statut, score).', {});
  }
  tool('statistiques',
    'Agrégats chiffrés calculés en base (fiables). Toujours préférer cet outil à un comptage manuel de listes.',
    { domaine: { type: 'string', enum: ['pipeline', 'contacts', 'devis', 'dossiers', 'activite', 'sessions'] } }, ['domaine']);

  // ── Écritures : créent une PROPOSITION à valider dans le CRM ──
  const VALIDATION = ' La proposition apparaît dans le CRM (Assistant > historique de conversation) où l’utilisateur la valide ou l’annule. Rien n’est écrit en base avant validation, et une proposition non traitée expire au bout de 24 h.';
  if (on('contacts')) {
    tool('proposer_creation_action',
      'Propose de planifier une action/relance sur un contact.' + VALIDATION,
      {
        contact_id: { type: 'string' }, date_action: S('AAAA-MM-JJ'),
        heure_action: S('HH:MM (optionnel)'),
        type: S('Ex: appel, email, rdv, relance'),
        description: { type: 'string' },
      }, ['contact_id', 'date_action', 'type', 'description']);
    tool('proposer_maj_statut_contact',
      'Propose de changer le statut prospect d’un contact.' + VALIDATION,
      { contact_id: { type: 'string' }, statut_prospect: { type: 'string' } }, ['contact_id', 'statut_prospect']);
    tool('proposer_note_contact',
      'Propose d’ajouter une note datée à la fiche d’un contact.' + VALIDATION,
      { contact_id: { type: 'string' }, note: { type: 'string' } }, ['contact_id', 'note']);
    tool('proposer_creation_contact',
      'Propose de créer un nouveau contact/prospect.' + VALIDATION,
      {
        nom: { type: 'string' }, prenom: { type: 'string' }, email: { type: 'string' },
        telephone: { type: 'string' }, ville: { type: 'string' }, besoin_resume: { type: 'string' },
      }, ['nom']);
    tool('proposer_envoi_email',
      'Propose l’envoi d’un email (rien ne part sans validation). Rédiger un corps complet et professionnel.' + VALIDATION,
      {
        destinataire: { type: 'string' }, sujet: { type: 'string' },
        corps: S('Corps du message en texte simple'),
        contact_id: S('Contact lié, si applicable'),
      }, ['destinataire', 'sujet', 'corps']);
  }
  if (on('pipeline')) {
    tool('proposer_deplacement_opportunite',
      'Propose de déplacer une opportunité vers une autre étape du pipeline. Les colonnes sont configurables : utiliser une clé d’étape existante (vue via lister_pipeline), jamais une clé inventée.' + VALIDATION,
      { opportunite_id: { type: 'string' }, etape: S('Clé d’étape cible') }, ['opportunite_id', 'etape']);
  }
  if (on('dossiers')) {
    tool('proposer_maj_statut_dossier',
      'Propose de changer le statut d’un dossier de financement.' + VALIDATION,
      // Les 9 valeurs de l'enum `dossier_statut` — `en_instruction` manque dans
      // l'Edge Function `agent`, qui ne peut donc pas proposer ce statut.
      { dossier_id: { type: 'string' }, statut: { type: 'string', enum: ['brouillon', 'montage', 'depose', 'en_instruction', 'accorde', 'refuse', 'en_cours', 'solde', 'cloture'] } },
      ['dossier_id', 'statut']);
  }

  tool('lister_propositions',
    'Propositions d’écriture récentes et leur statut (proposee, executee, annulee, expiree, erreur). Permet de savoir ce que l’utilisateur a validé.',
    { statut: { type: 'string', enum: ['proposee', 'executee', 'annulee', 'expiree', 'erreur'] } });

  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Outils de LECTURE (client RLS — le périmètre est celui du compte connecté)
// ─────────────────────────────────────────────────────────────────────────────

async function runReadTool(name, a) {
  const { finances } = ctx;

  switch (name) {
    case 'rechercher_contacts': {
      const limite = Math.min(Number(a.limite) || 25, 100);
      let q = db.from('contacts')
        .select('id, nom, prenom, email, telephone, ville, type, statut_prospect, formation_envisagee, besoin_resume, date_fixee')
        .order('updated_at', { ascending: false }).limit(limite);
      if (a.recherche) {
        const s = String(a.recherche).replaceAll(',', ' ').trim();
        q = q.or(`nom.ilike.%${s}%,prenom.ilike.%${s}%,email.ilike.%${s}%,telephone.ilike.%${s}%`);
      }
      if (a.statut) q = q.eq('statut_prospect', String(a.statut));
      if (a.type) q = q.eq('type', String(a.type));
      if (a.ville) q = q.ilike('ville', `%${a.ville}%`);
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { total: data?.length ?? 0, contacts: data };
    }

    case 'fiche_contact': {
      let contact = null;
      if (a.contact_id) {
        ({ data: contact } = await db.from('contacts').select('*').eq('id', String(a.contact_id)).maybeSingle());
      } else if (a.email) {
        ({ data: contact } = await db.from('contacts').select('*').ilike('email', String(a.email)).limit(1).maybeSingle());
      } else if (a.nom) {
        ({ data: contact } = await db.from('contacts').select('*').ilike('nom', `%${a.nom}%`).limit(1).maybeSingle());
      }
      if (!contact) return { erreur: 'Contact introuvable (ou hors de votre périmètre).' };
      if (!finances) { delete contact.financement_envisage; delete contact.assiette_commission; }
      delete contact.unsubscribe_token;
      const id = contact.id;
      const [{ data: actions }, { data: opps }, { data: dossiers }] = await Promise.all([
        db.from('contact_actions').select('date_action, heure_action, type, description, faite').eq('contact_id', id).order('date_action', { ascending: false }).limit(20),
        db.from('opportunites').select('id, titre, stage, montant, probabilite, date_cloture_prev').eq('contact_id', id),
        db.from('dossiers').select('id, reference, intitule, statut, montant_demande, montant_accorde').eq('contact_id', id),
      ]);
      if (!finances) {
        for (const o of opps ?? []) delete o.montant;
        for (const x of dossiers ?? []) { delete x.montant_demande; delete x.montant_accorde; }
      }
      return { contact, dernieres_actions: actions ?? [], opportunites: opps ?? [], dossiers: dossiers ?? [] };
    }

    case 'lister_actions_a_faire': {
      let q = db.from('contact_actions')
        .select('id, contact_id, date_action, heure_action, type, description, contacts(nom, prenom)')
        .eq('faite', false).order('date_action', { ascending: true }).limit(100);
      if (a.contact_id) q = q.eq('contact_id', String(a.contact_id));
      if (a.en_retard) q = q.lt('date_action', new Date().toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { total: data?.length ?? 0, actions: data };
    }

    case 'rechercher_entreprises': {
      let q = db.from('entreprises')
        .select('id, raison_sociale, siret, secteur, effectif, ville, statut_juridique, idcc').limit(50);
      if (a.recherche) {
        const s = String(a.recherche).replaceAll(',', ' ').trim();
        q = q.or(`raison_sociale.ilike.%${s}%,siret.ilike.%${s}%,ville.ilike.%${s}%,secteur.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { total: data?.length ?? 0, entreprises: data };
    }

    case 'lister_pipeline': {
      let q = db.from('opportunites')
        .select('id, titre, stage, montant, probabilite, date_cloture_prev, contact_id, contacts(nom, prenom)')
        .order('created_at', { ascending: false }).limit(200);
      if (a.etape) q = q.eq('stage', String(a.etape));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      const rows = (data ?? []).map((o) => { const r = { ...o }; if (!finances) delete r.montant; return r; });
      return { total: rows.length, opportunites: rows };
    }

    case 'lister_dossiers': {
      let q = db.from('dossiers')
        .select('id, reference, intitule, statut, montant_demande, montant_accorde, date_depot, date_debut, date_fin, contact_id')
        .order('updated_at', { ascending: false }).limit(200);
      if (a.statut) q = q.eq('statut', String(a.statut));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      const rows = (data ?? []).map((x) => { const r = { ...x }; if (!finances) { delete r.montant_demande; delete r.montant_accorde; } return r; });
      return { total: rows.length, dossiers: rows };
    }

    case 'fiche_dossier': {
      let dossier = null;
      if (a.dossier_id) {
        ({ data: dossier } = await db.from('dossiers').select('*').eq('id', String(a.dossier_id)).maybeSingle());
      } else if (a.reference) {
        ({ data: dossier } = await db.from('dossiers').select('*').ilike('reference', `%${a.reference}%`).limit(1).maybeSingle());
      }
      if (!dossier) return { erreur: 'Dossier introuvable (ou hors de votre périmètre).' };
      if (!finances) { delete dossier.montant_demande; delete dossier.montant_accorde; }
      // `dossier_pieces` n'a pas de colonne `date_reception` (contrairement à ce
      // que sélectionne l'Edge Function `agent`, qui remonte donc toujours une
      // liste vide) : la date utile est `updated_at`, du dernier changement de
      // statut. Statuts possibles : manquante, recue, validee, rejetee.
      const { data: pieces, error: pErr } = await db.from('dossier_pieces')
        .select('libelle, statut, obligatoire, commentaire, updated_at').eq('dossier_id', dossier.id);
      if (pErr) return { dossier, pieces: [], erreur_pieces: pErr.message };
      return { dossier, pieces: pieces ?? [] };
    }

    case 'lister_devis': {
      let q = db.from('devis')
        .select('id, numero, statut, date_emission, date_validite, objet, total_ttc, contact_id')
        .order('date_emission', { ascending: false }).limit(100);
      if (a.statut) q = q.eq('statut', String(a.statut));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      const rows = (data ?? []).map((x) => { const r = { ...x }; if (!finances) delete r.total_ttc; return r; });
      return { total: rows.length, devis: rows };
    }

    case 'catalogue_formations': {
      const { data } = await db.from('formations')
        .select('id, intitule, reference, duree_heures, modalite, prix, certifiante, code_certification, actif').limit(100);
      const rows = (data ?? []).map((x) => { const r = { ...x }; if (!finances) delete r.prix; return r; });
      return { formations: rows };
    }

    case 'lister_sessions': {
      const today = new Date().toISOString().slice(0, 10);
      let q = db.from('sessions_formation')
        .select('id, titre, date_debut, date_fin, lieu, modalite, formateur')
        .order('date_debut', { ascending: true }).limit(100);
      if (a.periode === 'a_venir' || !a.periode) q = q.gte('date_debut', today);
      if (a.periode === 'passees') q = q.lt('date_debut', today);
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { sessions: data ?? [] };
    }

    case 'rechercher_documents': {
      const flag = ctx.isDirection ? 'chat_direction' : 'chat_conseiller';
      const s = String(a.recherche ?? '').trim();
      const cols = 'id, titre, categorie, description, contenu_texte, fichier_url';
      // Full-text français + repli ilike sur le titre.
      const [fts, byTitle] = await Promise.all([
        db.from('documents').select(cols).eq(flag, true).textSearch('contenu_texte', s, { type: 'websearch', config: 'french' }).limit(6),
        db.from('documents').select(cols).eq(flag, true).ilike('titre', `%${s}%`).limit(4),
      ]);
      const seen = new Set();
      const docs = [...(fts.data ?? []), ...(byTitle.data ?? [])].filter((x) => {
        if (seen.has(x.id)) return false; seen.add(x.id); return true;
      });
      return {
        documents: docs.map((x) => ({
          titre: x.titre, categorie: x.categorie, description: x.description,
          fichier_url: x.fichier_url ?? null,
          extrait: String(x.contenu_texte ?? '').slice(0, 4000),
        })),
      };
    }

    case 'lister_leads': {
      const { data } = await db.from('contact_requests')
        .select('first_name, last_name, email, phone, request_type, status, source, created_at')
        .order('created_at', { ascending: false }).limit(50);
      return { leads: data ?? [] };
    }

    case 'lister_candidats': {
      const { data } = await db.from('candidats')
        .select('id, nom, prenom, statut, score_total, created_at')
        .order('created_at', { ascending: false }).limit(100);
      return { candidats: data ?? [] };
    }

    case 'lister_propositions': {
      let q = db.from('ai_actions')
        .select('id, outil, description, statut, created_at, executed_at, resultat')
        .order('created_at', { ascending: false }).limit(50);
      if (a.statut) q = q.eq('statut', String(a.statut));
      const { data, error } = await q;
      if (error) return { erreur: error.message };
      return { total: data?.length ?? 0, propositions: data };
    }

    case 'statistiques':
      return runStats(String(a.domaine));

    default:
      return { erreur: `Outil inconnu : ${name}` };
  }
}

async function runStats(domaine) {
  const { finances } = ctx;
  const today = new Date().toISOString().slice(0, 10);

  switch (domaine) {
    case 'pipeline': {
      const { data } = await db.from('opportunites').select('stage, montant, probabilite').limit(1000);
      const byStage = {};
      for (const o of data ?? []) {
        const s = byStage[o.stage] ?? (byStage[o.stage] = { nombre: 0, montant_total: 0 });
        s.nombre++; s.montant_total += Number(o.montant ?? 0);
      }
      if (!finances) for (const k of Object.keys(byStage)) delete byStage[k].montant_total;
      const actives = (data ?? []).filter((o) => !['gagne', 'perdu'].includes(o.stage));
      const pondere = actives.reduce((t, o) => t + Number(o.montant ?? 0) * Number(o.probabilite ?? 0) / 100, 0);
      return { par_etape: byStage, opportunites_actives: actives.length, ...(finances ? { ca_pondere: Math.round(pondere) } : {}) };
    }
    case 'contacts': {
      const { data } = await db.from('contacts').select('statut_prospect, type').limit(3000);
      const parStatut = {}; const parType = {};
      for (const c of data ?? []) {
        const k = c.statut_prospect ?? '(sans statut)';
        parStatut[k] = (parStatut[k] ?? 0) + 1;
        parType[c.type] = (parType[c.type] ?? 0) + 1;
      }
      return { total: data?.length ?? 0, par_statut: parStatut, par_type: parType };
    }
    case 'devis': {
      const { data } = await db.from('devis').select('statut, total_ttc, date_validite').limit(500);
      const par = {}; let expirent = 0;
      for (const v of data ?? []) {
        const s = par[v.statut] ?? (par[v.statut] = { nombre: 0, total_ttc: 0 });
        s.nombre++; s.total_ttc += Number(v.total_ttc ?? 0);
        if (v.statut === 'envoye' && v.date_validite && v.date_validite < today) expirent++;
      }
      if (!finances) for (const k of Object.keys(par)) delete par[k].total_ttc;
      return { par_statut: par, envoyes_expires: expirent };
    }
    case 'dossiers': {
      const { data } = await db.from('dossiers').select('statut, montant_demande, montant_accorde').limit(500);
      const par = {};
      for (const x of data ?? []) {
        const s = par[x.statut] ?? (par[x.statut] = { nombre: 0, demande: 0, accorde: 0 });
        s.nombre++; s.demande += Number(x.montant_demande ?? 0); s.accorde += Number(x.montant_accorde ?? 0);
      }
      if (!finances) for (const k of Object.keys(par)) { delete par[k].demande; delete par[k].accorde; }
      return { par_statut: par };
    }
    case 'activite': {
      const [{ count: aFaire }, { count: enRetard }] = await Promise.all([
        db.from('contact_actions').select('id', { count: 'exact', head: true }).eq('faite', false),
        db.from('contact_actions').select('id', { count: 'exact', head: true }).eq('faite', false).lt('date_action', today),
      ]);
      return { actions_a_faire: aFaire ?? 0, actions_en_retard: enRetard ?? 0 };
    }
    case 'sessions': {
      const [{ count: aVenir }, { count: total }] = await Promise.all([
        db.from('sessions_formation').select('id', { count: 'exact', head: true }).gte('date_debut', today),
        db.from('sessions_formation').select('id', { count: 'exact', head: true }),
      ]);
      return { sessions_a_venir: aVenir ?? 0, sessions_total: total ?? 0 };
    }
    default:
      return { erreur: 'Domaine de statistiques inconnu.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outils d'ÉCRITURE : création d'une proposition (jamais d'exécution directe)
// ─────────────────────────────────────────────────────────────────────────────

async function contactLabel(id) {
  const { data } = await db.from('contacts').select('nom, prenom').eq('id', id).maybeSingle();
  return data ? `${data.prenom ?? ''} ${data.nom}`.trim() : null;
}

async function buildProposalDescription(name, a) {
  const needContact = async () => {
    const label = await contactLabel(String(a.contact_id));
    return label ?? { erreur: 'Contact introuvable (ou hors périmètre) : action impossible.' };
  };
  switch (name) {
    case 'proposer_creation_action': {
      const who = await needContact(); if (typeof who !== 'string') return who;
      return `Planifier « ${a.type} » pour ${who} le ${a.date_action}${a.heure_action ? ` à ${a.heure_action}` : ''} — ${a.description}`;
    }
    case 'proposer_maj_statut_contact': {
      const who = await needContact(); if (typeof who !== 'string') return who;
      return `Passer ${who} au statut « ${a.statut_prospect} »`;
    }
    case 'proposer_note_contact': {
      const who = await needContact(); if (typeof who !== 'string') return who;
      const n = String(a.note);
      return `Ajouter une note à la fiche de ${who} : « ${n.slice(0, 160)}${n.length > 160 ? '…' : ''} »`;
    }
    case 'proposer_creation_contact':
      return `Créer le contact ${[a.prenom, a.nom].filter(Boolean).join(' ')}${a.email ? ` <${a.email}>` : ''}`;
    case 'proposer_envoi_email':
      return `Envoyer un email à ${a.destinataire} — objet : « ${a.sujet} »`;
    case 'proposer_deplacement_opportunite': {
      const { data } = await db.from('opportunites').select('titre').eq('id', String(a.opportunite_id)).maybeSingle();
      if (!data) return { erreur: 'Opportunité introuvable (ou hors périmètre).' };
      return `Déplacer l’opportunité « ${data.titre} » vers l’étape « ${a.etape} »`;
    }
    case 'proposer_maj_statut_dossier': {
      const { data } = await db.from('dossiers').select('reference, intitule').eq('id', String(a.dossier_id)).maybeSingle();
      if (!data) return { erreur: 'Dossier introuvable (ou hors périmètre).' };
      return `Passer le dossier ${data.reference} (${data.intitule}) au statut « ${a.statut} »`;
    }
    default: return { erreur: `Proposition inconnue : ${name}` };
  }
}

/** Étapes de pipeline acceptées. `parametres` n'est lisible que par un admin :
 *  pour les autres rôles on retombe sur les étapes réellement présentes en base. */
async function etapesValides() {
  const { data: pRow } = await db.from('parametres').select('valeur').eq('cle', 'pipeline').maybeSingle();
  const colonnes = (pRow?.valeur?.colonnes ?? []).map((c) => c.cle);
  if (colonnes.length) return colonnes;
  const defaut = ['nouveau', 'qualifie', 'proposition', 'negociation', 'gagne', 'perdu'];
  const { data: opps } = await db.from('opportunites').select('stage').limit(1000);
  return [...new Set([...defaut, ...(opps ?? []).map((o) => o.stage).filter(Boolean)])];
}

/**
 * Les cartes « Valider / Annuler » ne s'affichent dans le CRM que rattachées à
 * une conversation contenant au moins un message assistant. On crée donc une
 * conversation dédiée à la session MCP et on y écrit la trace de chaque
 * proposition — sans quoi elle serait invisible, donc jamais validable.
 */
async function ensureConversation() {
  if (ctx.conversationId) return ctx.conversationId;
  const quand = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const { data, error } = await db.from('ai_conversations')
    .insert({ user_id: ctx.userId, titre: `Claude Code (MCP) — ${quand}`, contexte: null })
    .select('id').single();
  if (error) throw new Error(`Création de la conversation impossible : ${error.message}`);
  ctx.conversationId = data.id;
  return data.id;
}

async function runWriteProposal(name, a) {
  if (name === 'proposer_deplacement_opportunite') {
    const valides = await etapesValides();
    if (!valides.includes(String(a.etape))) {
      return { erreur: `Étape inconnue « ${a.etape} ». Étapes valides : ${valides.join(', ')}.` };
    }
  }
  const desc = await buildProposalDescription(name, a);
  if (typeof desc !== 'string') return desc;

  const conversationId = await ensureConversation();
  await db.from('ai_messages').insert([
    { conversation_id: conversationId, user_id: ctx.userId, role: 'user', content: `(depuis Claude Code) ${name}` },
    { conversation_id: conversationId, user_id: ctx.userId, role: 'assistant', content: desc },
  ]);

  const { data, error } = await db.from('ai_actions').insert({
    conversation_id: conversationId,
    user_id: ctx.userId,
    outil: name,
    args: a,
    description: desc,
  }).select('id, outil, description, statut').single();
  if (error) return { erreur: error.message };

  return {
    proposition_creee: true,
    action_id: data.id,
    description: desc,
    note: 'EN ATTENTE DE VALIDATION par l’utilisateur, dans le CRM : Assistant > historique > conversation « Claude Code (MCP) ». Ne pas la considérer comme exécutée, ne pas la re-proposer. Sans validation sous 24 h elle expire.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Serveur MCP
// ─────────────────────────────────────────────────────────────────────────────

const WRITE_TOOLS = new Set([
  'proposer_creation_action', 'proposer_maj_statut_contact', 'proposer_note_contact',
  'proposer_creation_contact', 'proposer_envoi_email', 'proposer_deplacement_opportunite',
  'proposer_maj_statut_dossier',
]);

async function signIn() {
  const { data, error } = await db.auth.signInWithPassword({ email: CRM_EMAIL, password: CRM_PASSWORD });
  if (error) throw new Error(`Connexion au CRM refusée : ${error.message}`);
  ctx.userId = data.user.id;

  const { data: profile } = await db.from('profiles').select('role').eq('id', ctx.userId).maybeSingle();
  const role = profile?.role ?? 'conseiller';
  ctx.isDirection = role === 'admin' || role === 'directeur_commercial';

  // Droits par rôle. `parametres` n'est lisible que par un admin : pour les
  // autres rôles on garde les droits par défaut (tout autorisé sauf finances),
  // la RLS restant de toute façon la limite réelle du périmètre.
  const { data: cbRow } = await db.from('parametres').select('valeur').eq('cle', 'chatbot').maybeSingle();
  const allDroits = cbRow?.valeur?.droits ?? {};
  ctx.droits = (ctx.isDirection ? allDroits.direction : allDroits.conseiller) ?? {};
  ctx.finances = ctx.isDirection ? ctx.droits.finances !== false : ctx.droits.finances === true;

  log(`connecté : ${CRM_EMAIL} — rôle ${role}${ctx.isDirection ? ' (direction)' : ''}, finances ${ctx.finances ? 'oui' : 'non'}`);
}

async function main() {
  await signIn();

  const server = new Server(
    { name: 'crm-aissociate', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: buildTools() }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = req.params.arguments ?? {};
    try {
      const result = WRITE_TOOLS.has(name) ? await runWriteProposal(name, args) : await runReadTool(name, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`échec de ${name} : ${message}`);
      return { content: [{ type: 'text', text: JSON.stringify({ erreur: message }) }], isError: true };
    }
  });

  await server.connect(new StdioServerTransport());
  log('serveur MCP prêt (stdio)');
}

main().catch((err) => {
  log(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

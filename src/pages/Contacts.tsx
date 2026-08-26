import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Mail, Phone, Search, CloudDownload as DownloadCloud, FileSpreadsheet, UserCheck, ClipboardList, Tag, Columns3, Undo2, Clock } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Badge, Spinner, EmptyState, type Tone } from '@/components/ui';
import { CONTACT_TYPE_LABELS, OPP_STAGE_LABELS } from '@/lib/constants';
import { fullName, formatDate, ymdLocal, prochaineHeureOuvrable } from '@/lib/utils';
import {
  importProspectsFile, parseSpreadsheetWithHeaders, importContactsMapped,
  guessMapping, CONTACT_IMPORT_FIELDS, type ColumnMapping,
} from '@/lib/importExcel';
import ContactFiche from '@/components/ContactFiche';
import type {
  Contact, ContactType, Entreprise, Financeur, Profile,
  ContactAction, Opportunite, SessionParticipant, SessionFormation, ImportBatch,
} from '@/lib/database.types';

const TODAY = new Date().toISOString().slice(0, 10);

const REFRESH_MS = 5 * 60 * 1000; // rafraîchissement auto des prospects (5 min)

const TYPES: ContactType[] = ['prospect', 'contact', 'apprenant', 'contact_entreprise', 'contact_financeur', 'formateur', 'encadrement'];

// Types de demande du formulaire public (/formulaire) — repris dans la saisie interne.
const REQUEST_TYPE_GROUPS: { label: string; options: string[] }[] = [
  { label: 'Formations CPF', options: ["Création de contenus rédactionnels et visuels par l'IA générative"] },
  { label: 'Formations OPCO', options: [
    'Introduction aux IA pour les PME', 'Automatisation des process des PME',
    "L'IA pour optimiser la relation client", "L'IA pour optimiser le marketing et la communication",
    "L'IA pour optimiser la prospection commerciale", "L'IA pour optimiser les ressources humaines",
    'Apprenez à maîtriser les marchés publics avec lemarchepublic.fr',
  ] },
  { label: 'Services', options: ['Assistance IA', 'Développement sur mesure'] },
];

const empty = (): Partial<Contact> => ({
  type: 'prospect', civilite: '', nom: '', prenom: '', email: '',
  telephone: '', fonction: '', entreprise_id: null, financeur_id: null, rgpd_consent: false, notes: '', tags: [],
});

const emptyIntake = () => ({ firstName: '', lastName: '', email: '', phone: '', company: '', requestType: '', message: '' });

// ── Contact créé depuis la Messagerie (ticket « lien vers fiche dans contacts ») ──
// Données transmises par la page Messagerie via l'état de navigation.
type MailSeed = { sujet: string | null; recuLe: string | null };
export type NouveauContactState = {
  email: string; prenom: string; nom: string; telephone: string;
  actionsMessagerie: MailSeed;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Les deux actions demandées à la création d'un contact depuis un mail entrant. */
function seedActionsFromMail(contactId: string, seed: MailSeed) {
  const recu = seed.recuLe ? new Date(seed.recuLe) : new Date();
  const suite = prochaineHeureOuvrable();
  return [
    {
      contact_id: contactId, date_action: ymdLocal(recu), heure_action: `${pad2(recu.getHours())}:${pad2(recu.getMinutes())}`,
      type: 'email', faite: true,
      description: `E-mail entrant reçu${seed.sujet ? ` : ${seed.sujet}` : ''}`,
    },
    {
      contact_id: contactId, date_action: suite.date, heure_action: suite.heure,
      type: 'email', faite: false,
      description: 'Répondre à l\'e-mail entrant (première heure ouvrable)',
    },
  ];
}

export default function Contacts() {
  const { session, isManager } = useAuth();
  const { data, loading, refresh } = useCollection<Contact>('contacts', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });
  // Données de pilotage (prochaine action, pipeline, sessions)
  const actionsCol = useCollection<ContactAction>('contact_actions', { orderBy: { column: 'date_action' } });
  const oppsCol = useCollection<Opportunite>('opportunites');
  const partsCol = useCollection<SessionParticipant>('session_participants');
  const sessCol = useCollection<SessionFormation>('sessions_formation');

  // Maps contact_id -> info de pilotage
  const nextAction: Record<string, ContactAction> = {};
  for (const a of actionsCol.data) if (!a.faite && !nextAction[a.contact_id]) nextAction[a.contact_id] = a;
  // Dernière interaction = action RÉALISÉE la plus récente par contact.
  // actionsCol est trié par date_action croissante → la dernière rencontrée est la plus récente.
  const lastInteraction: Record<string, ContactAction> = {};
  for (const a of actionsCol.data) if (a.faite) lastInteraction[a.contact_id] = a;
  const stageOf: Record<string, Opportunite['stage']> = {};
  for (const o of oppsCol.data) if (o.contact_id && !['gagne', 'perdu'].includes(o.stage) && !stageOf[o.contact_id]) stageOf[o.contact_id] = o.stage;
  const sessById = Object.fromEntries(sessCol.data.map((s) => [s.id, s]));
  const nextSession: Record<string, SessionFormation> = {};
  for (const p of partsCol.data) {
    if (!p.contact_id) continue;
    const s = sessById[p.session_id]; if (!s) continue;
    const cur = nextSession[p.contact_id];
    const better = !cur
      || (s.date_debut >= TODAY && (cur.date_debut < TODAY || s.date_debut < cur.date_debut))
      || (s.date_debut < TODAY && cur.date_debut < TODAY && s.date_debut > cur.date_debut);
    if (better) nextSession[p.contact_id] = s;
  }

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>(empty());
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  // Mail à journaliser en actions dès que le contact issu de la Messagerie est créé.
  const [pendingActions, setPendingActions] = useState<MailSeed | null>(null);

  // Arrivée depuis la Messagerie : ouvre « Nouveau contact » pré-rempli.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const seed = (location.state as { nouveauContact?: NouveauContactState } | null)?.nouveauContact;
    if (!seed) return;
    setForm({ ...empty(), nom: seed.nom, prenom: seed.prenom, email: seed.email, telephone: seed.telephone });
    setTagsText('');
    setPendingActions(seed.actionsMessagerie);
    setOpen(true);
    // L'état de navigation est consommé : un rafraîchissement ne doit pas rouvrir la modale.
    navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);
  const [q, setQ] = useState('');
  // Affichage par défaut : les prospects (cœur du travail de prospection).
  const [typeFilter, setTypeFilter] = useState<string>('prospect');
  const [affFilter, setAffFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [statutFilter, setStatutFilter] = useState<string>('');
  // Pagination (côté client, sur le résultat filtré)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Tri par colonne (Nom / Type / Affectation)
  const [sort, setSort] = useState<{ col: 'nom' | 'type' | 'aff' | null; dir: 'asc' | 'desc' }>({ col: null, dir: 'asc' });
  const toggleSort = (col: 'nom' | 'type' | 'aff') => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  const sortArrow = (col: 'nom' | 'type' | 'aff') => (sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕');
  // Saisie interne (formulaire de demande) — création/mise à jour d'un contact
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intake, setIntake] = useState(emptyIntake());
  const [intakeSaving, setIntakeSaving] = useState(false);
  const [intakeMsg, setIntakeMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [fiche, setFiche] = useState<Contact | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Import CSV avec mapping de colonnes
  const mapFileRef = useRef<HTMLInputElement>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapHeaders, setMapHeaders] = useState<string[]>([]);
  const [mapRows, setMapRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mapOwner, setMapOwner] = useState<'none' | 'me'>('none');
  const [mapType, setMapType] = useState<ContactType>('prospect');
  // Lots d'import (annulation persistante en base, multi-poste).
  const batches = useCollection<ImportBatch>('import_batches', {
    filters: [{ column: 'undone', value: false }],
    orderBy: { column: 'created_at', ascending: false },
  });
  const recordImport = async (ids: string[], source: 'csv' | 'csv_mapping') => {
    if (!ids.length) return;
    await supabase.from('import_batches').insert({
      source, count: ids.length, contact_ids: ids, created_by: session?.user.id ?? null,
    });
    batches.refresh();
  };
  const undoBatch = async (b: ImportBatch) => {
    if (!b.contact_ids.length) return;
    if (!confirm(`Annuler cet import ? ${b.contact_ids.length} contact(s) CRÉÉ(s) seront supprimés (les contacts mis à jour ne sont pas affectés).`)) return;
    setImporting(true);
    try {
      for (let i = 0; i < b.contact_ids.length; i += 200) {
        const { error } = await supabase.from('contacts').delete().in('id', b.contact_ids.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
      await supabase.from('import_batches').update({ undone: true, undone_at: new Date().toISOString() }).eq('id', b.id);
      batches.refresh();
      refresh();
      alert('Import annulé.');
    } catch (err) {
      alert(`Annulation impossible : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  // Rafraîchissement automatique toutes les 5 min (nouveaux prospects non affectés)
  useEffect(() => {
    const t = setInterval(() => { void refresh(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // « /contacts?contact=<id> » ouvre directement la fiche : utilisé par la
  // Capture mobile pour renvoyer vers le contact qui vient d'être enrichi.
  const cibleFiche = new URLSearchParams(location.search).get('contact');
  useEffect(() => {
    if (!cibleFiche) return;
    const c = data.find((x) => x.id === cibleFiche);
    if (c) setFiche(c);
  }, [cibleFiche, data]);

  // Retour à la première page dès qu'un filtre / la recherche / la taille change
  useEffect(() => { setPage(1); }, [q, typeFilter, affFilter, tagFilter, statutFilter, pageSize, sort.col, sort.dir]);

  const [distributing, setDistributing] = useState(false);
  // Sélection multiple + répartition round-robin (managers)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOwner, setBulkOwner] = useState('');
  const [bulkType, setBulkType] = useState<ContactType>('prospect');
  const [rrOpen, setRrOpen] = useState(false);
  const [rrConseillers, setRrConseillers] = useState<Set<string>>(new Set());

  // Affectation d'un prospect à un conseiller (managers uniquement)
  const assign = async (c: Contact, ownerId: string) => {
    const { error } = await supabase.from('contacts').update({ owner_id: ownerId || null }).eq('id', c.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  // Attribution globale de la sélection à un conseiller (avec confirmation).
  const bulkAssign = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    const label = bulkOwner ? ownerName(bulkOwner) : 'Non affecté';
    if (!confirm(`Attribuer ${ids.length} contact(s) à ${label} ?`)) return;
    setDistributing(true);
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('contacts').update({ owner_id: bulkOwner || null }).in('id', ids.slice(i, i + 200));
      if (error) { setDistributing(false); alert(error.message); return; }
    }
    setDistributing(false);
    setSelected(new Set());
    refresh();
  };

  // Changement de type en masse de la sélection (ex. requalifier des contacts en prospects).
  const bulkChangeType = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Changer le type de ${ids.length} contact(s) en « ${CONTACT_TYPE_LABELS[bulkType]} » ?`)) return;
    setDistributing(true);
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('contacts').update({ type: bulkType }).in('id', ids.slice(i, i + 200));
      if (error) { setDistributing(false); alert(error.message); return; }
    }
    setDistributing(false);
    setSelected(new Set());
    refresh();
  };

  // Ouvre la modale de répartition (conseillers présélectionnés = conseillers actifs).
  const openRoundRobin = () => {
    setRrConseillers(new Set(assignables.filter((p) => p.role === 'conseiller').map((p) => p.id)));
    setRrOpen(true);
  };
  const toggleRrConseiller = (id: string) => setRrConseillers((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Cibles de la répartition : la sélection si présente, sinon tous les prospects non affectés.
  const rrTargets = (): Contact[] => selected.size
    ? data.filter((c) => selected.has(c.id))
    : data.filter((c) => c.type === 'prospect' && !c.owner_id);

  // Répartition round-robin sur les conseillers sélectionnés (partielle possible).
  const runRoundRobin = async () => {
    const ids = [...rrConseillers];
    if (!ids.length) { alert('Sélectionnez au moins un conseiller.'); return; }
    const targets = rrTargets();
    if (!targets.length) { alert('Aucune cible à répartir.'); return; }
    setDistributing(true);
    for (let i = 0; i < targets.length; i++) {
      await supabase.from('contacts').update({ owner_id: ids[i % ids.length] }).eq('id', targets[i].id);
    }
    setDistributing(false);
    setRrOpen(false);
    setSelected(new Set());
    refresh();
    alert(`${targets.length} contact(s) répartis sur ${ids.length} conseiller(s) (round-robin).`);
  };

  const ownerName = (id: string | null) => {
    const p = profiles.data.find((x) => x.id === id);
    return p ? fullName(p.prenom, p.nom) : '—';
  };
  const nonAffectes = data.filter((c) => c.type === 'prospect' && !c.owner_id).length;
  // Conseillers attribuables : actifs et approuvés uniquement (pas d'inactif en attente).
  // Attribuables : conseillers, directeurs commerciaux ET la direction (admins),
  // dès lors qu'ils sont actifs et approuvés. La direction traite aussi des prospects.
  const assignables = profiles.data.filter((p) => (p.role === 'conseiller' || p.role === 'directeur_commercial' || p.role === 'admin' || p.is_admin) && p.actif && p.approved);
  // Statuts de qualification présents (pour le filtre de la liste).
  const statutsPresents = [...new Set(data.map((c) => (c.statut_prospect ?? '').trim()).filter(Boolean))].sort();

  // Import des prospects depuis un fichier Excel/CSV (parse navigateur, insert via session)
  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      // Round-robin sur les conseillers actifs ; si aucun -> non affecté (manuel)
      const r = await importProspectsFile(file, session?.user.id);
      await recordImport(r.created ?? [], 'csv');
      refresh();
      alert(`${r.importes} nouveau(x) prospect(s) importé(s) sur ${r.lus} ligne(s) — répartis en round-robin.`);
    } catch (err) {
      alert(`Échec de l'import : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  // Import CSV avec mapping : on lit les en-têtes, on pré-mappe, on ouvre la modale.
  const openMapping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    try {
      const { headers, rows } = await parseSpreadsheetWithHeaders(file);
      if (!headers.length || !rows.length) { alert('CSV vide ou illisible (en-tête + au moins une ligne attendus).'); return; }
      setMapHeaders(headers);
      setMapRows(rows);
      setMapping(guessMapping(headers));
      setMapOwner(isManager ? 'none' : 'me');
      setMapOpen(true);
    } catch (err) {
      alert(`Lecture du CSV impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const runMappedImport = async () => {
    if (!mapping.nom && !mapping.nom_complet) { alert('Mappez au moins la colonne « Nom » ou « Nom complet ».'); return; }
    setImporting(true);
    try {
      const ownerId = mapOwner === 'me' ? (session?.user.id ?? null) : null;
      const r = await importContactsMapped(mapRows, mapping, { ownerId, defaultType: mapType });
      await recordImport(r.created ?? [], 'csv_mapping');
      setMapOpen(false);
      refresh();
      alert(`${r.importes} contact(s) importé(s)/mis à jour sur ${r.lus} ligne(s) (${(r.created ?? []).length} créé(s)).`);
    } catch (err) {
      alert(`Échec de l'import : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  // Import des prospects depuis le Google Sheet (Edge Function import-sheets)
  const importProspects = async () => {
    setImporting(true);
    const { data: res, error } = await supabase.functions.invoke('import-sheets', { body: { source: 'prospects' } });
    setImporting(false);
    if (error) {
      alert("Import indisponible : déployez l'Edge Function « import-sheets ».");
      return;
    }
    const p = (res as { prospects?: { importes?: number } })?.prospects;
    refresh();
    alert(`${p?.importes ?? 0} nouveau(x) prospect(s) importé(s) depuis Google Sheets, en « non affecté ».`);
  };

  const openNew = () => { setForm(empty()); setTagsText(''); setOpen(true); };
  const openEdit = (c: Contact) => { setForm(c); setTagsText((c.tags ?? []).join(', ')); setOpen(true); };

  const save = async () => {
    setSaving(true);
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = { ...form, tags, owner_id: form.owner_id ?? session?.user.id };
    let newId: string | null = null;
    let error;
    if (form.id) {
      ({ error } = await supabase.from('contacts').update(payload).eq('id', form.id));
    } else {
      const { data: ins, error: insErr } = await supabase.from('contacts').insert(payload).select('id').single();
      error = insErr;
      newId = ins?.id ?? null;
    }
    // Contact créé depuis la Messagerie : on journalise le mail entrant (déjà
    // traité) et la réponse à effectuer à la première heure ouvrable.
    if (!error && newId && pendingActions) {
      await supabase.from('contact_actions').insert(seedActionsFromMail(newId, pendingActions));
      setPendingActions(null);
      actionsCol.refresh();
    }
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  // Saisie interne : reprend le formulaire public et crée OU met à jour le contact
  // (dédoublonnage par e-mail). Type « Assistance » => tag « Assistance », sans affectation.
  const submitIntake = async () => {
    if (!intake.lastName.trim() && !intake.email.trim()) { alert('Renseignez au moins le nom ou l\'e-mail.'); return; }
    setIntakeSaving(true);
    const isAssist = /assistance/i.test(intake.requestType);
    const assistTags = isAssist ? ['Assistance'] : [];
    let existing: Contact | null = null;
    if (intake.email.trim()) {
      const { data: ex } = await supabase.from('contacts').select('*').eq('email', intake.email.trim()).limit(1).maybeSingle();
      existing = ex as Contact | null;
    }
    let error;
    if (existing) {
      const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...assistTags]));
      ({ error } = await supabase.from('contacts').update({
        prenom: intake.firstName.trim() || existing.prenom,
        telephone: intake.phone.trim() || existing.telephone,
        formation_envisagee: intake.requestType || existing.formation_envisagee,
        besoin_resume: intake.message.trim() || existing.besoin_resume,
        tags: mergedTags,
      }).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('contacts').insert({
        type: 'prospect', nom: intake.lastName.trim() || '(lead)', prenom: intake.firstName.trim() || null,
        email: intake.email.trim() || null, telephone: intake.phone.trim() || null,
        statut_prospect: 'non assigné', besoin_resume: intake.message.trim() || null,
        formation_envisagee: intake.requestType || null,
        notes: 'Saisie interne (formulaire)' + (intake.company.trim() ? ' — entreprise : ' + intake.company.trim() : ''),
        tags: ['nouveau prospect', ...assistTags], owner_id: null, // lead non assigné, pas d'affectation
      }));
    }
    setIntakeSaving(false);
    if (error) { alert(error.message); return; }
    setIntakeMsg(existing ? 'Contact mis à jour ✓' : 'Contact créé ✓');
    setTimeout(() => { setIntakeMsg(null); setIntakeOpen(false); setIntake(emptyIntake()); }, 1200);
    refresh();
  };

  const remove = async (c: Contact) => {
    if (!confirm(`Supprimer le contact ${fullName(c.prenom, c.nom)} ?`)) return;
    const { error } = await supabase.from('contacts').delete().eq('id', c.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const allTags = [...new Set(data.flatMap((c) => c.tags ?? []))].sort();

  const filtered = data.filter((c) => {
    const matchQ = `${c.nom} ${c.prenom} ${c.email}`.toLowerCase().includes(q.toLowerCase());
    const matchType = !typeFilter || c.type === typeFilter;
    const matchAff = !affFilter || (affFilter === 'non' ? !c.owner_id : c.owner_id === affFilter);
    const matchTag = !tagFilter || (c.tags ?? []).includes(tagFilter);
    const matchStatut = !statutFilter || (c.statut_prospect ?? '') === statutFilter;
    return matchQ && matchType && matchAff && matchTag && matchStatut;
  });

  // Tri optionnel par colonne (Nom / Type / Affectation)
  const sortKey = (c: Contact) => {
    if (sort.col === 'type') return CONTACT_TYPE_LABELS[c.type] ?? '';
    if (sort.col === 'aff') return c.owner_id ? ownerName(c.owner_id) : '';
    return `${c.nom ?? ''} ${c.prenom ?? ''}`.trim();
  };
  const sorted = sort.col
    ? [...filtered].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'fr', { sensitivity: 'base' }) * (sort.dir === 'asc' ? 1 : -1))
    : filtered;

  // Découpage en pages (currentPage borné : la page reste valide si la liste rétrécit)
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Sélection multiple (managers) ──
  const selectableIds = filtered.map((c) => c.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => setSelected((s) => (selectableIds.every((id) => s.has(id)) ? new Set() : new Set(selectableIds)));

  const set = (k: keyof Contact, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Décompte « dernière interaction » — prospects uniquement.
  const interactionCell = (c: Contact) => {
    if (c.type !== 'prospect') return <span className="text-muted/50">—</span>;
    const la = lastInteraction[c.id];
    if (!la) return <Badge tone="warning"><Clock className="mr-1 h-3 w-3" />Jamais</Badge>;
    const days = differenceInCalendarDays(new Date(), new Date(`${la.date_action}T00:00:00`));
    const tone: Tone = days <= 7 ? 'success' : days <= 14 ? 'warning' : 'danger';
    const label = days <= 0 ? "Aujourd'hui" : days === 1 ? 'Hier' : `Il y a ${days} j`;
    return (
      <span title={`Dernière action réalisée : ${la.description} · ${formatDate(la.date_action)}`}>
        <Badge tone={tone}><Clock className="mr-1 h-3 w-3" />{label}</Badge>
      </span>
    );
  };

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Prospects, apprenants et interlocuteurs (CRM 4.1)"
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importFile} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
              <FileSpreadsheet className={`h-4 w-4 ${importing ? 'animate-pulse' : ''}`} />
              {importing ? 'Import…' : 'Importer CSV'}
            </Button>
            <input ref={mapFileRef} type="file" accept=".csv" className="hidden" onChange={openMapping} />
            <Button variant="secondary" onClick={() => mapFileRef.current?.click()} disabled={importing} title="Importer un CSV en choisissant le mapping des colonnes">
              <Columns3 className="h-4 w-4" /> Importer (mapping)
            </Button>
            {isManager && (
              <Button variant="secondary" onClick={importProspects} disabled={importing} title="Depuis le Google Sheet configuré">
                <DownloadCloud className="h-4 w-4" /> Sheets
              </Button>
            )}
            {isManager && (
              <Button variant="secondary" onClick={() => { setIntake(emptyIntake()); setIntakeMsg(null); setIntakeOpen(true); }} title="Saisir une demande comme le formulaire public (création ou mise à jour)">
                <ClipboardList className="h-4 w-4" /> Saisie (formulaire)
              </Button>
            )}
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouveau contact</Button>
          </>
        }
      />

      {isManager && nonAffectes > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm text-brand-700 dark:text-brand-300">
          <UserCheck className="h-4 w-4 shrink-0" />
          <span className="flex-1"><strong>{nonAffectes}</strong> prospect(s) non affecté(s).</span>
          <button onClick={() => { setAffFilter('non'); setTypeFilter('prospect'); }} className="font-medium underline-offset-2 hover:underline">Afficher</button>
          <Button variant="secondary" onClick={openRoundRobin} disabled={distributing}>
            <UserCheck className="h-4 w-4" /> {distributing ? 'Répartition…' : 'Répartir (round-robin)'}
          </Button>
        </div>
      )}

      {/* Barre d'actions de masse sur la sélection (managers) */}
      {isManager && selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm">
          <span className="font-medium text-brand-700 dark:text-brand-300">{selected.size} sélectionné(s)</span>
          <span className="mx-1 text-muted">·</span>
          <select className="input max-w-[200px] py-1 text-xs" value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)}>
            <option value="">Non affecté</option>
            {assignables.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
          </select>
          <Button variant="secondary" onClick={bulkAssign} disabled={distributing}>
            <UserCheck className="h-4 w-4" /> Attribuer
          </Button>
          <Button variant="secondary" onClick={openRoundRobin} disabled={distributing}>
            <UserCheck className="h-4 w-4" /> Répartir (round-robin)
          </Button>
          <span className="mx-1 text-muted">·</span>
          <select className="input max-w-[170px] py-1 text-xs" value={bulkType} onChange={(e) => setBulkType(e.target.value as ContactType)} title="Type cible">
            {TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
          </select>
          <Button variant="secondary" onClick={bulkChangeType} disabled={distributing}>
            <Tag className="h-4 w-4" /> Changer le type
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs font-medium text-muted underline-offset-2 hover:underline">Désélectionner</button>
        </div>
      )}

      {/* Imports récents annulables (lots persistants en base) */}
      {batches.data.length > 0 && (
        <div className="mb-4 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted"><Undo2 className="h-3.5 w-3.5" /> Imports récents — annulables</p>
          <div className="flex flex-col gap-1.5">
            {batches.data.slice(0, 5).map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-fg"><strong>{b.count}</strong> contact(s) créé(s)</span>
                <span className="text-xs text-muted">{b.source === 'csv_mapping' ? 'CSV (mapping)' : 'CSV'} · {formatDate(b.created_at, 'dd/MM/yyyy HH:mm')}</span>
                <button onClick={() => undoBatch(b)} disabled={importing} className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50">
                  <Undo2 className="h-3.5 w-3.5" /> Annuler
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input className="input pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input max-w-[220px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous les types</option>
          {TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
        </select>
        {isManager && (
          <select className="input max-w-[220px]" value={affFilter} onChange={(e) => setAffFilter(e.target.value)}>
            <option value="">Toutes affectations</option>
            <option value="non">Non affectés</option>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
          </select>
        )}
        {statutsPresents.length > 0 && (
          <select className="input max-w-[200px]" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="">Tous les statuts (qualif.)</option>
            {statutsPresents.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {allTags.length > 0 && (
          <select className="input max-w-[200px]" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Tous les tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun contact" message="Créez votre premier contact pour démarrer." />
      ) : (
        <>
        <Table head={
          <tr>
            {isManager && (
              <th className="px-4 py-3 w-0"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Tout sélectionner (résultat filtré, toutes pages)" /></th>
            )}
            <th className="px-4 py-3"><button onClick={() => toggleSort('nom')} className="inline-flex items-center gap-1 hover:text-fg">Nom <span className="text-xs text-muted">{sortArrow('nom')}</span></button></th>
            <th className="px-4 py-3"><button onClick={() => toggleSort('type')} className="inline-flex items-center gap-1 hover:text-fg">Type <span className="text-xs text-muted">{sortArrow('type')}</span></button></th>
            <th className="px-4 py-3">Coordonnées</th>
            <th className="px-4 py-3"><button onClick={() => toggleSort('aff')} className="inline-flex items-center gap-1 hover:text-fg">Affectation <span className="text-xs text-muted">{sortArrow('aff')}</span></button></th>
            <th className="px-4 py-3" title="Temps écoulé depuis la dernière action réalisée (prospects)">Dernière interaction</th>
            <th className="px-4 py-3">Pilotage</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {paged.map((c) => (
            <tr
              key={c.id}
              className={`cursor-pointer hover:bg-surface-2 ${selected.has(c.id) ? 'bg-brand-500/5' : ''}`}
              onClick={() => setFiche(c)}
            >
              {isManager && (
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                </td>
              )}
              <td className="px-4 py-3 font-medium text-fg">
                {fullName(c.prenom, c.nom)}
                {c.fonction && <span className="block text-xs font-normal text-muted">{c.fonction}</span>}
                {(c.tags ?? []).length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {(c.tags ?? []).map((t) => (
                      <Badge key={t} tone={t.toLowerCase() === 'assistance' ? 'info' : t.toLowerCase() === 'nouveau prospect' ? 'warning' : 'neutral'}>
                        <Tag className="mr-1 h-3 w-3" />{t}
                      </Badge>
                    ))}
                  </span>
                )}
              </td>
              <td className="px-4 py-3"><Badge tone="brand">{CONTACT_TYPE_LABELS[c.type]}</Badge></td>
              <td className="px-4 py-3 text-muted">
                {c.email && <span className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3" />{c.email}</span>}
                {c.telephone && <span className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{c.telephone}</span>}
                {!c.email && !c.telephone && <span className="text-xs">—</span>}
              </td>
              <td className="px-4 py-3">
                {isManager ? (
                  <select
                    className={`input max-w-[180px] py-1 text-xs ${!c.owner_id ? 'border-brand-500/50 text-brand-700 dark:text-brand-300' : ''}`}
                    value={c.owner_id ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { e.stopPropagation(); assign(c, e.target.value); }}
                  >
                    <option value="">Non affecté</option>
                    {assignables.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
                    {/* Garde l'affecté courant visible même s'il n'est pas dans la liste
                        des attribuables — avec le VRAI motif, pas un « inactif » générique. */}
                    {c.owner_id && !assignables.some((p) => p.id === c.owner_id) && (() => {
                      const o = profiles.data.find((p) => p.id === c.owner_id);
                      const motif = !o ? ' (compte introuvable)'
                        : o.actif === false ? ' (désactivé)'
                        : o.approved === false ? ' (non approuvé)'
                        : '';
                      return <option value={c.owner_id}>{ownerName(c.owner_id)}{motif}</option>;
                    })()}
                  </select>
                ) : (
                  <span className="text-xs text-muted">{c.owner_id ? ownerName(c.owner_id) : <Badge tone="warning">Non affecté</Badge>}</span>
                )}
              </td>
              <td className="px-4 py-3">{interactionCell(c)}</td>
              <td className="px-4 py-3 text-xs">
                <div className="flex flex-col gap-1">
                  {nextAction[c.id] ? (
                    <span className={`flex items-center gap-1 ${nextAction[c.id].date_action < TODAY ? 'text-red-600 dark:text-red-400' : 'text-muted'}`}
                      title={nextAction[c.id].description}>
                      <span className="rounded bg-amber-500/15 px-1 text-amber-700 dark:text-amber-300">{formatDate(nextAction[c.id].date_action, 'dd/MM')}</span>
                      <span className="max-w-[140px] truncate">{nextAction[c.id].description}</span>
                    </span>
                  ) : <span className="text-muted/60">—</span>}
                  <div className="flex flex-wrap gap-1">
                    {stageOf[c.id] && <Badge tone="brand">{OPP_STAGE_LABELS[stageOf[c.id]] ?? stageOf[c.id]}</Badge>}
                    {nextSession[c.id] && (
                      <Badge tone={nextSession[c.id].date_debut >= TODAY ? 'warning' : 'success'}>
                        {nextSession[c.id].date_debut >= TODAY ? 'Session ' : 'Réalisée '}{formatDate(nextSession[c.id].date_debut, 'dd/MM')}
                      </Badge>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(c)} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(c)} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </Table>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} sur {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <select className="input max-w-[110px] py-1 text-xs" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} title="Contacts par page">
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Précédent</Button>
            <span className="text-muted whitespace-nowrap">Page {currentPage} / {pageCount}</span>
            <Button variant="secondary" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage >= pageCount}>Suivant</Button>
          </div>
        </div>
        </>
      )}

      {/* Répartition round-robin (cibles = sélection ou prospects non affectés) */}
      <Modal
        open={rrOpen} onClose={() => setRrOpen(false)} title="Répartir en round-robin"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRrOpen(false)}>Annuler</Button>
            <Button onClick={runRoundRobin} disabled={distributing || rrConseillers.size === 0}>
              <UserCheck className="h-4 w-4" /> {distributing ? 'Répartition…' : 'Confirmer la répartition'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-surface-2 p-3 text-sm text-fg">
            Répartir <strong>{rrTargets().length}</strong> {selected.size ? 'contact(s) sélectionné(s)' : 'prospect(s) non affecté(s)'} sur <strong>{rrConseillers.size}</strong> conseiller(s) sélectionné(s).
          </p>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Conseillers concernés</p>
            {assignables.length === 0 ? (
              <p className="text-sm text-muted">Aucun conseiller actif disponible.</p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
                {assignables.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-2">
                    <input type="checkbox" checked={rrConseillers.has(p.id)} onChange={() => toggleRrConseiller(p.id)} />
                    <span className="text-fg">{fullName(p.prenom, p.nom)}</span>
                    <span className="text-xs text-muted">· {p.role === 'directeur_commercial' ? 'directeur commercial' : p.role}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={open} onClose={() => setOpen(false)}
        title={form.id ? 'Modifier le contact' : 'Nouveau contact'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.nom}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type"><select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
          </select></Field>
          <Field label="Civilité"><input className="input" value={form.civilite ?? ''} onChange={(e) => set('civilite', e.target.value)} /></Field>
          <Field label="Prénom"><input className="input" value={form.prenom ?? ''} onChange={(e) => set('prenom', e.target.value)} /></Field>
          <Field label="Nom" required><input className="input" value={form.nom ?? ''} onChange={(e) => set('nom', e.target.value)} /></Field>
          <Field label="E-mail"><input className="input" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Téléphone"><input className="input" value={form.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} /></Field>
          <Field label="Fonction"><input className="input" value={form.fonction ?? ''} onChange={(e) => set('fonction', e.target.value)} /></Field>
          <Field label="Entreprise"><select className="input" value={form.entreprise_id ?? ''} onChange={(e) => set('entreprise_id', e.target.value || null)}>
            <option value="">—</option>
            {entreprises.data.map((e) => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
          </select></Field>
          <Field label="Financeur (si contact financeur)"><select className="input" value={form.financeur_id ?? ''} onChange={(e) => set('financeur_id', e.target.value || null)}>
            <option value="">—</option>
            {financeurs.data.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select></Field>
          <div className="col-span-2">
            <Field label="Tags" hint="Séparés par des virgules (ex. Assistance)">
              <input className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Assistance, VIP…" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Notes"><textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={!!form.rgpd_consent} onChange={(e) => set('rgpd_consent', e.target.checked)} />
            Consentement RGPD recueilli
          </label>
        </div>
      </Modal>

      {/* Saisie interne — reprend le formulaire public (/formulaire) */}
      <Modal
        open={intakeOpen} onClose={() => setIntakeOpen(false)} wide
        title="Saisie d'une demande (formulaire)"
        footer={
          <>
            {intakeMsg && <span className="mr-auto text-sm text-emerald-600">{intakeMsg}</span>}
            <Button variant="secondary" onClick={() => setIntakeOpen(false)}>Annuler</Button>
            <Button onClick={submitIntake} disabled={intakeSaving}>{intakeSaving ? 'Enregistrement…' : 'Créer / mettre à jour'}</Button>
          </>
        }
      >
        <p className="mb-4 text-xs text-muted">
          Reprend le formulaire public. Le contact est <strong>créé</strong> ou <strong>mis à jour</strong> (dédoublonnage par e-mail).
          Une demande de type <strong>Assistance</strong> ajoute le tag « Assistance » (sans affectation).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom"><input className="input" value={intake.firstName} onChange={(e) => setIntake({ ...intake, firstName: e.target.value })} /></Field>
          <Field label="Nom"><input className="input" value={intake.lastName} onChange={(e) => setIntake({ ...intake, lastName: e.target.value })} /></Field>
          <Field label="E-mail" hint="Sert au dédoublonnage"><input className="input" type="email" value={intake.email} onChange={(e) => setIntake({ ...intake, email: e.target.value })} /></Field>
          <Field label="Téléphone"><input className="input" value={intake.phone} onChange={(e) => setIntake({ ...intake, phone: e.target.value })} /></Field>
          <Field label="Entreprise"><input className="input" value={intake.company} onChange={(e) => setIntake({ ...intake, company: e.target.value })} /></Field>
          <Field label="Type de demande">
            <select className="input" value={intake.requestType} onChange={(e) => setIntake({ ...intake, requestType: e.target.value })}>
              <option value="">— Sélectionner —</option>
              {REQUEST_TYPE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Message"><textarea className="input" rows={3} value={intake.message} onChange={(e) => setIntake({ ...intake, message: e.target.value })} /></Field>
          </div>
          {/assistance/i.test(intake.requestType) && (
            <div className="col-span-2">
              <Badge tone="info"><Tag className="mr-1 h-3 w-3" /> Sera tagué « Assistance »</Badge>
            </div>
          )}
        </div>
      </Modal>

      {/* Import CSV — mapping des colonnes */}
      <Modal
        open={mapOpen} onClose={() => setMapOpen(false)} wide
        title="Importer un CSV — mapping des colonnes"
        footer={<>
          <Button variant="secondary" onClick={() => setMapOpen(false)}>Annuler</Button>
          <Button onClick={runMappedImport} disabled={importing || (!mapping.nom && !mapping.nom_complet)}>
            {importing ? 'Import…' : `Importer ${mapRows.length} ligne(s)`}
          </Button>
        </>}
      >
        <p className="mb-3 text-sm text-muted">
          Associez chaque champ du contact à une colonne de votre fichier. Les colonnes ont été pré-mappées automatiquement ; ajustez si besoin. Au moins « Nom » ou « Nom complet » est requis.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONTACT_IMPORT_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <label className="w-1/2 shrink-0 text-sm text-fg">{f.label}</label>
              <select
                className="input flex-1"
                value={mapping[f.key] ?? ''}
                onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
              >
                <option value="">{f.key === 'type' ? '— Valeur fixe ↓ —' : '— Ignorer —'}</option>
                {mapHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              {/* Type non mappé à une colonne : on choisit une valeur fixe (types définis en base). */}
              {f.key === 'type' && !mapping.type && (
                <select className="input flex-1" value={mapType} onChange={(e) => setMapType(e.target.value as ContactType)} title="Type appliqué à tous les contacts importés">
                  {TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="mb-1 text-sm font-medium text-fg">Affectation</p>
          <select className="input max-w-xs" value={mapOwner} onChange={(e) => setMapOwner(e.target.value as 'none' | 'me')}>
            <option value="me">M'attribuer ces contacts</option>
            {isManager && <option value="none">Non affecté (à répartir ensuite)</option>}
          </select>
        </div>

        {/* Aperçu des 3 premières lignes selon le mapping */}
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium text-fg">Aperçu</p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-muted">
                <tr>{CONTACT_IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => <th key={f.key} className="px-2 py-1.5 text-left font-medium">{f.label}</th>)}</tr>
              </thead>
              <tbody>
                {mapRows.slice(0, 3).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {CONTACT_IMPORT_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <td key={f.key} className="px-2 py-1.5 text-fg">{r[mapping[f.key] as string] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Dédoublonnage par e-mail (ou téléphone/nom) ; réimporter le même fichier met à jour les contacts.</p>
        </div>
      </Modal>

      {fiche && (
        <ContactFiche
          /* `key` : remonte la fiche (et ses champs éditables) quand on change de contact.
             `contact` : version fraîche issue de la liste rechargée, sinon l'instantané. */
          key={fiche.id}
          contact={data.find((x) => x.id === fiche.id) ?? fiche}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          profiles={profiles.data}
          onClose={() => setFiche(null)}
          onEdit={(c) => { setFiche(null); openEdit(c); }}
          onUpdated={() => { refresh(); actionsCol.refresh(); }}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { X, Mail, Phone, Building2, User, Pencil, CircleCheck as CheckCircle2, Circle as XCircle, Calendar, Tag, TableProperties, NotebookPen, Save, Target, ClipboardList, TrendingUp, FolderKanban, CalendarDays, ListChecks, Coins, Plus, Trash2, FolderLock, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn, fullName, initials, formatDate, formatMoney, genReference } from '@/lib/utils';
import { CONTACT_TYPE_LABELS, DOSSIER_STATUT_LABELS, DOSSIER_STATUT_TONES, OPP_STAGE_LABELS } from '@/lib/constants';
import { Badge, type Tone } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import ComposeMessageModal from '@/components/ComposeMessageModal';
import type { Contact, Entreprise, Financeur, Profile, ContactAction, ContactDocument, Opportunite, Dossier, SessionFormation, SessionParticipant } from '@/lib/database.types';

const STATUTS_PROSPECT = ['', 'non assigné', 'nouveau', 'qualifié', 'en relance', 'rdv', 'gagné', 'perdu', 'sans suite'];
const ACTION_TYPES = ['appel', 'email', 'rdv', 'relance', 'note', 'autre'];

// ── Helpers date/heure pour le suivi des actions ────────────────────────────
const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const hm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
// Heure « HH:MM:SS » → « HH:MM » pour l'affichage.
const shortHeure = (h: string | null) => (h ? h.slice(0, 5) : '');
// Clé de tri chronologique (date + heure, heure vide triée en dernier).
const actionSortKey = (a: { date_action: string; heure_action: string | null }) => `${a.date_action}T${a.heure_action ?? '99:99'}`;

// Colonnes déjà affichées dans les champs principaux — on les masque dans metadata
const META_SKIP = new Set([
  'full_name', 'name', 'nom', 'prenom', 'email', 'phone', 'phone_number',
  'telephone', 'téléphone', 'company_name', 'entreprise', 'société', 'societe',
  'ville', 'city', '',
]);

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-muted">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm text-fg">{value}</p>
      </div>
    </div>
  );
}

interface Props {
  contact: Contact;
  entreprises: Entreprise[];
  financeurs: Financeur[];
  profiles: Profile[];
  onClose: () => void;
  onEdit: (c: Contact) => void;
  onUpdated: () => void;
}

export default function ContactFiche({ contact: c, entreprises, financeurs, profiles, onClose, onEdit, onUpdated }: Props) {
  const { session } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const entreprise = entreprises.find((e) => e.id === c.entreprise_id);
  const financeur = financeurs.find((f) => f.id === c.financeur_id);
  const owner = profiles.find((p) => p.id === c.owner_id);

  // ── Notes éditable ────────────────────────────────────────────────────────────
  const [notesValue, setNotesValue] = useState(c.notes ?? '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  const handleNotesSave = async () => {
    setNotesSaving(true);
    await supabase.from('contacts').update({ notes: notesValue || null }).eq('id', c.id);
    setNotesSaving(false);
    setNotesDirty(false);
    onUpdated();
  };

  // ── Statut transverse (pipeline / dossiers / sessions) ───────────────────────
  const [opps, setOpps] = useState<Opportunite[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [sessions, setSessions] = useState<SessionFormation[]>([]);
  const [actions, setActions] = useState<ContactAction[]>([]);
  const [coffre, setCoffre] = useState<ContactDocument[]>([]);

  const loadRefs = useCallback(async () => {
    const [o, d, sp, a, cd] = await Promise.all([
      supabase.from('opportunites').select('*').eq('contact_id', c.id).order('created_at', { ascending: false }),
      supabase.from('dossiers').select('*').eq('contact_id', c.id).order('created_at', { ascending: false }),
      supabase.from('session_participants').select('session_id').eq('contact_id', c.id),
      supabase.from('contact_actions').select('*').eq('contact_id', c.id).order('date_action', { ascending: false }).order('heure_action', { ascending: false, nullsFirst: false }),
      supabase.from('contact_documents').select('*').eq('contact_id', c.id).order('created_at', { ascending: false }),
    ]);
    setOpps(o.data ?? []); setDossiers(d.data ?? []); setActions(a.data ?? []); setCoffre(cd.data ?? []);
    const ids = ((sp.data ?? []) as Pick<SessionParticipant, 'session_id'>[]).map((x) => x.session_id);
    if (ids.length) {
      const s = await supabase.from('sessions_formation').select('*').in('id', ids).order('date_debut', { ascending: false });
      setSessions(s.data ?? []);
    } else setSessions([]);
  }, [c.id]);
  useEffect(() => { void loadRefs(); }, [loadRefs]);

  // ── Ajout d'opportunité / dossier / inscription à une session ────────────────
  const [allSessions, setAllSessions] = useState<SessionFormation[]>([]);
  useEffect(() => { supabase.from('sessions_formation').select('*').order('date_debut', { ascending: false }).then(({ data }) => setAllSessions(data ?? [])); }, []);
  const [addPanel, setAddPanel] = useState<'opp' | 'doss' | 'sess' | null>(null);
  const [busy, setBusy] = useState(false);
  const [newOpp, setNewOpp] = useState({ titre: '', montant: '' });
  const [newDoss, setNewDoss] = useState({ intitule: '' });
  const [enrollId, setEnrollId] = useState('');
  // Propriétaire = utilisateur courant (requis par la RLS d'écriture pour un conseiller).
  const ownerOf = session?.user.id ?? c.responsable_id ?? c.owner_id ?? null;

  const addOpp = async () => {
    if (!newOpp.titre.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('opportunites').insert({
      contact_id: c.id, entreprise_id: c.entreprise_id, financeur_id: c.financeur_id,
      titre: newOpp.titre.trim(), montant: Number(newOpp.montant) || 0, stage: 'nouveau', probabilite: 0, owner_id: ownerOf,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setNewOpp({ titre: '', montant: '' }); setAddPanel(null); loadRefs();
  };
  const addDoss = async () => {
    if (!newDoss.intitule.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('dossiers').insert({
      contact_id: c.id, entreprise_id: c.entreprise_id, financeur_id: c.financeur_id,
      reference: genReference('DOS'), intitule: newDoss.intitule.trim(), owner_id: ownerOf,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setNewDoss({ intitule: '' }); setAddPanel(null); loadRefs();
  };
  const enroll = async () => {
    if (!enrollId) return;
    setBusy(true);
    const { error } = await supabase.from('session_participants').insert({
      session_id: enrollId, contact_id: c.id, nom: c.nom, prenom: c.prenom, email: c.email, statut: 'inscrit',
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setEnrollId(''); setAddPanel(null); loadRefs();
  };
  // Sessions où le contact n'est pas déjà inscrit
  const enrollable = allSessions.filter((s) => !sessions.some((x) => x.id === s.id));

  // ── Coffre de documents rattachés au contact ─────────────────────────────────
  const addDoc = async (value: string, name?: string) => {
    const { error } = await supabase.from('contact_documents').insert({
      contact_id: c.id, titre: name || 'Document', fichier_url: value, created_by: session?.user.id ?? null,
    });
    if (error) { alert(error.message); return; }
    loadRefs();
  };
  const removeDoc = async (d: ContactDocument) => {
    if (!confirm(`Supprimer « ${d.titre} » ?`)) return;
    const { error } = await supabase.from('contact_documents').delete().eq('id', d.id);
    if (error) { alert(error.message); return; }
    loadRefs();
  };

  // ── Champs de suivi éditables ───────────────────────────────────────────────
  const [form, setForm] = useState({
    statut_entreprise: c.statut_entreprise ?? '', ville: c.ville ?? '', effectif: c.effectif ?? '',
    siret: c.siret ?? '', autres: c.autres ?? '',
    besoin_resume: c.besoin_resume ?? '', formation_envisagee: c.formation_envisagee ?? '',
    financement_envisage: c.financement_envisage ?? '', interet: c.interet ?? '',
    responsable_id: c.responsable_id ?? '', date_formation: c.date_formation ?? '',
    assiette_commission: c.assiette_commission ?? '',
  });
  const setFf = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const [savingSec, setSavingSec] = useState<string | null>(null);
  const saveSection = async (key: string, fields: Partial<Contact>) => {
    setSavingSec(key);
    await supabase.from('contacts').update(fields).eq('id', c.id);
    setSavingSec(null);
    onUpdated();
  };
  // Miroir local optimiste (la prop `c` reste figée tant que la liste n'est pas rechargée)
  const [over, setOver] = useState<Partial<Contact>>({});
  useEffect(() => { setOver({}); }, [c.id]);
  const cc = { ...c, ...over } as Contact;
  const patch = async (fields: Partial<Contact>) => {
    setOver((o) => ({ ...o, ...fields }));
    await supabase.from('contacts').update(fields).eq('id', c.id);
    onUpdated();
  };

  // Auto-enregistrement d'un champ à la perte de focus.
  // La comparaison porte sur le miroir `cc` (et non sur la prop `c`, figée) sans quoi
  // un retour à la valeur d'origine était considéré « inchangé » et n'était pas réécrit.
  // `onUpdated()` est indispensable : sans lui la liste parente restait périmée et la
  // fiche rouverte réaffichait les anciennes valeurs (ticket « qualification non enregistrée »).
  const [savedField, setSavedField] = useState<string | null>(null);
  const blurSave = async (field: keyof Contact, value: string) => {
    if ((cc[field] ?? '') === value) return; // pas de changement
    setOver((o) => ({ ...o, [field]: value || null }));
    const { error } = await supabase.from('contacts').update({ [field]: value || null } as Partial<Contact>).eq('id', c.id);
    if (error) { alert(`Enregistrement impossible : ${error.message}`); return; }
    setSavedField(field as string);
    setTimeout(() => setSavedField((s) => (s === field ? null : s)), 1500);
    onUpdated();
  };

  // ── Journal d'actions ───────────────────────────────────────────────────────
  const [na, setNa] = useState(() => { const d = new Date(); return { date_action: ymd(d), heure_action: hm(d), type: 'appel', description: '', faite: true }; });
  const sortActions = (list: ContactAction[]) => [...list].sort((x, y) => actionSortKey(y).localeCompare(actionSortKey(x)));
  const addAction = async () => {
    if (!na.description.trim()) return;
    // Détrompeur : une action datée dans le futur ne peut pas être « réalisée ».
    const faite = na.faite && na.date_action <= ymd(new Date());
    const { data } = await supabase.from('contact_actions')
      .insert({ contact_id: c.id, date_action: na.date_action, heure_action: na.heure_action || null, type: na.type, description: na.description.trim(), faite })
      .select().single();
    if (data) setActions((p) => sortActions([data, ...p]));
    setNa({ ...na, description: '' });
  };

  // Raccourcis : pré-remplissent le formulaire (type, description, date, heure)
  // SANS valider — l'utilisateur ajuste la description puis clique « Ajouter ».
  const prefillAction = (opts: { type: string; faite: boolean; when: Date; description: string }) =>
    setNa({
      type: opts.type, description: opts.description,
      date_action: ymd(opts.when), heure_action: hm(opts.when),
      faite: opts.faite && ymd(opts.when) <= ymd(new Date()),
    });
  const inMinutes = (m: number) => new Date(Date.now() + m * 60000);
  const atToday = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
  const tomorrowAt = (h: number) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d; };
  const QUICK_ACTIONS: { label: string; run: () => void }[] = [
    { label: 'Appel fait', run: () => prefillAction({ type: 'appel', faite: true, when: new Date(), description: 'Appel réalisé' }) },
    { label: 'Mail à envoyer', run: () => prefillAction({ type: 'email', faite: false, when: new Date(), description: 'Envoyer un e-mail (ASAP)' }) },
    { label: 'Rappel +15 min', run: () => prefillAction({ type: 'relance', faite: false, when: inMinutes(15), description: 'Rappeler' }) },
    { label: 'Rappel +1 h', run: () => prefillAction({ type: 'relance', faite: false, when: inMinutes(60), description: 'Rappeler' }) },
    { label: 'Cet après-midi', run: () => prefillAction({ type: 'relance', faite: false, when: atToday(14), description: 'Rappeler' }) },
    { label: 'Demain matin', run: () => prefillAction({ type: 'relance', faite: false, when: tomorrowAt(9), description: 'Rappeler' }) },
  ];
  const toggleAction = async (a: ContactAction) => {
    setActions((p) => p.map((x) => (x.id === a.id ? { ...x, faite: !x.faite } : x)));
    await supabase.from('contact_actions').update({ faite: !a.faite }).eq('id', a.id);
  };
  const removeAction = async (a: ContactAction) => {
    await supabase.from('contact_actions').delete().eq('id', a.id);
    setActions((p) => p.filter((x) => x.id !== a.id));
  };
  const derniere = actions.find((a) => a.faite);
  const prochaine = [...actions].reverse().find((a) => !a.faite);
  const now = new Date();
  const CHECKLIST: { key: keyof Contact; label: string }[] = [
    { key: 'eligibilite_verifiee', label: 'Éligibilité vérifiée' },
    { key: 'financement_demande', label: 'Financement demandé' },
    { key: 'financement_valide', label: 'Financement validé' },
    { key: 'inscription_validee', label: 'Inscription validée' },
  ];

  // Entrées metadata à afficher (exclut les doublons avec les champs principaux)
  const metaEntries = c.metadata
    ? Object.entries(c.metadata).filter(([k, v]) => k && !META_SKIP.has(k.toLowerCase().trim()) && v && String(v).trim())
    : [];

  // Fallback : parse le champ notes si pas de metadata structuré (anciens imports)
  const parsedNotes = !c.metadata && c.notes
    ? c.notes.split('\n').reduce<Array<[string, string]>>((acc, line) => {
        const idx = line.indexOf(' : ');
        if (idx > 0) acc.push([line.slice(0, idx).trim(), line.slice(idx + 3).trim()]);
        return acc;
      }, [])
    : [];

  const TYPE_TONE: Record<string, Tone> = {
    prospect: 'info',
    apprenant: 'success',
    contact_entreprise: 'warning',
    contact_financeur: 'brand',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-surface shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-line p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-base font-bold text-brand-600 dark:text-brand-400">
              {initials(c.nom, c.prenom)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-fg leading-tight">
                {c.civilite && <span className="text-muted font-normal">{c.civilite} </span>}
                {fullName(c.prenom, c.nom)}
              </h2>
              {c.fonction && <p className="text-sm text-muted">{c.fonction}</p>}
              <Badge className="mt-1" tone={TYPE_TONE[c.type] ?? 'neutral'}>
                {CONTACT_TYPE_LABELS[c.type]}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setComposeOpen(true)}
              className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-brand-600"
              title="Envoyer un e-mail / WhatsApp"
            >
              <Mail className="h-4 w-4" />
            </button>
            <button
              onClick={() => { onClose(); onEdit(c); }}
              className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-brand-600"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Coordonnées */}
          <section className="rounded-xl border border-line bg-surface-2/40 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Coordonnées</h3>
            <div className="space-y-3">
              {c.email ? (
                <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail"
                  value={
                    <span className="flex flex-wrap items-center gap-2">
                      <a href={`mailto:${c.email}`} className="text-brand-600 hover:underline dark:text-brand-400">{c.email}</a>
                      <button onClick={() => setComposeOpen(true)}
                        className="inline-flex items-center gap-1 rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-600 transition hover:bg-brand-500/20 dark:text-brand-400">
                        <Mail className="h-3 w-3" /> Écrire
                      </button>
                    </span>
                  }
                />
              ) : null}
              {c.telephone ? (
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Téléphone"
                  value={<a href={`tel:${c.telephone}`} className="text-brand-600 hover:underline dark:text-brand-400">{c.telephone}</a>}
                />
              ) : null}
              {!c.email && !c.telephone && (
                <p className="text-sm text-muted italic">Aucune coordonnée renseignée</p>
              )}
              {entreprise ? (
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="SIRET (entreprise)"
                  value={entreprise.siret || <span className="italic text-muted">non renseigné sur la fiche entreprise</span>} />
              ) : (
                <div>
                  <label className="label">SIRET (client) {savedField === 'siret' && <span className="text-xs text-emerald-600">enregistré ✓</span>}</label>
                  <input className="input" placeholder="N° SIRET du client — utilisé sur le devis / plan si aucune entreprise n'est reliée"
                    value={form.siret} onChange={(e) => setFf('siret', e.target.value)} onBlur={(e) => blurSave('siret', e.target.value)} />
                </div>
              )}
              <div>
                <label className="label">Autres coordonnées {savedField === 'autres' && <span className="text-xs text-emerald-600">enregistré ✓</span>}</label>
                <textarea className="input" rows={2} placeholder="Téléphones / e-mails supplémentaires…"
                  value={form.autres} onChange={(e) => setFf('autres', e.target.value)} onBlur={(e) => blurSave('autres', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Relations */}
          {(entreprise || financeur || owner) && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Relations</h3>
              <div className="space-y-3">
                {entreprise && (
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Entreprise"
                    value={<Link to={`/entreprises?open=${entreprise.id}`} onClick={onClose} title="Ouvrir la fiche entreprise" className="text-brand-600 hover:underline dark:text-brand-400">{entreprise.raison_sociale}</Link>} />
                )}
                {financeur && (
                  <InfoRow icon={<Tag className="h-4 w-4" />} label="Financeur" value={financeur.nom} />
                )}
                {owner && (
                  <InfoRow icon={<User className="h-4 w-4" />} label="Conseiller affecté"
                    value={fullName(owner.prenom, owner.nom)}
                  />
                )}
                {!owner && c.type === 'prospect' && (
                  <InfoRow icon={<User className="h-4 w-4" />} label="Conseiller affecté"
                    value={<span className="text-amber-600">Non affecté</span>}
                  />
                )}
              </div>
            </section>
          )}

          {/* Qualification */}
          <section className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Target className="h-4 w-4 text-muted" /><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Qualification</h3></div>
              <select value={cc.statut_prospect ?? ''} onChange={(e) => patch({ statut_prospect: e.target.value || null })}
                className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg">
                {STATUTS_PROSPECT.map((s) => <option key={s} value={s}>{s || '— statut —'}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <div><label className="label">Besoin résumé</label><textarea className="input" rows={2} value={form.besoin_resume} onChange={(e) => setFf('besoin_resume', e.target.value)} onBlur={(e) => blurSave('besoin_resume', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Ville / Région</label><input className="input" placeholder="ex. Saint-Denis / Nord" value={form.ville} onChange={(e) => setFf('ville', e.target.value)} onBlur={(e) => blurSave('ville', e.target.value)} /></div>
                <div><label className="label">Formation envisagée</label><input className="input" value={form.formation_envisagee} onChange={(e) => setFf('formation_envisagee', e.target.value)} onBlur={(e) => blurSave('formation_envisagee', e.target.value)} /></div>
                <div><label className="label">Financement envisagé</label><input className="input" value={form.financement_envisage} onChange={(e) => setFf('financement_envisage', e.target.value)} onBlur={(e) => blurSave('financement_envisage', e.target.value)} /></div>
                <div><label className="label">Intérêt</label><input className="input" value={form.interet} onChange={(e) => setFf('interet', e.target.value)} onBlur={(e) => blurSave('interet', e.target.value)} /></div>
                <div><label className="label">Effectif</label><input className="input" value={form.effectif} onChange={(e) => setFf('effectif', e.target.value)} onBlur={(e) => blurSave('effectif', e.target.value)} /></div>
                <div><label className="label">SIRET</label><input className="input" placeholder="14 chiffres" value={form.siret} onChange={(e) => setFf('siret', e.target.value)} onBlur={(e) => blurSave('siret', e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted">Enregistrement automatique à la sortie du champ {savedField && <span className="text-emerald-600">— enregistré ✓</span>}</p>
            </div>
          </section>

          {/* Suivi des actions */}
          <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="mb-3 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted" /><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Suivi des actions</h3></div>
            {(derniere || prochaine) && (
              <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-surface-2 p-2"><p className="text-muted">Dernière action</p><p className="font-medium text-fg">{derniere ? `${derniere.description} · ${formatDate(derniere.date_action)}${shortHeure(derniere.heure_action) ? ` ${shortHeure(derniere.heure_action)}` : ''}` : '—'}</p></div>
                <div className="rounded-lg bg-amber-500/10 p-2"><p className="text-amber-700 dark:text-amber-400">Prochaine action</p><p className="font-medium text-fg">{prochaine ? `${prochaine.description} · ${formatDate(prochaine.date_action)}${shortHeure(prochaine.heure_action) ? ` ${shortHeure(prochaine.heure_action)}` : ''}` : '—'}</p></div>
              </div>
            )}
            <ul className="space-y-1.5">
              {actions.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                  <button onClick={() => toggleAction(a)} title={a.faite ? 'Faite' : 'À faire'}
                    className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', a.faite ? 'bg-emerald-500 text-white' : 'border border-line text-transparent')}>
                    <CheckCircle2 className="h-3 w-3" />
                  </button>
                  <Badge className="bg-surface-2 text-muted">{a.type}</Badge>
                  <span className="flex-1 text-fg">{a.description}</span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(a.date_action)}{shortHeure(a.heure_action) ? ` · ${shortHeure(a.heure_action)}` : ''}</span>
                  <button onClick={() => removeAction(a)} className="rounded p-0.5 text-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
              {actions.length === 0 && <li className="text-sm text-muted">Aucune action enregistrée.</li>}
            </ul>
            {/* Actions rapides : planifient un rappel horodaté ou consignent une action faite */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((qa) => (
                <button key={qa.label} onClick={qa.run} className="rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-400">
                  {qa.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-2">
              <select className="input w-[90px] py-1.5" value={na.type} onChange={(e) => setNa({ ...na, type: e.target.value })}>{ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
              <input className="input min-w-[140px] flex-1 py-1.5" placeholder="Description…" value={na.description} onChange={(e) => setNa({ ...na, description: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addAction()} />
              <input className="input w-[130px] py-1.5" type="date" value={na.date_action} onChange={(e) => setNa((n) => ({ ...n, date_action: e.target.value, faite: e.target.value > ymd(new Date()) ? false : n.faite }))} />
              <input className="input w-[90px] py-1.5" type="time" value={na.heure_action} onChange={(e) => setNa({ ...na, heure_action: e.target.value })} title="Heure" />
              <label className="flex items-center gap-1.5 text-xs text-muted" title={na.date_action > ymd(new Date()) ? 'Une action datée dans le futur ne peut pas être déjà réalisée' : undefined}><input type="checkbox" checked={na.faite} disabled={na.date_action > ymd(new Date())} onChange={(e) => setNa({ ...na, faite: e.target.checked })} /> Réalisée</label>
              <button onClick={addAction} disabled={!na.description.trim()} className="btn-secondary py-1.5 text-sm"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
            </div>
          </section>

          {/* Pipeline, Sessions, Dossiers & Coffre — regroupés dans un même cadre */}
          <section className="space-y-5 rounded-xl border border-line bg-surface-2/40 p-4">
          {/* Pipeline */}
          <div>
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted" /><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Pipeline</h3></div><div className="flex items-center gap-2"><span className="text-xs text-muted">{opps.length}</span><button onClick={() => setAddPanel(addPanel === 'opp' ? null : 'opp')} title="Ajouter une opportunité" className="rounded p-0.5 text-muted hover:text-brand-600"><Plus className="h-3.5 w-3.5" /></button></div></div>
            {opps.length === 0 ? <p className="text-sm text-muted">Aucune opportunité.</p> : (
              <ul className="space-y-1.5">{opps.map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5 text-sm">
                  <span className="text-fg">{o.titre}</span>
                  <span className="flex items-center gap-2"><Badge tone="brand">{OPP_STAGE_LABELS[o.stage]}</Badge><span className="text-xs text-muted">{formatMoney(o.montant)}</span></span>
                </li>))}
              </ul>
            )}
            {addPanel === 'opp' && (
              <div className="mt-2 space-y-2 rounded-lg border border-line bg-surface-2 p-2">
                <input className="input" placeholder="Intitulé de l'opportunité" value={newOpp.titre} onChange={(e) => setNewOpp({ ...newOpp, titre: e.target.value })} />
                <div className="flex gap-2">
                  <input className="input" type="number" placeholder="Montant €" value={newOpp.montant} onChange={(e) => setNewOpp({ ...newOpp, montant: e.target.value })} />
                  <button onClick={addOpp} disabled={busy || !newOpp.titre.trim()} className="btn-primary shrink-0 py-1.5 text-sm"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
                </div>
              </div>
            )}
          </div>

          {/* Sessions (placées avant Dossiers) */}
          <div>
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted" /><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Sessions</h3></div><div className="flex items-center gap-2"><span className="text-xs text-muted">{sessions.length}</span><button onClick={() => setAddPanel(addPanel === 'sess' ? null : 'sess')} title="Inscrire à une session" className="rounded p-0.5 text-muted hover:text-brand-600"><Plus className="h-3.5 w-3.5" /></button></div></div>
            {sessions.length === 0 ? <p className="text-sm text-muted">Aucune session.</p> : (
              <ul className="space-y-1.5">{sessions.map((s) => {
                const passee = new Date(s.date_debut) < now;
                return (
                  <li key={s.id} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5 text-sm">
                    <span className="flex items-center gap-2 text-fg"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.couleur }} />{s.titre}</span>
                    <span className="flex items-center gap-2"><span className="text-xs text-muted">{formatDate(s.date_debut, 'dd/MM/yyyy')}</span><Badge tone={passee ? 'success' : 'warning'}>{passee ? 'Réalisée' : 'Programmée'}</Badge><Link to={`/calendrier?date=${(s.date_debut ?? '').slice(0, 10)}`} onClick={onClose} title="Voir dans le calendrier" className="rounded p-0.5 text-muted hover:text-brand-600"><CalendarDays className="h-3.5 w-3.5" /></Link></span>
                  </li>);
              })}</ul>
            )}
            {addPanel === 'sess' && (
              <div className="mt-2 flex gap-2 rounded-lg border border-line bg-surface-2 p-2">
                <select className="input" value={enrollId} onChange={(e) => setEnrollId(e.target.value)}>
                  <option value="">{enrollable.length ? 'Choisir une session…' : 'Aucune session disponible'}</option>
                  {enrollable.map((s) => <option key={s.id} value={s.id}>{s.titre} — {formatDate(s.date_debut, 'dd/MM/yyyy')}</option>)}
                </select>
                <button onClick={enroll} disabled={busy || !enrollId} className="btn-primary shrink-0 py-1.5 text-sm"><Plus className="h-3.5 w-3.5" /> Inscrire</button>
              </div>
            )}
          </div>

          {/* Dossiers */}
          <div>
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-muted" /><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Dossiers</h3></div><div className="flex items-center gap-2"><span className="text-xs text-muted">{dossiers.length}</span><button onClick={() => setAddPanel(addPanel === 'doss' ? null : 'doss')} title="Créer un dossier" className="rounded p-0.5 text-muted hover:text-brand-600"><Plus className="h-3.5 w-3.5" /></button></div></div>
            {dossiers.length === 0 ? <p className="text-sm text-muted">Aucun dossier.</p> : (
              <ul className="space-y-1.5">{dossiers.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-fg">{d.intitule}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={DOSSIER_STATUT_TONES[d.statut]}>{DOSSIER_STATUT_LABELS[d.statut]}</Badge>
                    <Link to={`/dossiers/${d.id}`} onClick={onClose} title="Ouvrir le dossier" className="rounded p-0.5 text-muted hover:text-brand-600"><FileText className="h-3.5 w-3.5" /></Link>
                  </span>
                </li>))}
              </ul>
            )}
            {addPanel === 'doss' && (
              <div className="mt-2 flex gap-2 rounded-lg border border-line bg-surface-2 p-2">
                <input className="input" placeholder="Intitulé du dossier" value={newDoss.intitule} onChange={(e) => setNewDoss({ intitule: e.target.value })} />
                <button onClick={addDoss} disabled={busy || !newDoss.intitule.trim()} className="btn-primary shrink-0 py-1.5 text-sm"><Plus className="h-3.5 w-3.5" /> Créer</button>
              </div>
            )}
          </div>

          {/* Coffre de documents */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><FolderLock className="h-4 w-4 text-muted" /><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Coffre — documents</h3></div>
              <div className="flex items-center gap-2"><span className="text-xs text-muted">{coffre.length}</span><FileUpload bucket="coffre" label="Ajouter" onUploaded={(v, f) => addDoc(v, f?.name)} /></div>
            </div>
            {coffre.length === 0 ? <p className="text-sm text-muted">Aucun document. Téléversez pièces, justificatifs, échanges…</p> : (
              <ul className="space-y-1.5">{coffre.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-fg"><FileText className="h-4 w-4 shrink-0 text-brand-500" /><span className="truncate">{d.titre}</span></span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-muted">{formatDate(d.created_at)}</span>
                    <FileLink bucket="coffre" value={d.fichier_url} />
                    <button onClick={() => removeDoc(d)} className="rounded p-0.5 text-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </span>
                </li>))}
              </ul>
            )}
          </div>
          </section>

          {/* Checklist conformité */}
          <section className="rounded-xl border border-line bg-surface-2/40 p-4">
            <div className="mb-3 flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted" /><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Checklist conformité dossier</h3></div>
            <div className="mb-2"><label className="label">Date fixée</label><input className="input" type="date" value={cc.date_fixee ?? ''} onChange={(e) => patch({ date_fixee: e.target.value || null })} /></div>
            <div className="space-y-1.5">{CHECKLIST.map((item) => (
              <label key={String(item.key)} className="flex items-center gap-2 text-sm text-fg">
                <input type="checkbox" checked={Boolean(cc[item.key])} onChange={() => patch({ [item.key]: !cc[item.key] } as Partial<Contact>)} /> {item.label}
              </label>))}
            </div>
          </section>

          {/* Commissions */}
          <section className="rounded-xl border border-line bg-surface-2/40 p-4">
            <div className="mb-3 flex items-center gap-2"><Coins className="h-4 w-4 text-muted" /><h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Commissions</h3></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Date formation</label><input className="input" type="date" value={form.date_formation ?? ''} onChange={(e) => setFf('date_formation', e.target.value)} /></div>
              <div><label className="label">Assiette (€)</label><input className="input" type="number" value={form.assiette_commission ?? ''} onChange={(e) => setFf('assiette_commission', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={cc.commission_validee} onChange={() => patch({ commission_validee: !cc.commission_validee })} /> Validée</label>
              <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={cc.commission_payee} onChange={() => patch({ commission_payee: !cc.commission_payee })} /> Payée</label>
            </div>
            <button onClick={() => saveSection('comm', { date_formation: form.date_formation || null, assiette_commission: form.assiette_commission ? Number(form.assiette_commission) : null })}
              disabled={savingSec === 'comm'} className="btn-secondary mt-2 py-1.5 text-sm"><Save className="h-3.5 w-3.5" /> {savingSec === 'comm' ? '…' : 'Enregistrer'}</button>
          </section>

          {/* RGPD + dates */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Informations</h3>
            <div className="space-y-3">
              <InfoRow
                icon={c.rgpd_consent ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                label="Consentement RGPD"
                value={c.rgpd_consent ? 'Recueilli' : 'Non recueilli'}
              />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Créé"
                value={`${formatDate(c.created_at)} · ${formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}`}
              />
            </div>
          </section>

          {/* Notes texte libre */}
          {c.notes && metaEntries.length === 0 && parsedNotes.length === 0 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Notes</h3>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-fg leading-relaxed">{c.notes}</p>
            </section>
          )}

          {/* Données importées (metadata structuré ou notes parsées) */}
          {(metaEntries.length > 0 || parsedNotes.length > 0) && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Données importées</h3>
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {(metaEntries.length > 0 ? metaEntries : parsedNotes).map(([key, val]) => (
                      <tr key={key} className="hover:bg-surface-2">
                        <td className="w-2/5 px-3 py-2 text-xs font-medium text-muted align-top">
                          {key.replace(/_/g, ' ').replace(/\?+/g, '?')}
                        </td>
                        <td className="px-3 py-2 text-fg align-top break-words">
                          {String(val)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {metaEntries.length > 0
                  ? `${metaEntries.length} champ(s) issus du fichier importé`
                  : 'Données reconstruites depuis le champ notes — re-importez pour obtenir la vue structurée'}
              </p>
            </section>
          )}

          {/* Notes conseiller */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Notes conseiller</h3>
              </div>
              {notesDirty && (
                <button
                  onClick={handleNotesSave}
                  disabled={notesSaving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400"
                >
                  <Save className="h-3 w-3" />
                  {notesSaving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              )}
            </div>
            <textarea
              className="input min-h-[88px] resize-y text-sm"
              placeholder="Observations, rappels, informations de suivi…"
              value={notesValue}
              onChange={(e) => { setNotesValue(e.target.value); setNotesDirty(true); }}
            />
            {!notesDirty && (
              <p className="mt-1 text-xs text-muted">Modifiez pour sauvegarder</p>
            )}
          </section>
        </div>

        {/* Pied */}
        <div className="border-t border-line px-5 py-3 flex items-center justify-between gap-2">
          <div>
            {notesDirty && (
              <button
                onClick={handleNotesSave}
                disabled={notesSaving}
                className="btn-primary text-sm py-2"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {notesSaving ? 'Sauvegarde…' : 'Sauvegarder les notes'}
              </button>
            )}
          </div>
          <button
            onClick={() => { onClose(); onEdit(c); }}
            className="btn-secondary text-sm"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier ce contact
          </button>
        </div>
      </div>

      {/* Envoi rapide e-mail / WhatsApp depuis la fiche (modale partagée Messagerie) */}
      <ComposeMessageModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => { void loadRefs(); onUpdated(); }}
        initial={{ canal: 'email', dest: c.email ?? '', contactId: c.id }}
      />
    </>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, Mail, Phone, Search, CloudDownload as DownloadCloud, FileSpreadsheet, UserCheck, ClipboardList, Tag, Columns3, Undo2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Badge, Spinner, EmptyState } from '@/components/ui';
import { CONTACT_TYPE_LABELS, OPP_STAGE_LABELS } from '@/lib/constants';
import { fullName, formatDate } from '@/lib/utils';
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

const TYPES: ContactType[] = ['prospect', 'contact', 'apprenant', 'contact_entreprise', 'contact_financeur'];

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
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [affFilter, setAffFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [statutFilter, setStatutFilter] = useState<string>('');
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

  const [distributing, setDistributing] = useState(false);

  // Affectation d'un prospect à un conseiller (managers uniquement)
  const assign = async (c: Contact, ownerId: string) => {
    const { error } = await supabase.from('contacts').update({ owner_id: ownerId || null }).eq('id', c.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  // Répartition round-robin des prospects non affectés sur les conseillers actifs
  const distribute = async () => {
    const ids = profiles.data.filter((p) => p.role === 'conseiller' && p.actif).map((p) => p.id);
    if (!ids.length) { alert('Aucun conseiller actif : affectez les prospects manuellement.'); return; }
    const targets = data.filter((c) => c.type === 'prospect' && !c.owner_id);
    if (!targets.length) { alert('Aucun prospect non affecté.'); return; }
    setDistributing(true);
    for (let i = 0; i < targets.length; i++) {
      await supabase.from('contacts').update({ owner_id: ids[i % ids.length] }).eq('id', targets[i].id);
    }
    setDistributing(false);
    refresh();
    alert(`${targets.length} prospect(s) répartis sur ${ids.length} conseiller(s) (round-robin).`);
  };

  const ownerName = (id: string | null) => {
    const p = profiles.data.find((x) => x.id === id);
    return p ? fullName(p.prenom, p.nom) : '—';
  };
  const nonAffectes = data.filter((c) => c.type === 'prospect' && !c.owner_id).length;
  // Conseillers attribuables : actifs et approuvés uniquement (pas d'inactif en attente).
  const assignables = profiles.data.filter((p) => (p.role === 'conseiller' || p.role === 'directeur_commercial') && p.actif && p.approved);
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
    const { error } = form.id
      ? await supabase.from('contacts').update(payload).eq('id', form.id)
      : await supabase.from('contacts').insert(payload);
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
    const newTags = isAssist ? ['Assistance'] : [];
    let existing: Contact | null = null;
    if (intake.email.trim()) {
      const { data: ex } = await supabase.from('contacts').select('*').eq('email', intake.email.trim()).limit(1).maybeSingle();
      existing = ex as Contact | null;
    }
    let error;
    if (existing) {
      const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...newTags]));
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
        statut_prospect: 'nouveau', besoin_resume: intake.message.trim() || null,
        formation_envisagee: intake.requestType || null,
        notes: 'Saisie interne (formulaire)' + (intake.company.trim() ? ' — entreprise : ' + intake.company.trim() : ''),
        tags: newTags, owner_id: null, // tag seul, pas d'affectation
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

  const set = (k: keyof Contact, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

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
          <Button variant="secondary" onClick={distribute} disabled={distributing}>
            <UserCheck className="h-4 w-4" /> {distributing ? 'Répartition…' : 'Répartir (round-robin)'}
          </Button>
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
        <Table head={
          <tr>
            <th className="px-4 py-3">Nom</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Coordonnées</th>
            <th className="px-4 py-3">Affectation</th>
            <th className="px-4 py-3">Pilotage</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {filtered.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer hover:bg-surface-2"
              onClick={() => setFiche(c)}
            >
              <td className="px-4 py-3 font-medium text-fg">
                {fullName(c.prenom, c.nom)}
                {c.fonction && <span className="block text-xs font-normal text-muted">{c.fonction}</span>}
                {(c.tags ?? []).length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {(c.tags ?? []).map((t) => (
                      <Badge key={t} tone={t.toLowerCase() === 'assistance' ? 'info' : 'neutral'}>
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
                    {/* Garde l'affecté courant visible même s'il n'est plus actif. */}
                    {c.owner_id && !assignables.some((p) => p.id === c.owner_id) && (
                      <option value={c.owner_id}>{ownerName(c.owner_id)} (inactif)</option>
                    )}
                  </select>
                ) : (
                  <span className="text-xs text-muted">{c.owner_id ? ownerName(c.owner_id) : <Badge tone="warning">Non affecté</Badge>}</span>
                )}
              </td>
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
                    {stageOf[c.id] && <Badge tone="brand">{OPP_STAGE_LABELS[stageOf[c.id]]}</Badge>}
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
      )}

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
          contact={fiche}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          profiles={profiles.data}
          onClose={() => setFiche(null)}
          onEdit={(c) => { setFiche(null); openEdit(c); }}
          onUpdated={refresh}
        />
      )}
    </div>
  );
}

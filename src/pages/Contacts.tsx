import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Mail, Phone, Search, CloudDownload as DownloadCloud, FileSpreadsheet, UserCheck, ClipboardList, Tag, Columns3, Undo2, Users } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Table, Badge, Spinner, EmptyState, ActionMenu } from '@/components/ui';
import { CONTACT_TYPE_LABELS } from '@/lib/constants';
import { cn, fullName } from '@/lib/utils';
import { importProspectsFile, parseSpreadsheetWithHeaders } from '@/lib/importExcel';
import ContactFiche from '@/components/ContactFiche';
import DoublonsContacts from '@/components/DoublonsContacts';
import type {
  Contact, ContactType, Entreprise, Financeur, Profile,
  ContactAction, Opportunite, SessionParticipant, SessionFormation, ImportBatch,
} from '@/lib/database.types';
import { TODAY, REFRESH_MS, TYPES, empty, type MailSeed, type NouveauContactState } from './contacts/constantes';
import { indexerPilotage } from './contacts/pilotage';
import { CelluleSuivi } from './contacts/CelluleSuivi';
import { BarreSelection } from './contacts/BarreSelection';
import { ModaleRepartition } from './contacts/ModaleRepartition';
import { ModaleContact } from './contacts/ModaleContact';
import { ModaleSaisieDemande } from './contacts/ModaleSaisieDemande';
import { ModaleImportCsv } from './contacts/ModaleImportCsv';
import { ModaleImportsRecents } from './contacts/ModaleImportsRecents';

/**
 * Liste des contacts : filtres, tri, pagination, sélection et imports. Les modales, la barre
 * d'actions de masse et la cellule « Suivi » sont dans `contacts/` ; cette page charge les
 * données et tient l'état de la liste.
 */
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


  // Index contact_id -> info de pilotage
  const pilotage = useMemo(
    () => indexerPilotage(actionsCol.data, oppsCol.data, partsCol.data, sessCol.data),
    [actionsCol.data, oppsCol.data, partsCol.data, sessCol.data],
  );
  const { nextAction, lastInteraction } = pilotage;

  // Modale « Nouveau contact / Modifier » : le contact de départ, et le mail à journaliser
  // en actions quand le contact est créé depuis la Messagerie.
  const [edition, setEdition] = useState<{ contact: Partial<Contact>; mailSeed: MailSeed | null } | null>(null);

  // Arrivée depuis la Messagerie : ouvre « Nouveau contact » pré-rempli.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const seed = (location.state as { nouveauContact?: NouveauContactState } | null)?.nouveauContact;
    if (!seed) return;
    setEdition({
      contact: { ...empty(), nom: seed.nom, prenom: seed.prenom, email: seed.email, telephone: seed.telephone },
      mailSeed: seed.actionsMessagerie,
    });
    // L'état de navigation est consommé : un rafraîchissement ne doit pas rouvrir la modale.
    navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);
  const [q, setQ] = useState('');
  // Affichage par défaut : les prospects (cœur du travail de prospection).
  const [typeFilter, setTypeFilter] = useState<string>('prospect');
  const [affFilter, setAffFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [statutFilter, setStatutFilter] = useState<string>('');
  // Filtre de suivi : qui relancer en premier.
  const [suiviFilter, setSuiviFilter] = useState<'' | 'retard' | 'sans' | 'jamais'>('');
  const [importsOpen, setImportsOpen] = useState(false);
  // Pagination (côté client, sur le résultat filtré)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Tri par colonne (Nom / Type / Affectation)
  const [sort, setSort] = useState<{ col: 'nom' | 'type' | 'aff' | null; dir: 'asc' | 'desc' }>({ col: null, dir: 'asc' });
  const toggleSort = (col: 'nom' | 'type' | 'aff') => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  const sortArrow = (col: 'nom' | 'type' | 'aff') => (sort.col === col ? (sort.dir === 'asc' ? '↑' : '↓') : '↕');
  // Saisie interne (formulaire de demande)
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fiche, setFiche] = useState<Contact | null>(null);
  const [doublonsOpen, setDoublonsOpen] = useState(false);
  // Ouverture directe d'une fiche via /contacts?id=… (recherche globale Ctrl+K).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id || loading) return;
    const c = data.find((x) => x.id === id);
    if (c) setFiche(c);
    searchParams.delete('id');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Import CSV avec mapping de colonnes
  const mapFileRef = useRef<HTMLInputElement>(null);
  const [mapFile, setMapFile] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
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
    void batches.refresh();
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
      void batches.refresh();
      void refresh();
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
  useEffect(() => { setPage(1); }, [q, typeFilter, affFilter, tagFilter, statutFilter, suiviFilter, pageSize, sort.col, sort.dir]);

  const [distributing, setDistributing] = useState(false);
  // Sélection multiple + répartition round-robin (managers)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rrOpen, setRrOpen] = useState(false);

  // Affectation d'un prospect à un conseiller (managers uniquement)
  const assign = async (c: Contact, ownerId: string) => {
    const { error } = await supabase.from('contacts').update({ owner_id: ownerId || null }).eq('id', c.id);
    if (error) { alert(error.message); return; }
    void refresh();
  };

  const openRoundRobin = () => setRrOpen(true);

  // Cibles de la répartition : la sélection si présente, sinon tous les prospects non affectés.
  const rrTargets = (): Contact[] => selected.size
    ? data.filter((c) => selected.has(c.id))
    : data.filter((c) => c.type === 'prospect' && !c.owner_id);

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
      void refresh();
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
      setMapFile({ headers, rows });
    } catch (err) {
      alert(`Lecture du CSV impossible : ${err instanceof Error ? err.message : String(err)}`);
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
    const p = (res as { prospects?: { importes?: number; releads?: number } })?.prospects;
    void refresh();
    const relead = p?.releads
      ? ` ${p.releads} prospect(s) déjà connu(s) ont redéposé le formulaire : fiche annotée et repassée en « nouveau ».`
      : '';
    alert(`${p?.importes ?? 0} nouveau(x) prospect(s) importé(s) depuis Google Sheets, en « non affecté ».${relead}`);
  };

  const openNew = () => setEdition({ contact: empty(), mailSeed: null });
  const openEdit = (c: Contact) => setEdition({ contact: c, mailSeed: null });

  const allTags = [...new Set(data.flatMap((c) => c.tags ?? []))].sort();

  const entrepriseDe = (c: Contact) => entreprises.data.find((e) => e.id === c.entreprise_id)?.raison_sociale ?? '';
  // Recherche sans accents ni casse, sur le nom, l'e-mail, le téléphone et l'entreprise.
  const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const chiffres = (v: string) => v.replace(/\D/g, '');
  const needle = norm(q.trim());
  const needleTel = chiffres(q);
  const matchSuivi = (c: Contact) => {
    if (!suiviFilter) return true;
    if (suiviFilter === 'retard') return !!nextAction[c.id] && nextAction[c.id].date_action < TODAY;
    if (suiviFilter === 'sans') return !nextAction[c.id];
    return !lastInteraction[c.id];
  };
  // Tout sauf le type : sert aussi aux compteurs des pastilles de type.
  const horsType = data.filter((c) => {
    const matchQ = !needle
      || norm(`${c.nom ?? ''} ${c.prenom ?? ''} ${c.email ?? ''} ${entrepriseDe(c)}`).includes(needle)
      || (needleTel.length >= 4 && chiffres(c.telephone ?? '').includes(needleTel));
    const matchAff = !affFilter || (affFilter === 'non' ? !c.owner_id : c.owner_id === affFilter);
    const matchTag = !tagFilter || (c.tags ?? []).includes(tagFilter);
    const matchStatut = !statutFilter || (c.statut_prospect ?? '') === statutFilter;
    return matchQ && matchAff && matchTag && matchStatut && matchSuivi(c);
  });
  const filtered = typeFilter ? horsType.filter((c) => c.type === typeFilter) : horsType;
  const parType = (t: ContactType) => horsType.filter((c) => c.type === t).length;
  // Pastilles : les types réellement présents (et celui qui est sélectionné).
  const typesAffiches = TYPES.filter((t) => t === typeFilter || data.some((c) => c.type === t));
  const filtresActifs = [q, affFilter, tagFilter, statutFilter, suiviFilter].filter(Boolean).length;
  const effacerFiltres = () => { setQ(''); setAffFilter(''); setTagFilter(''); setStatutFilter(''); setSuiviFilter(''); };

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

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Cliquez sur une ligne pour ouvrir la fiche du contact"
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importFile} />
            <input ref={mapFileRef} type="file" accept=".csv" className="hidden" onChange={openMapping} />
            <ActionMenu
              items={[
                { label: 'Importer un fichier CSV', hint: 'Vous choisissez à quoi correspond chaque colonne', icon: <Columns3 className="h-4 w-4" />, onClick: () => mapFileRef.current?.click(), disabled: importing },
                { label: 'Import rapide de prospects (CSV)', hint: 'Colonnes reconnues seules, répartition entre conseillers', icon: <FileSpreadsheet className="h-4 w-4" />, onClick: () => fileRef.current?.click(), disabled: importing },
                { label: 'Récupérer les prospects du Google Sheet', icon: <DownloadCloud className="h-4 w-4" />, onClick: importProspects, disabled: importing, hidden: !isManager },
                { label: `Annuler un import récent (${batches.data.length})`, icon: <Undo2 className="h-4 w-4" />, onClick: () => setImportsOpen(true), hidden: batches.data.length === 0 },
                { label: 'Fusionner les doublons', icon: <Users className="h-4 w-4" />, onClick: () => setDoublonsOpen(true) },
                { label: 'Saisir une demande reçue', hint: 'Comme le formulaire du site : crée ou met à jour le contact', icon: <ClipboardList className="h-4 w-4" />, onClick: () => setIntakeOpen(true), hidden: !isManager },
              ]}
            />
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
            <UserCheck className="h-4 w-4" /> {distributing ? 'Répartition…' : 'Répartir entre les conseillers'}
          </Button>
        </div>
      )}

      {isManager && selected.size > 0 && (
        <BarreSelection
          selected={selected}
          setSelected={setSelected}
          assignables={assignables}
          ownerName={ownerName}
          distributing={distributing}
          setDistributing={setDistributing}
          refresh={refresh}
          openRoundRobin={openRoundRobin}
        />
      )}

      {/* Type de contact : une pastille par type présent, avec son effectif */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[...typesAffiches.map((t) => ({ cle: t as string, label: CONTACT_TYPE_LABELS[t], n: parType(t) })), { cle: '', label: 'Tous', n: horsType.length }].map((p) => (
          <button
            key={p.cle || 'tous'}
            onClick={() => setTypeFilter(p.cle)}
            aria-pressed={typeFilter === p.cle}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition',
              typeFilter === p.cle
                ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                : 'border-line text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            {p.label} <span className="text-xs tabular-nums opacity-70">{p.n}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input className="input pl-9" placeholder="Nom, e-mail, téléphone, entreprise…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input max-w-[210px]" value={suiviFilter} onChange={(e) => setSuiviFilter(e.target.value as typeof suiviFilter)} title="Qui relancer en premier">
          <option value="">Tout le suivi</option>
          <option value="retard">Action en retard</option>
          <option value="sans">Aucune action prévue</option>
          <option value="jamais">Jamais contacté</option>
        </select>
        {isManager && (
          <select className="input max-w-[210px]" value={affFilter} onChange={(e) => setAffFilter(e.target.value)}>
            <option value="">Tous les conseillers</option>
            <option value="non">Non affectés</option>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
          </select>
        )}
        {statutsPresents.length > 0 && (
          <select className="input max-w-[190px]" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="">Tous les statuts</option>
            {statutsPresents.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {allTags.length > 0 && (
          <select className="input max-w-[190px]" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Tous les tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {filtresActifs > 0 && (
          <button onClick={effacerFiltres} className="text-sm font-medium text-muted underline-offset-2 hover:text-fg hover:underline">Effacer les filtres</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={data.length === 0 ? 'Aucun contact' : 'Aucun contact ne correspond'}
          message={data.length === 0 ? 'Créez votre premier contact pour démarrer.' : 'Changez de type ou effacez les filtres pour élargir la liste.'}
        />
      ) : (
        <>
        <Table head={
          <tr>
            {isManager && (
              <th className="px-4 py-3 w-0"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Tout sélectionner (résultat filtré, toutes pages)" /></th>
            )}
            <th className="px-4 py-3"><button onClick={() => toggleSort('nom')} className="inline-flex items-center gap-1 hover:text-fg">Nom <span className="text-xs text-muted">{sortArrow('nom')}</span></button></th>
            <th className="px-4 py-3">Coordonnées</th>
            <th className="px-4 py-3"><button onClick={() => toggleSort('aff')} className="inline-flex items-center gap-1 hover:text-fg">Conseiller <span className="text-xs text-muted">{sortArrow('aff')}</span></button></th>
            <th className="px-4 py-3" title="Prochaine action prévue, puis dernier contact réalisé">Suivi</th>
            <th className="px-4 py-3 w-0"></th>
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
                <span className="flex flex-wrap items-center gap-2">
                  {fullName(c.prenom, c.nom)}
                  {!typeFilter && <Badge tone="brand">{CONTACT_TYPE_LABELS[c.type]}</Badge>}
                  {c.statut_prospect && <Badge tone="neutral">{c.statut_prospect}</Badge>}
                </span>
                {(c.fonction || entrepriseDe(c)) && (
                  <span className="block text-xs font-normal text-muted">{[c.fonction, entrepriseDe(c)].filter(Boolean).join(' · ')}</span>
                )}
                {(c.tags ?? []).length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {(c.tags ?? []).map((t) => (
                      <Badge key={t} tone={t.toLowerCase() === 'assistance' || t.toLowerCase() === 'agent ia' ? 'info' : t.toLowerCase() === 'nouveau prospect' ? 'warning' : 'neutral'}>
                        <Tag className="mr-1 h-3 w-3" />{t}
                      </Badge>
                    ))}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) e.stopPropagation(); }}>
                {c.telephone && <a href={`tel:${c.telephone}`} title="Appeler" className="flex w-fit items-center gap-1 text-xs hover:text-brand-600"><Phone className="h-3 w-3" />{c.telephone}</a>}
                {c.email && <span className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3" />{c.email}</span>}
                {!c.email && !c.telephone && <span className="text-xs">—</span>}
              </td>
              <td className="px-4 py-3">
                {isManager ? (
                  <select
                    className={`input max-w-[180px] py-1 text-xs ${!c.owner_id ? 'border-brand-500/50 text-brand-700 dark:text-brand-300' : ''}`}
                    value={c.owner_id ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { e.stopPropagation(); void assign(c, e.target.value); }}
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
              <td className="px-4 py-3"><CelluleSuivi c={c} pilotage={pilotage} /></td>
              <td className="px-4 py-3">
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(c)} title="Modifier le contact" className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
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

      {rrOpen && (
        <ModaleRepartition
          assignables={assignables}
          targets={rrTargets()}
          surSelection={selected.size > 0}
          distributing={distributing}
          setDistributing={setDistributing}
          setSelected={setSelected}
          refresh={refresh}
          onClose={() => setRrOpen(false)}
        />
      )}

      {edition && (
        <ModaleContact
          initial={edition.contact}
          mailSeed={edition.mailSeed}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          userId={session?.user.id}
          onClose={() => setEdition(null)}
          refresh={refresh}
          onActionsSeeded={() => { void actionsCol.refresh(); }}
        />
      )}

      <ModaleImportsRecents
        open={importsOpen}
        onClose={() => setImportsOpen(false)}
        batches={batches.data}
        undoBatch={undoBatch}
        importing={importing}
      />

      {intakeOpen && <ModaleSaisieDemande onClose={() => setIntakeOpen(false)} refresh={refresh} />}

      {mapFile && (
        <ModaleImportCsv
          mapHeaders={mapFile.headers}
          mapRows={mapFile.rows}
          isManager={isManager}
          userId={session?.user.id}
          importing={importing}
          setImporting={setImporting}
          recordImport={recordImport}
          refresh={refresh}
          onClose={() => setMapFile(null)}
        />
      )}

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
          onUpdated={() => { void refresh(); void actionsCol.refresh(); }}
        />
      )}

      <DoublonsContacts
        open={doublonsOpen}
        onClose={() => setDoublonsOpen(false)}
        contacts={data}
        isManager={isManager}
        onMerged={() => { void refresh(); void actionsCol.refresh(); void oppsCol.refresh(); }}
      />
    </div>
  );
}

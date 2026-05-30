import { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, Mail, Phone, Search, CloudDownload as DownloadCloud, FileSpreadsheet, UserCheck } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Badge, Spinner, EmptyState } from '@/components/ui';
import { CONTACT_TYPE_LABELS } from '@/lib/constants';
import { fullName } from '@/lib/utils';
import { importProspectsFile } from '@/lib/importExcel';
import ContactFiche from '@/components/ContactFiche';
import type { Contact, ContactType, Entreprise, Financeur, Profile } from '@/lib/database.types';

const REFRESH_MS = 5 * 60 * 1000; // rafraîchissement auto des prospects (5 min)

const TYPES: ContactType[] = ['prospect', 'apprenant', 'contact_entreprise', 'contact_financeur'];

const empty = (): Partial<Contact> => ({
  type: 'prospect', civilite: '', nom: '', prenom: '', email: '',
  telephone: '', fonction: '', entreprise_id: null, financeur_id: null, rgpd_consent: false, notes: '',
});

export default function Contacts() {
  const { session, isManager } = useAuth();
  const { data, loading, refresh } = useCollection<Contact>('contacts', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>(empty());
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [affFilter, setAffFilter] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [fiche, setFiche] = useState<Contact | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // Import des prospects depuis un fichier Excel/CSV (parse navigateur, insert via session)
  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      // Round-robin sur les conseillers actifs ; si aucun -> non affecté (manuel)
      const r = await importProspectsFile(file, session?.user.id);
      refresh();
      alert(`${r.importes} nouveau(x) prospect(s) importé(s) sur ${r.lus} ligne(s) — répartis en round-robin.`);
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

  const openNew = () => { setForm(empty()); setOpen(true); };
  const openEdit = (c: Contact) => { setForm(c); setOpen(true); };

  const save = async () => {
    setSaving(true);
    const payload = { ...form, owner_id: form.owner_id ?? session?.user.id };
    const { error } = form.id
      ? await supabase.from('contacts').update(payload).eq('id', form.id)
      : await supabase.from('contacts').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  const remove = async (c: Contact) => {
    if (!confirm(`Supprimer le contact ${fullName(c.prenom, c.nom)} ?`)) return;
    const { error } = await supabase.from('contacts').delete().eq('id', c.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const filtered = data.filter((c) => {
    const matchQ = `${c.nom} ${c.prenom} ${c.email}`.toLowerCase().includes(q.toLowerCase());
    const matchType = !typeFilter || c.type === typeFilter;
    const matchAff = !affFilter || (affFilter === 'non' ? !c.owner_id : c.owner_id === affFilter);
    return matchQ && matchType && matchAff;
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
            <Button variant="secondary" onClick={importProspects} disabled={importing} title="Depuis le Google Sheet configuré">
              <DownloadCloud className="h-4 w-4" /> Sheets
            </Button>
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
              </td>
              <td className="px-4 py-3"><Badge className="bg-brand-50 text-brand-700">{CONTACT_TYPE_LABELS[c.type]}</Badge></td>
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
                    {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
                  </select>
                ) : (
                  <span className="text-xs text-muted">{c.owner_id ? ownerName(c.owner_id) : <Badge className="bg-amber-100 text-amber-700">Non affecté</Badge>}</span>
                )}
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
            <Field label="Notes"><textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={!!form.rgpd_consent} onChange={(e) => set('rgpd_consent', e.target.checked)} />
            Consentement RGPD recueilli
          </label>
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

import { useState } from 'react';
import { Plus, Pencil, Trash2, Mail, Phone, Search, DownloadCloud } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Badge, Spinner, EmptyState } from '@/components/ui';
import { CONTACT_TYPE_LABELS } from '@/lib/constants';
import { fullName } from '@/lib/utils';
import type { Contact, ContactType, Entreprise, Financeur } from '@/lib/database.types';

const TYPES: ContactType[] = ['prospect', 'apprenant', 'contact_entreprise', 'contact_financeur'];

const empty = (): Partial<Contact> => ({
  type: 'prospect', civilite: '', nom: '', prenom: '', email: '',
  telephone: '', fonction: '', entreprise_id: null, financeur_id: null, rgpd_consent: false, notes: '',
});

export default function Contacts() {
  const { session } = useAuth();
  const { data, loading, refresh } = useCollection<Contact>('contacts', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>(empty());
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [importing, setImporting] = useState(false);

  // Import des prospects depuis le Google Sheet (Edge Function import-sheets)
  const importProspects = async () => {
    setImporting(true);
    const { data: res, error } = await supabase.functions.invoke('import-sheets', { body: { source: 'prospects', owner_id: session?.user.id } });
    setImporting(false);
    if (error) {
      alert("Import indisponible : déployez l'Edge Function « import-sheets ».");
      return;
    }
    const p = (res as { prospects?: { importes?: number } })?.prospects;
    refresh();
    alert(`${p?.importes ?? 0} prospect(s) importé(s) depuis Google Sheets (commentaires en notes).`);
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
    return matchQ && matchType;
  });

  const set = (k: keyof Contact, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const entName = (id: string | null) => entreprises.data.find((e) => e.id === id)?.raison_sociale ?? '—';

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Prospects, apprenants et interlocuteurs (CRM 4.1)"
        actions={
          <>
            <Button variant="secondary" onClick={importProspects} disabled={importing}>
              <DownloadCloud className={`h-4 w-4 ${importing ? 'animate-pulse' : ''}`} />
              {importing ? 'Import…' : 'Importer prospects'}
            </Button>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouveau contact</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input className="input pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input max-w-[220px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous les types</option>
          {TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
        </select>
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
            <th className="px-4 py-3">Entreprise</th>
            <th className="px-4 py-3">Coordonnées</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {filtered.map((c) => (
            <tr key={c.id} className="hover:bg-surface-2">
              <td className="px-4 py-3 font-medium text-fg">
                {fullName(c.prenom, c.nom)}
                {c.fonction && <span className="block text-xs font-normal text-muted">{c.fonction}</span>}
              </td>
              <td className="px-4 py-3"><Badge className="bg-brand-50 text-brand-700">{CONTACT_TYPE_LABELS[c.type]}</Badge></td>
              <td className="px-4 py-3 text-muted">{entName(c.entreprise_id)}</td>
              <td className="px-4 py-3 text-muted">
                {c.email && <span className="flex items-center gap-1 text-xs"><Mail className="h-3 w-3" />{c.email}</span>}
                {c.telephone && <span className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{c.telephone}</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
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
    </div>
  );
}

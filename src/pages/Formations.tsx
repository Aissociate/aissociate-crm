import { useState } from 'react';
import { Plus, Pencil, Trash2, Clock, Euro, Lock } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge } from '@/components/ui';
import { MODALITES } from '@/lib/constants';
import { formatMoney } from '@/lib/utils';
import type { Formation } from '@/lib/database.types';

const empty = (): Partial<Formation> => ({
  intitule: '', objectifs: '', programme: [], prerequis: '', public_vise: '',
  duree_heures: 0, modalite: 'presentiel', prix: 0, actif: true,
});

export default function Formations() {
  const { isManager } = useAuth();
  const { data, loading, refresh } = useCollection<Formation>('formations', { orderBy: { column: 'intitule' } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Formation>>(empty());
  const [programmeText, setProgrammeText] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Formation, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setForm(empty()); setProgrammeText(''); setOpen(true); };
  const openEdit = (f: Formation) => { setForm(f); setProgrammeText((f.programme ?? []).join('\n')); setOpen(true); };

  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
      duree_heures: Number(form.duree_heures ?? 0),
      prix: Number(form.prix ?? 0),
      programme: programmeText.split('\n').map((l) => l.trim()).filter(Boolean),
    };
    const { error } = form.id
      ? await supabase.from('formations').update(payload).eq('id', form.id)
      : await supabase.from('formations').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  const remove = async (f: Formation) => {
    if (!confirm(`Supprimer « ${f.intitule} » ?`)) return;
    const { error } = await supabase.from('formations').delete().eq('id', f.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Catalogue de formations"
        subtitle={isManager ? 'Gestion du catalogue (4.3)' : 'Consultation du catalogue (lecture seule)'}
        actions={isManager
          ? <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouvelle formation</Button>
          : <Badge className="bg-surface-2 text-muted"><Lock className="mr-1 h-3 w-3" /> Lecture seule</Badge>}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="Catalogue vide" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((f) => (
            <div key={f.id} className="card flex flex-col p-5">
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold text-fg">{f.intitule}</h3>
                {isManager && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(f)} className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(f)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              {f.objectifs && <p className="mb-3 text-sm text-muted line-clamp-2">{f.objectifs}</p>}
              <div className="mt-auto flex flex-wrap gap-3 text-sm text-muted">
                <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-muted" />{f.duree_heures} h</span>
                <span className="flex items-center gap-1"><Euro className="h-4 w-4 text-muted" />{formatMoney(f.prix)}</span>
                <Badge className="bg-brand-50 text-brand-700">{f.modalite}</Badge>
                {!f.actif && <Badge className="bg-red-50 text-red-600">Inactif</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={form.id ? 'Modifier la formation' : 'Nouvelle formation'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.intitule}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Intitulé" required><input className="input" value={form.intitule ?? ''} onChange={(e) => set('intitule', e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Objectifs"><textarea className="input" rows={2} value={form.objectifs ?? ''} onChange={(e) => set('objectifs', e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Programme (une ligne par module)"><textarea className="input" rows={4} value={programmeText} onChange={(e) => setProgrammeText(e.target.value)} /></Field></div>
          <Field label="Durée (heures)"><input className="input" type="number" value={form.duree_heures ?? 0} onChange={(e) => set('duree_heures', e.target.value)} /></Field>
          <Field label="Prix (€)"><input className="input" type="number" value={form.prix ?? 0} onChange={(e) => set('prix', e.target.value)} /></Field>
          <Field label="Modalité"><select className="input" value={form.modalite} onChange={(e) => set('modalite', e.target.value)}>
            {MODALITES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></Field>
          <Field label="Public visé"><input className="input" value={form.public_vise ?? ''} onChange={(e) => set('public_vise', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Prérequis"><input className="input" value={form.prerequis ?? ''} onChange={(e) => set('prerequis', e.target.value)} /></Field></div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={!!form.actif} onChange={(e) => set('actif', e.target.checked)} /> Formation active
          </label>
        </div>
      </Modal>
    </div>
  );
}

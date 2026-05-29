import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner } from '@/components/ui';
import { OPP_STAGE_LABELS, OPP_STAGE_ORDER } from '@/lib/constants';
import { formatMoney } from '@/lib/utils';
import type { Opportunite, OpportuniteStage, Contact, Entreprise, Financeur } from '@/lib/database.types';

const empty = (): Partial<Opportunite> => ({
  titre: '', montant: 0, stage: 'nouveau', probabilite: 10,
  contact_id: null, entreprise_id: null, financeur_id: null, notes: '',
});

export default function Pipeline() {
  const { session } = useAuth();
  const { data, loading, refresh } = useCollection<Opportunite>('opportunites', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Opportunite>>(empty());
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Opportunite, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
      montant: Number(form.montant ?? 0),
      probabilite: Number(form.probabilite ?? 0),
      owner_id: form.owner_id ?? session?.user.id,
    };
    const { error } = form.id
      ? await supabase.from('opportunites').update(payload).eq('id', form.id)
      : await supabase.from('opportunites').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  const move = async (o: Opportunite, dir: -1 | 1) => {
    const idx = OPP_STAGE_ORDER.indexOf(o.stage);
    const next = OPP_STAGE_ORDER[idx + dir];
    if (!next) return;
    await supabase.from('opportunites').update({ stage: next }).eq('id', o.id);
    refresh();
  };

  const remove = async (o: Opportunite) => {
    if (!confirm(`Supprimer l'opportunité « ${o.titre} » ?`)) return;
    await supabase.from('opportunites').delete().eq('id', o.id);
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Pipeline commercial"
        subtitle="Suivi des opportunités de la qualification à la signature (4.1)"
        actions={<Button onClick={() => { setForm(empty()); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle opportunité</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {OPP_STAGE_ORDER.map((stage) => {
            const items = data.filter((o) => o.stage === stage);
            const total = items.reduce((s, o) => s + Number(o.montant ?? 0), 0);
            return (
              <div key={stage} className="flex w-72 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-slate-700">{OPP_STAGE_LABELS[stage]}</span>
                  <span className="rounded-full bg-slate-200 px-2 text-xs text-slate-600">{items.length}</span>
                </div>
                <p className="mb-2 px-1 text-xs text-slate-400">{formatMoney(total)}</p>
                <div className="flex-1 space-y-2 rounded-xl bg-slate-100 p-2">
                  {items.map((o) => {
                    const idx = OPP_STAGE_ORDER.indexOf(o.stage);
                    return (
                      <div key={o.id} className="card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">{o.titre}</p>
                          <div className="flex gap-0.5">
                            <button onClick={() => { setForm(o); setOpen(true); }} className="rounded p-1 text-slate-400 hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => remove(o)} className="rounded p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-brand-700">{formatMoney(Number(o.montant))}</p>
                        <p className="text-xs text-slate-400">{o.probabilite}% de probabilité</p>
                        <div className="mt-2 flex justify-between">
                          <button disabled={idx === 0} onClick={() => move(o, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                          <button disabled={idx === OPP_STAGE_ORDER.length - 1} onClick={() => move(o, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)}
        title={form.id ? 'Modifier l\'opportunité' : 'Nouvelle opportunité'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.titre}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Titre" required><input className="input" value={form.titre ?? ''} onChange={(e) => set('titre', e.target.value)} /></Field></div>
          <Field label="Montant (€)"><input className="input" type="number" value={form.montant ?? 0} onChange={(e) => set('montant', e.target.value)} /></Field>
          <Field label="Probabilité (%)"><input className="input" type="number" min={0} max={100} value={form.probabilite ?? 0} onChange={(e) => set('probabilite', e.target.value)} /></Field>
          <Field label="Étape"><select className="input" value={form.stage} onChange={(e) => set('stage', e.target.value as OpportuniteStage)}>
            {OPP_STAGE_ORDER.map((s) => <option key={s} value={s}>{OPP_STAGE_LABELS[s]}</option>)}
          </select></Field>
          <Field label="Clôture prévue"><input className="input" type="date" value={form.date_cloture_prev ?? ''} onChange={(e) => set('date_cloture_prev', e.target.value || null)} /></Field>
          <Field label="Contact"><select className="input" value={form.contact_id ?? ''} onChange={(e) => set('contact_id', e.target.value || null)}>
            <option value="">—</option>
            {contacts.data.map((c) => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </select></Field>
          <Field label="Entreprise"><select className="input" value={form.entreprise_id ?? ''} onChange={(e) => set('entreprise_id', e.target.value || null)}>
            <option value="">—</option>
            {entreprises.data.map((e) => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
          </select></Field>
          <Field label="Financeur"><select className="input" value={form.financeur_id ?? ''} onChange={(e) => set('financeur_id', e.target.value || null)}>
            <option value="">—</option>
            {financeurs.data.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select></Field>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field></div>
        </div>
      </Modal>
    </div>
  );
}

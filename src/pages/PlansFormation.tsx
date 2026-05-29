import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Wand2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge } from '@/components/ui';
import { MODALITES, PLAN_STATUT_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { PlanFormation, PlanStatut, Formation, Contact, Entreprise, Financeur } from '@/lib/database.types';

const STATUTS: PlanStatut[] = ['brouillon', 'valide', 'envoye', 'archive'];
const empty = (): Partial<PlanFormation> => ({
  nom: '', formation_id: null, contact_id: null, entreprise_id: null, financeur_id: null,
  objectifs: '', contenu: [], duree_heures: 0, modalite: 'presentiel', statut: 'brouillon', version: 1,
});

export default function PlansFormation() {
  const { session } = useAuth();
  const { data, loading, refresh } = useCollection<PlanFormation>('plans_formation', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const formations = useCollection<Formation>('formations');
  const contacts = useCollection<Contact>('contacts');
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<PlanFormation>>(empty());
  const [contenuText, setContenuText] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof PlanFormation, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setForm(empty()); setContenuText(''); setOpen(true); };
  const openEdit = (p: PlanFormation) => { setForm(p); setContenuText((p.contenu ?? []).join('\n')); setOpen(true); };

  // Pre-remplit le plan a partir d'une formation du catalogue (4.3)
  const applyFormation = (id: string) => {
    set('formation_id', id || null);
    const f = formations.data.find((x) => x.id === id);
    if (f) {
      setContenuText((f.programme ?? []).join('\n'));
      setForm((prev) => ({
        ...prev, formation_id: id,
        nom: prev.nom || `Plan — ${f.intitule}`,
        objectifs: f.objectifs ?? prev.objectifs,
        duree_heures: f.duree_heures, modalite: f.modalite,
      }));
    }
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
      duree_heures: Number(form.duree_heures ?? 0),
      contenu: contenuText.split('\n').map((l) => l.trim()).filter(Boolean),
      owner_id: form.owner_id ?? session?.user.id,
    };
    const { error } = form.id
      ? await supabase.from('plans_formation').update(payload).eq('id', form.id)
      : await supabase.from('plans_formation').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  const remove = async (p: PlanFormation) => {
    if (!confirm(`Supprimer le plan « ${p.nom} » ?`)) return;
    await supabase.from('plans_formation').delete().eq('id', p.id);
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Plans de formation"
        subtitle="Génération de plans sur mesure à partir du catalogue (4.3)"
        actions={<Button onClick={openNew}><Wand2 className="h-4 w-4" /> Générer un plan</Button>}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="Aucun plan" message="Générez un plan personnalisé depuis une formation du catalogue." />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Durée</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Créé le</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {data.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2 font-medium text-slate-900"><FileText className="h-4 w-4 text-brand-500" />{p.nom}</span>
                <span className="text-xs text-slate-400">v{p.version} · {p.contenu?.length ?? 0} modules</span>
              </td>
              <td className="px-4 py-3 text-slate-600">{p.duree_heures} h · {p.modalite}</td>
              <td className="px-4 py-3"><Badge className="bg-brand-50 text-brand-700">{PLAN_STATUT_LABELS[p.statut]}</Badge></td>
              <td className="px-4 py-3 text-slate-500">{formatDate(p.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <button onClick={() => openEdit(p)} className="rounded p-1.5 text-slate-400 hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(p)} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={form.id ? 'Modifier le plan' : 'Générer un plan de formation'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.nom}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Formation source"><select className="input" value={form.formation_id ?? ''} onChange={(e) => applyFormation(e.target.value)}>
            <option value="">— (plan vierge)</option>
            {formations.data.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
          </select></Field>
          <Field label="Nom du plan" required><input className="input" value={form.nom ?? ''} onChange={(e) => set('nom', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Objectifs"><textarea className="input" rows={2} value={form.objectifs ?? ''} onChange={(e) => set('objectifs', e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Contenu / modules (une ligne par module)"><textarea className="input" rows={5} value={contenuText} onChange={(e) => setContenuText(e.target.value)} /></Field></div>
          <Field label="Durée (heures)"><input className="input" type="number" value={form.duree_heures ?? 0} onChange={(e) => set('duree_heures', e.target.value)} /></Field>
          <Field label="Modalité"><select className="input" value={form.modalite} onChange={(e) => set('modalite', e.target.value)}>
            {MODALITES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></Field>
          <Field label="Bénéficiaire (contact)"><select className="input" value={form.contact_id ?? ''} onChange={(e) => set('contact_id', e.target.value || null)}>
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
          <Field label="Statut"><select className="input" value={form.statut} onChange={(e) => set('statut', e.target.value as PlanStatut)}>
            {STATUTS.map((s) => <option key={s} value={s}>{PLAN_STATUT_LABELS[s]}</option>)}
          </select></Field>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, GraduationCap, Mail, Phone, FileText, CalendarDays, Lock,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import { fullName, formatDate } from '@/lib/utils';
import type { Formateur, FormateurDocument, SessionFormation } from '@/lib/database.types';

const DOC_CATS: Record<string, string> = {
  cv: 'CV', diplome: 'Diplôme', contrat: 'Contrat', habilitation: 'Habilitation', autre: 'Autre',
};

export default function Formateurs() {
  const { isManager, session } = useAuth();
  const formateurs = useCollection<Formateur>('formateurs', { orderBy: { column: 'nom' } });
  const sessions = useCollection<SessionFormation>('sessions_formation', { orderBy: { column: 'date_debut' } });

  const [selected, setSelected] = useState<string | null>(null);
  const [docs, setDocs] = useState<FormateurDocument[]>([]);
  const [docTitre, setDocTitre] = useState('');
  const [docCat, setDocCat] = useState('cv');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Formateur>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Formateur, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const activeId = selected ?? formateurs.data[0]?.id ?? null;
  const active = formateurs.data.find((f) => f.id === activeId) ?? null;

  const loadDocs = useCallback(async (id: string) => {
    const { data } = await supabase.from('formateur_documents').select('*')
      .eq('formateur_id', id).order('created_at', { ascending: false });
    setDocs(data ?? []);
  }, []);

  useEffect(() => { if (activeId) loadDocs(activeId); }, [activeId, loadDocs]);

  const save = async () => {
    setSaving(true);
    const payload = { ...form, statut: form.statut ?? 'actif' };
    const { error } = form.id
      ? await supabase.from('formateurs').update(payload).eq('id', form.id)
      : await supabase.from('formateurs').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    formateurs.refresh();
  };

  const remove = async (f: Formateur) => {
    if (!confirm(`Supprimer le formateur ${fullName(f.prenom, f.nom)} et ses documents ?`)) return;
    const { error } = await supabase.from('formateurs').delete().eq('id', f.id);
    if (error) { alert(error.message); return; }
    if (selected === f.id) setSelected(null);
    formateurs.refresh();
  };

  // Ajout d'un document après téléversement dans le bucket privé "formateurs"
  const addDoc = async (fichier_url: string) => {
    if (!activeId) return;
    const titre = docTitre.trim() || DOC_CATS[docCat];
    const { data, error } = await supabase.from('formateur_documents')
      .insert({ formateur_id: activeId, titre, categorie: docCat, fichier_url, created_by: session?.user.id })
      .select().single();
    if (error) { alert(error.message); return; }
    if (data) setDocs((d) => [data, ...d]);
    setDocTitre('');
  };
  const removeDoc = async (d: FormateurDocument) => {
    await supabase.from('formateur_documents').delete().eq('id', d.id);
    setDocs((prev) => prev.filter((x) => x.id !== d.id));
  };

  const planning = sessions.data.filter((s) => s.formateur_id === activeId);

  return (
    <div>
      <PageHeader
        title="Formateurs"
        subtitle="Intervenants, planning affecté et documentation (CV, diplômes, contrats)"
        actions={isManager
          ? <Button onClick={() => { setForm({ statut: 'actif' }); setOpen(true); }}><Plus className="h-4 w-4" /> Nouveau formateur</Button>
          : <Badge className="bg-surface-2 text-muted"><Lock className="mr-1 h-3 w-3" /> Lecture seule</Badge>}
      />

      {formateurs.loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : formateurs.data.length === 0 ? (
        <EmptyState title="Aucun formateur" message="Ajoutez vos intervenants pour les affecter aux sessions." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Liste */}
          <div className="space-y-2">
            {formateurs.data.map((f) => (
              <button key={f.id} onClick={() => setSelected(f.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${activeId === f.id ? 'border-brand-500 bg-brand-500/10' : 'border-line bg-surface hover:bg-surface-2'}`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium text-fg"><GraduationCap className="h-4 w-4 text-brand-500" />{fullName(f.prenom, f.nom)}</span>
                  <Badge className={f.statut === 'actif' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-2 text-muted'}>{f.statut}</Badge>
                </div>
                {f.specialites && <p className="mt-1 truncate text-xs text-muted">{f.specialites}</p>}
                <p className="mt-1 text-xs text-muted">{sessions.data.filter((s) => s.formateur_id === f.id).length} session(s)</p>
              </button>
            ))}
          </div>

          {/* Détail formateur */}
          <div className="lg:col-span-2">
            {!active ? <EmptyState title="Sélectionnez un formateur" /> : (
              <div className="space-y-6">
                <div className="card p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-fg">{fullName(active.prenom, active.nom)}</h2>
                      {active.specialites && <p className="text-sm text-muted">{active.specialites}</p>}
                    </div>
                    {isManager && (
                      <div className="flex gap-1">
                        <button onClick={() => { setForm(active); setOpen(true); }} className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(active)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted">
                    {active.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{active.email}</span>}
                    {active.telephone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{active.telephone}</span>}
                  </div>
                  {active.notes && <p className="mt-3 text-sm text-muted">{active.notes}</p>}
                </div>

                {/* Documentation */}
                <div className="card p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-fg"><FileText className="h-4 w-4" /> Documentation ({docs.length})</h3>
                  <ul className="mb-3 space-y-2">
                    {docs.map((d) => (
                      <li key={d.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                        <Badge className="bg-brand-50 text-brand-700">{DOC_CATS[d.categorie] ?? d.categorie}</Badge>
                        <span className="flex-1 text-sm text-fg">{d.titre}</span>
                        {d.fichier_url && <FileLink bucket="formateurs" value={d.fichier_url} />}
                        {isManager && <button onClick={() => removeDoc(d)} className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                      </li>
                    ))}
                    {docs.length === 0 && <li className="text-sm text-muted">Aucun document.</li>}
                  </ul>
                  {isManager && (
                    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-3">
                      <div className="flex-1 min-w-[140px]">
                        <label className="label">Titre</label>
                        <input className="input" placeholder="ex. CV 2026" value={docTitre} onChange={(e) => setDocTitre(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Catégorie</label>
                        <select className="input" value={docCat} onChange={(e) => setDocCat(e.target.value)}>
                          {Object.entries(DOC_CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      <FileUpload bucket="formateurs" label="Téléverser" onUploaded={addDoc} />
                    </div>
                  )}
                </div>

                {/* Planning affecté */}
                <div className="card p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-fg"><CalendarDays className="h-4 w-4" /> Planning affecté ({planning.length})</h3>
                  {planning.length === 0 ? (
                    <p className="text-sm text-muted">Aucune session affectée. Affectez ce formateur depuis le Calendrier.</p>
                  ) : (
                    <ul className="space-y-2">
                      {planning.map((s) => (
                        <li key={s.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.couleur }} />
                          <span className="flex-1 text-sm text-fg">{s.titre}</span>
                          <span className="text-xs text-muted">{formatDate(s.date_debut, 'dd/MM/yyyy HH:mm')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)}
        title={form.id ? 'Modifier le formateur' : 'Nouveau formateur'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.nom}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom"><input className="input" value={form.prenom ?? ''} onChange={(e) => set('prenom', e.target.value)} /></Field>
          <Field label="Nom" required><input className="input" value={form.nom ?? ''} onChange={(e) => set('nom', e.target.value)} /></Field>
          <Field label="E-mail"><input className="input" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Téléphone"><input className="input" value={form.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Spécialités"><input className="input" value={form.specialites ?? ''} onChange={(e) => set('specialites', e.target.value)} /></Field></div>
          <Field label="Statut"><select className="input" value={form.statut ?? 'actif'} onChange={(e) => set('statut', e.target.value)}>
            <option value="actif">Actif</option><option value="inactif">Inactif</option>
          </select></Field>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field></div>
        </div>
      </Modal>
    </div>
  );
}

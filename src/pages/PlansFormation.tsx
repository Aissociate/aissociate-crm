import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Wand as Wand2, Sparkles } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import { MODALITES, PLAN_STATUT_LABELS } from '@/lib/constants';
import { formatDate, fullName } from '@/lib/utils';
import { generatePlanPdf } from '@/lib/generatePlanPdf';
import type { PlanFormation, PlanStatut, Formation, Contact, Entreprise, Financeur, PlanPdf } from '@/lib/database.types';

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
  const pdfs = useCollection<PlanPdf>('plan_pdfs', { orderBy: { column: 'created_at', ascending: false } });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<PlanFormation>>(empty());
  const [contenuText, setContenuText] = useState('');
  const [saving, setSaving] = useState(false);
  const [genId, setGenId] = useState<string | null>(null); // plan en cours de génération
  const set = (k: keyof PlanFormation, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const cName = (id: string | null) => { const c = contacts.data.find((x) => x.id === id); return c ? fullName(c.prenom, c.nom) : ''; };
  const eName = (id: string | null) => entreprises.data.find((x) => x.id === id)?.raison_sociale ?? '';
  const fName = (id: string | null) => financeurs.data.find((x) => x.id === id)?.nom ?? '';
  const formName = (id: string | null) => formations.data.find((x) => x.id === id)?.intitule ?? '';

  // Génère un PDF structuré via l'IA (OpenRouter, côté serveur) à présenter au partenaire
  const generatePdf = async (p: PlanFormation) => {
    setGenId(p.id);
    try {
      const contexte = {
        nom: p.nom, objectifs: p.objectifs, contenu: p.contenu, duree_heures: p.duree_heures,
        modalite: p.modalite, formation: formName(p.formation_id),
        apprenant: cName(p.contact_id), organisme: eName(p.entreprise_id), financeur: fName(p.financeur_id),
      };
      await generatePlanPdf({
        planId: p.id, contexte,
        apprenant: cName(p.contact_id),
        organismePartenaire: eName(p.entreprise_id) || fName(p.financeur_id),
        userId: session?.user.id ?? null,
        contactId: p.contact_id, entrepriseId: p.entreprise_id, financeurId: p.financeur_id,
      });
      pdfs.refresh();
      alert('PDF généré et enregistré.');
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setGenId(null);
    }
  };

  const removePdf = async (d: PlanPdf) => {
    if (!confirm(`Supprimer le PDF « ${d.titre} » ?`)) return;
    await supabase.from('plan_pdfs').delete().eq('id', d.id);
    pdfs.refresh();
  };

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
    const { error } = await supabase.from('plans_formation').delete().eq('id', p.id);
    if (error) { alert(error.message); return; }
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
            <tr key={p.id} className="hover:bg-surface-2">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2 font-medium text-fg"><FileText className="h-4 w-4 text-brand-500" />{p.nom}</span>
                <span className="text-xs text-muted">v{p.version} · {p.contenu?.length ?? 0} modules</span>
              </td>
              <td className="px-4 py-3 text-muted">{p.duree_heures} h · {p.modalite}</td>
              <td className="px-4 py-3"><Badge tone="brand">{PLAN_STATUT_LABELS[p.statut]}</Badge></td>
              <td className="px-4 py-3 text-muted">{formatDate(p.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button variant="secondary" onClick={() => generatePdf(p)} disabled={genId === p.id} title="Générer un PDF structuré (IA)">
                    <Sparkles className={`h-4 w-4 ${genId === p.id ? 'animate-pulse' : ''}`} /> {genId === p.id ? 'Génération…' : 'PDF'}
                  </Button>
                  <button onClick={() => openEdit(p)} className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(p)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* PDF générés — listés par date, titre, apprenant, organisme */}
      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-fg"><Sparkles className="h-4 w-4 text-brand-500" /> Plans PDF générés ({pdfs.data.length})</h2>
        {pdfs.loading ? (
          <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
        ) : pdfs.data.length === 0 ? (
          <EmptyState title="Aucun PDF généré" message="Cliquez sur « PDF » sur un plan pour générer un document à présenter au partenaire." />
        ) : (
          <Table head={
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Titre</th>
              <th className="px-4 py-3">Apprenant</th>
              <th className="px-4 py-3">Organisme</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          }>
            {pdfs.data.map((d) => (
              <tr key={d.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 text-muted">{formatDate(d.created_at, 'dd/MM/yyyy HH:mm')}</td>
                <td className="px-4 py-3 font-medium text-fg">{d.titre}</td>
                <td className="px-4 py-3 text-muted">{d.apprenant || '—'}</td>
                <td className="px-4 py-3 text-muted">{d.organisme || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {d.fichier_url && <FileLink bucket="plans" value={d.fichier_url} />}
                    <button onClick={() => removePdf(d)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>

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

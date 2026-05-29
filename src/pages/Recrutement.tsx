import { useState } from 'react';
import { Plus, Briefcase, Trash2, UserPlus, Pencil } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge } from '@/components/ui';
import { CANDIDAT_STATUT_LABELS } from '@/lib/constants';
import { fullName } from '@/lib/utils';
import type { OffreRecrutement, Candidat, CandidatStatut } from '@/lib/database.types';

const STATUTS: CandidatStatut[] = ['recu', 'preselection', 'entretien', 'retenu', 'refuse', 'onboarding'];

export default function Recrutement() {
  const { session } = useAuth();
  const offres = useCollection<OffreRecrutement>('offres_recrutement', { orderBy: { column: 'created_at', ascending: false } });
  const candidats = useCollection<Candidat>('candidats', { orderBy: { column: 'created_at', ascending: false } });

  const [selected, setSelected] = useState<string | null>(null);
  const [offreOpen, setOffreOpen] = useState(false);
  const [offreForm, setOffreForm] = useState<Partial<OffreRecrutement>>({});
  const [candOpen, setCandOpen] = useState(false);
  const [candForm, setCandForm] = useState<Partial<Candidat>>({});
  const [saving, setSaving] = useState(false);

  const activeOffre = selected ?? offres.data[0]?.id ?? null;

  const saveOffre = async () => {
    setSaving(true);
    const payload = { ...offreForm, owner_id: offreForm.owner_id ?? session?.user.id };
    const { error } = offreForm.id
      ? await supabase.from('offres_recrutement').update(payload).eq('id', offreForm.id)
      : await supabase.from('offres_recrutement').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOffreOpen(false);
    offres.refresh();
  };

  const removeOffre = async (o: OffreRecrutement) => {
    if (!confirm(`Supprimer l'offre « ${o.titre} » ?`)) return;
    await supabase.from('offres_recrutement').delete().eq('id', o.id);
    offres.refresh();
  };

  const saveCand = async () => {
    setSaving(true);
    const payload = {
      ...candForm,
      offre_id: activeOffre,
      score: candForm.score ? Number(candForm.score) : null,
    };
    const { error } = candForm.id
      ? await supabase.from('candidats').update(payload).eq('id', candForm.id)
      : await supabase.from('candidats').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setCandOpen(false);
    candidats.refresh();
  };

  const setCandStatut = async (c: Candidat, statut: CandidatStatut) => {
    await supabase.from('candidats').update({ statut }).eq('id', c.id);
    candidats.refresh();
  };

  const removeCand = async (c: Candidat) => {
    if (!confirm('Supprimer ce candidat ?')) return;
    await supabase.from('candidats').delete().eq('id', c.id);
    candidats.refresh();
  };

  const offreCandidats = candidats.data.filter((c) => c.offre_id === activeOffre);
  const set = (k: keyof OffreRecrutement, v: unknown) => setOffreForm((f) => ({ ...f, [k]: v }));
  const setC = (k: keyof Candidat, v: unknown) => setCandForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Recrutement"
        subtitle="Offres et suivi des candidats — chargés de formation (4.4)"
        actions={<Button onClick={() => { setOffreForm({ statut: 'ouverte' }); setOffreOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle offre</Button>}
      />

      {offres.loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : offres.data.length === 0 ? (
        <EmptyState title="Aucune offre" message="Créez une offre de recrutement pour démarrer." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Offres */}
          <div className="space-y-2">
            {offres.data.map((o) => (
              <button key={o.id} onClick={() => setSelected(o.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${activeOffre === o.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-start justify-between">
                  <span className="flex items-center gap-2 font-medium text-slate-900"><Briefcase className="h-4 w-4 text-brand-500" />{o.titre}</span>
                  <Badge className={o.statut === 'ouverte' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>{o.statut}</Badge>
                </div>
                {o.lieu && <p className="mt-1 text-xs text-slate-400">{o.lieu}</p>}
                <p className="mt-1 text-xs text-slate-400">{candidats.data.filter((c) => c.offre_id === o.id).length} candidat(s)</p>
                <div className="mt-2 flex gap-1">
                  <span onClick={(e) => { e.stopPropagation(); setOffreForm(o); setOffreOpen(true); }} className="cursor-pointer rounded p-1 text-slate-400 hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></span>
                  <span onClick={(e) => { e.stopPropagation(); removeOffre(o); }} className="cursor-pointer rounded p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></span>
                </div>
              </button>
            ))}
          </div>

          {/* Candidats */}
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Candidats</h2>
              <Button variant="secondary" onClick={() => { setCandForm({ statut: 'recu' }); setCandOpen(true); }} disabled={!activeOffre}>
                <UserPlus className="h-4 w-4" /> Ajouter un candidat
              </Button>
            </div>
            {offreCandidats.length === 0 ? (
              <EmptyState title="Aucun candidat" />
            ) : (
              <div className="space-y-2">
                {offreCandidats.map((c) => (
                  <div key={c.id} className="card flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{fullName(c.prenom, c.nom)}</p>
                      <p className="text-xs text-slate-400">{c.email}{c.telephone ? ` · ${c.telephone}` : ''}{c.score != null ? ` · score ${c.score}` : ''}</p>
                    </div>
                    <select className="input max-w-[160px]" value={c.statut} onChange={(e) => setCandStatut(c, e.target.value as CandidatStatut)}>
                      {STATUTS.map((s) => <option key={s} value={s}>{CANDIDAT_STATUT_LABELS[s]}</option>)}
                    </select>
                    <button onClick={() => { setCandForm(c); setCandOpen(true); }} className="rounded p-1.5 text-slate-400 hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => removeCand(c)} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal offre */}
      <Modal open={offreOpen} onClose={() => setOffreOpen(false)} title={offreForm.id ? 'Modifier l\'offre' : 'Nouvelle offre'}
        footer={<><Button variant="secondary" onClick={() => setOffreOpen(false)}>Annuler</Button><Button onClick={saveOffre} disabled={saving || !offreForm.titre}>Enregistrer</Button></>}>
        <div className="space-y-4">
          <Field label="Titre" required><input className="input" value={offreForm.titre ?? ''} onChange={(e) => set('titre', e.target.value)} /></Field>
          <Field label="Lieu"><input className="input" value={offreForm.lieu ?? ''} onChange={(e) => set('lieu', e.target.value)} /></Field>
          <Field label="Profil recherché"><textarea className="input" rows={2} value={offreForm.profil ?? ''} onChange={(e) => set('profil', e.target.value)} /></Field>
          <Field label="Description"><textarea className="input" rows={3} value={offreForm.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Statut"><select className="input" value={offreForm.statut ?? 'ouverte'} onChange={(e) => set('statut', e.target.value)}>
            <option value="ouverte">Ouverte</option><option value="pourvue">Pourvue</option><option value="fermee">Fermée</option>
          </select></Field>
        </div>
      </Modal>

      {/* Modal candidat */}
      <Modal open={candOpen} onClose={() => setCandOpen(false)} title={candForm.id ? 'Modifier le candidat' : 'Nouveau candidat'}
        footer={<><Button variant="secondary" onClick={() => setCandOpen(false)}>Annuler</Button><Button onClick={saveCand} disabled={saving || !candForm.nom}>Enregistrer</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom"><input className="input" value={candForm.prenom ?? ''} onChange={(e) => setC('prenom', e.target.value)} /></Field>
          <Field label="Nom" required><input className="input" value={candForm.nom ?? ''} onChange={(e) => setC('nom', e.target.value)} /></Field>
          <Field label="E-mail"><input className="input" type="email" value={candForm.email ?? ''} onChange={(e) => setC('email', e.target.value)} /></Field>
          <Field label="Téléphone"><input className="input" value={candForm.telephone ?? ''} onChange={(e) => setC('telephone', e.target.value)} /></Field>
          <Field label="URL du CV"><input className="input" value={candForm.cv_url ?? ''} onChange={(e) => setC('cv_url', e.target.value)} /></Field>
          <Field label="Score (0-100)"><input className="input" type="number" value={candForm.score ?? ''} onChange={(e) => setC('score', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={candForm.notes ?? ''} onChange={(e) => setC('notes', e.target.value)} /></Field></div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!candForm.rgpd_consent} onChange={(e) => setC('rgpd_consent', e.target.checked)} /> Consentement RGPD recueilli
          </label>
        </div>
      </Modal>
    </div>
  );
}

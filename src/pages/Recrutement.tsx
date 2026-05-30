import { useState, useRef } from 'react';
import { Plus, Briefcase, Trash2, UserPlus, Pencil, CloudDownload as DownloadCloud, FileSpreadsheet } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner, EmptyState, Badge } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import { CANDIDAT_STATUT_LABELS } from '@/lib/constants';
import { fullName } from '@/lib/utils';
import { importCandidatsFile } from '@/lib/importExcel';
import CandidatFiche from '@/components/CandidatFiche';
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
  const [fiche, setFiche] = useState<Candidat | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Import des candidatures depuis un fichier Excel/CSV (parse navigateur, insert via session)
  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const r = await importCandidatsFile(file);
      offres.refresh();
      candidats.refresh();
      alert(`${r.importes} candidature(s) importée(s) sur ${r.lus} ligne(s).`);
    } catch (err) {
      alert(`Échec de l'import : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  // Import des candidatures depuis le Google Sheet (Edge Function import-sheets)
  const importCandidatures = async () => {
    setImporting(true);
    const { data, error } = await supabase.functions.invoke('import-sheets', { body: { source: 'candidats' } });
    setImporting(false);
    if (error) {
      alert("Import indisponible : déployez l'Edge Function « import-sheets ».");
      return;
    }
    const c = (data as { candidats?: { importes?: number } })?.candidats;
    offres.refresh();
    candidats.refresh();
    alert(`${c?.importes ?? 0} candidature(s) importée(s) depuis Google Sheets.`);
  };

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
    const { error } = await supabase.from('offres_recrutement').delete().eq('id', o.id);
    if (error) { alert(error.message); return; }
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
    const { error } = await supabase.from('candidats').update({ statut }).eq('id', c.id);
    if (error) { alert(error.message); return; }
    candidats.refresh();
  };

  const removeCand = async (c: Candidat) => {
    if (!confirm('Supprimer ce candidat ?')) return;
    const { error } = await supabase.from('candidats').delete().eq('id', c.id);
    if (error) { alert(error.message); return; }
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
        actions={
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={importFile} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
              <FileSpreadsheet className={`h-4 w-4 ${importing ? 'animate-pulse' : ''}`} />
              {importing ? 'Import…' : 'Importer Excel/CSV'}
            </Button>
            <Button variant="secondary" onClick={importCandidatures} disabled={importing} title="Depuis le Google Sheet configuré">
              <DownloadCloud className="h-4 w-4" /> Sheets
            </Button>
            <Button onClick={() => { setOffreForm({ statut: 'ouverte' }); setOffreOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle offre</Button>
          </>
        }
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
                className={`w-full rounded-xl border p-4 text-left transition ${activeOffre === o.id ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface hover:bg-surface-2'}`}>
                <div className="flex items-start justify-between">
                  <span className="flex items-center gap-2 font-medium text-fg"><Briefcase className="h-4 w-4 text-brand-500" />{o.titre}</span>
                  <Badge className={o.statut === 'ouverte' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-2 text-muted'}>{o.statut}</Badge>
                </div>
                {o.lieu && <p className="mt-1 text-xs text-muted">{o.lieu}</p>}
                <p className="mt-1 text-xs text-muted">{candidats.data.filter((c) => c.offre_id === o.id).length} candidat(s)</p>
                <div className="mt-2 flex gap-1">
                  <span onClick={(e) => { e.stopPropagation(); setOffreForm(o); setOffreOpen(true); }} className="cursor-pointer rounded p-1 text-muted hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></span>
                  <span onClick={(e) => { e.stopPropagation(); removeOffre(o); }} className="cursor-pointer rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></span>
                </div>
              </button>
            ))}
          </div>

          {/* Candidats */}
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-fg">Candidats</h2>
              <Button variant="secondary" onClick={() => { setCandForm({ statut: 'recu' }); setCandOpen(true); }} disabled={!activeOffre}>
                <UserPlus className="h-4 w-4" /> Ajouter un candidat
              </Button>
            </div>
            {offreCandidats.length === 0 ? (
              <EmptyState title="Aucun candidat" />
            ) : (
              <div className="space-y-2">
                {offreCandidats.map((c) => (
                  <div
                    key={c.id}
                    className="card flex cursor-pointer items-center gap-3 p-4 transition hover:border-brand-400"
                    onClick={() => setFiche(c)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-fg">{fullName(c.prenom, c.nom)}</p>
                      <p className="text-xs text-muted">{c.email}{c.telephone ? ` · ${c.telephone}` : ''}{c.score != null ? ` · score ${c.score}` : ''}</p>
                    </div>
                    <select
                      className="input max-w-[160px]"
                      value={c.statut}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); setCandStatut(c, e.target.value as CandidatStatut); }}
                    >
                      {STATUTS.map((s) => <option key={s} value={s}>{CANDIDAT_STATUT_LABELS[s]}</option>)}
                    </select>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCandForm(c); setCandOpen(true); }}
                      className="rounded p-1.5 text-muted hover:text-brand-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCand(c); }}
                      className="rounded p-1.5 text-muted hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
          <Field label="CV">
            <div className="flex items-center gap-3">
              <FileUpload bucket="cv" label="Téléverser le CV" onUploaded={(v) => setC('cv_url', v)} />
              {candForm.cv_url && <FileLink bucket="cv" value={candForm.cv_url} onClear={() => setC('cv_url', '')} />}
            </div>
          </Field>
          <Field label="Score (0-100)"><input className="input" type="number" value={candForm.score ?? ''} onChange={(e) => setC('score', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={candForm.notes ?? ''} onChange={(e) => setC('notes', e.target.value)} /></Field></div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={!!candForm.rgpd_consent} onChange={(e) => setC('rgpd_consent', e.target.checked)} /> Consentement RGPD recueilli
          </label>
        </div>
      </Modal>

      {fiche && (
        <CandidatFiche
          candidat={fiche}
          offres={offres.data}
          onClose={() => setFiche(null)}
          onEdit={(c) => { setFiche(null); setCandForm(c); setCandOpen(true); }}
          onUpdated={() => { candidats.refresh(); setFiche((prev) => prev ? { ...prev } : null); }}
        />
      )}
    </div>
  );
}

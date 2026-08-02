import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Wand as Wand2, Sparkles, Copy } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge, SearchSelect } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import AddToDossierButton from '@/components/AddToDossierButton';
import SignatureButton from '@/components/SignatureButton';
import { MODALITES, PLAN_STATUT_LABELS } from '@/lib/constants';
import { formatDate, fullName } from '@/lib/utils';
import { generatePlanPdf } from '@/lib/generatePlanPdf';
import { ensureDossierClient } from '@/lib/dossierClient';
import type { PlanFormation, PlanStatut, Formation, Contact, Entreprise, Financeur, PlanPdf, Dossier } from '@/lib/database.types';

const STATUTS: PlanStatut[] = ['brouillon', 'valide', 'envoye', 'archive'];

// Documents AGEFICE, dans l'ordre du parcours du stagiaire. `piece` désigne la
// pièce justificative du dossier que le document vient renseigner.
type AgeficeKind = 'demande' | 'convention' | 'emargement' | 'attestation';
const AGEFICE_DOCS: { kind: AgeficeKind; label: string; etape: string; piece: string }[] = [
  { kind: 'demande', label: 'Demande préalable de financement', etape: 'Avant — montage du dossier', piece: 'Demande de prise en charge' },
  { kind: 'convention', label: 'Convention de formation', etape: 'Avant — contractualisation', piece: 'Convention / contrat de formation' },
  { kind: 'emargement', label: "Feuille d'émargement", etape: 'Pendant — séance', piece: "Feuille d'émargement" },
  { kind: 'attestation', label: "Attestation d'assiduité et de règlement", etape: 'Après — solde', piece: "Attestation d'assiduité" },
];
// Pièce du dossier visée selon la nature du document généré.
const PIECE_POUR: Record<string, string> = {
  plan: 'Programme de formation',
  ...Object.fromEntries(AGEFICE_DOCS.map((d) => [d.kind, d.piece])),
};
const empty = (): Partial<PlanFormation> => ({
  nom: '', formation_id: null, contact_id: null, entreprise_id: null, financeur_id: null,
  objectifs: '', contenu: [], duree_heures: 0, modalite: 'presentiel', statut: 'brouillon', version: 1, dossier_id: null,
  dates_session: '',
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
  const dossiers = useCollection<Dossier>('dossiers');

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
  const planOf = (planId: string | null) => data.find((p) => p.id === planId);

  // Génère un PDF structuré via l'IA (OpenRouter, côté serveur) à présenter au partenaire
  const generatePdf = async (p: PlanFormation) => {
    setGenId(p.id);
    try {
      const contexte = {
        nom: p.nom, objectifs: p.objectifs, contenu: p.contenu, duree_heures: p.duree_heures,
        modalite: p.modalite, dates_session: p.dates_session, formation: formName(p.formation_id),
        apprenant: cName(p.contact_id), organisme: eName(p.entreprise_id), financeur: fName(p.financeur_id),
      };
      await generatePlanPdf({
        planId: p.id, contexte,
        apprenant: cName(p.contact_id),
        organismePartenaire: eName(p.entreprise_id) || fName(p.financeur_id),
        datesSession: p.dates_session ?? null,
        clientSiret: contacts.data.find((x) => x.id === p.contact_id)?.siret
          || entreprises.data.find((x) => x.id === p.entreprise_id)?.siret || null,
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

  // ── Documents AGEFICE, aux quatre moments du parcours ──────────────────────
  // Le formulaire de demande préalable est un PDF officiel remplissable : il est
  // pré-rempli mais reste éditable pour que le stagiaire complète sa partie.
  const [agefId, setAgefId] = useState<string | null>(null);
  const generateAgefice = async (p: PlanFormation, kind: AgeficeKind) => {
    setAgefId(`${p.id}:${kind}`);
    try {
      const { data: res, error } = await supabase.functions.invoke('generate-agefice', {
        body: { planId: p.id, type: kind, userId: session?.user.id ?? null },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const err = (res as { error?: string } | null)?.error;
      if (err) throw new Error(err);
      pdfs.refresh();
      alert(`${AGEFICE_DOCS.find((d) => d.kind === kind)?.label} généré.`);
    } catch (e) {
      alert(`Génération impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAgefId(null);
    }
  };

  const removePdf = async (d: PlanPdf) => {
    if (!confirm(`Supprimer le PDF « ${d.titre} » ?`)) return;
    await supabase.from('plan_pdfs').delete().eq('id', d.id);
    pdfs.refresh();
  };

  const openNew = () => { setForm(empty()); setContenuText(''); setOpen(true); };
  const openEdit = (p: PlanFormation) => { setForm(p); setContenuText((p.contenu ?? []).join('\n')); setOpen(true); };
  // Reprendre un plan existant pour le modifier : ouvre une copie (nouveau plan).
  const duplicate = (p: PlanFormation) => {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = p as PlanFormation & { created_at?: string; updated_at?: string };
    setForm({ ...rest, id: undefined, nom: `${p.nom} (copie)`, statut: 'brouillon', version: 1, dossier_id: null });
    setContenuText((p.contenu ?? []).join('\n'));
    setOpen(true);
  };

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
    // Création automatique du dossier client au nom du prospect (clé : contact + formation).
    let dossier_id = form.dossier_id ?? null;
    if (!dossier_id && form.contact_id) {
      const dossier = await ensureDossierClient({
        contactId: form.contact_id, contactName: cName(form.contact_id),
        formationId: form.formation_id ?? null, formationName: formName(form.formation_id ?? null),
        entrepriseId: form.entreprise_id ?? null, financeurId: form.financeur_id ?? null,
        ownerId: form.owner_id ?? session?.user.id ?? null,
      });
      dossier_id = dossier?.id ?? null;
    }
    const payload = {
      ...form,
      dossier_id,
      duree_heures: Number(form.duree_heures ?? 0),
      contenu: contenuText.split('\n').map((l) => l.trim()).filter(Boolean),
      dates_session: (form.dates_session ?? '').trim() || null,
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
                  {/* Documents AGEFICE : proposés dans l'ordre du parcours du stagiaire. */}
                  <select
                    className="input max-w-[210px] py-1 text-sm"
                    value=""
                    disabled={!!agefId && agefId.startsWith(p.id)}
                    onChange={(e) => { const v = e.target.value as AgeficeKind | ''; e.target.value = ''; if (v) void generateAgefice(p, v); }}
                    title="Générer un document AGEFICE à partir de ce plan"
                  >
                    <option value="">{agefId?.startsWith(p.id) ? 'Génération…' : '+ Document AGEFICE…'}</option>
                    {AGEFICE_DOCS.map((d) => (
                      <option key={d.kind} value={d.kind}>{d.label} · {d.etape}</option>
                    ))}
                  </select>
                  <button onClick={() => duplicate(p)} title="Reprendre ce plan (créer une copie modifiable)" className="rounded p-1.5 text-muted hover:text-brand-600"><Copy className="h-4 w-4" /></button>
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
                <td className="px-4 py-3">
                  <span className="font-medium text-fg">{d.titre}</span>
                  {d.kind && d.kind !== 'plan' && (
                    <Badge tone="info" className="ml-2">{AGEFICE_DOCS.find((a) => a.kind === d.kind)?.etape ?? d.kind}</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{d.apprenant || '—'}</td>
                <td className="px-4 py-3 text-muted">{d.organisme || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {d.fichier_url && <FileLink bucket="plans" value={d.fichier_url} />}
                    {/* Le contact du PDF est celui du plan source (plan_pdfs ne le porte pas).
                        La pièce visée dépend de la nature du document produit. */}
                    <AddToDossierButton
                      contactId={planOf(d.plan_id)?.contact_id ?? null}
                      dossiers={dossiers.data} fichierUrl={d.fichier_url}
                      pieceLibelle={PIECE_POUR[d.kind] ?? 'Programme de formation'}
                      documentLabel={(AGEFICE_DOCS.find((a) => a.kind === d.kind)?.label ?? 'plan de formation').toLowerCase()}
                      onDone={() => dossiers.refresh()}
                    />
                    {(() => {
                      const ct = contacts.data.find((x) => x.id === planOf(d.plan_id)?.contact_id);
                      return (
                        <SignatureButton
                          libelle={d.titre} bucket="plans" fichierUrl={d.fichier_url}
                          planPdfId={d.id} dossierId={planOf(d.plan_id)?.dossier_id ?? null}
                          contactId={ct?.id ?? null}
                          defautNom={ct ? fullName(ct.prenom, ct.nom) : (d.apprenant ?? '')}
                          defautEmail={ct?.email ?? ''}
                        />
                      );
                    })()}
                    {(() => {
                      const src = planOf(d.plan_id);
                      if (!src) return null;
                      return (
                        <>
                          <button onClick={() => generatePdf(src)} disabled={genId === src.id} title="Régénérer le PDF depuis le plan source" className="rounded p-1.5 text-muted hover:text-brand-600"><Sparkles className={`h-4 w-4 ${genId === src.id ? 'animate-pulse' : ''}`} /></button>
                          <button onClick={() => duplicate(src)} title="Dupliquer le plan (copie modifiable)" className="rounded p-1.5 text-muted hover:text-brand-600"><Copy className="h-4 w-4" /></button>
                          <button onClick={() => openEdit(src)} title="Modifier le plan puis régénérer" className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                        </>
                      );
                    })()}
                    <button onClick={() => removePdf(d)} title="Supprimer ce PDF" className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
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
          <Field label="Formation source"><SearchSelect
            value={form.formation_id ?? ''}
            onChange={(v) => applyFormation(v)}
            options={formations.data.map((f) => ({ value: f.id, label: f.intitule }))}
            placeholder="Rechercher une formation…" emptyLabel="— (plan vierge)"
          /></Field>
          <Field label="Nom du plan" required><input className="input" value={form.nom ?? ''} onChange={(e) => set('nom', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Objectifs"><textarea className="input" rows={2} value={form.objectifs ?? ''} onChange={(e) => set('objectifs', e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Contenu / modules (une ligne par module)"><textarea className="input" rows={5} value={contenuText} onChange={(e) => setContenuText(e.target.value)} /></Field></div>
          <Field label="Durée (heures)"><input className="input" type="number" value={form.duree_heures ?? 0} onChange={(e) => set('duree_heures', e.target.value)} /></Field>
          <Field label="Modalité"><select className="input" value={form.modalite ?? 'presentiel'} onChange={(e) => set('modalite', e.target.value)}>
            {MODALITES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></Field>
          <div className="col-span-2"><Field label="Dates de session" hint="Affichées sur le PDF (ex. « Les 4 et 5 août 2026 »)"><input className="input" placeholder="ex. Les 4 et 5 août 2026" value={form.dates_session ?? ''} onChange={(e) => set('dates_session', e.target.value)} /></Field></div>
          <Field label="Bénéficiaire (contact)"><SearchSelect
            value={form.contact_id ?? ''}
            onChange={(v) => set('contact_id', v || null)}
            options={contacts.data.map((c) => ({ value: c.id, label: `${c.prenom} ${c.nom}`.trim(), sub: c.email ?? undefined }))}
            placeholder="Rechercher un contact…" emptyLabel="—"
          /></Field>
          <Field label="Entreprise"><SearchSelect
            value={form.entreprise_id ?? ''}
            onChange={(v) => set('entreprise_id', v || null)}
            options={entreprises.data.map((e) => ({ value: e.id, label: e.raison_sociale }))}
            placeholder="Rechercher une entreprise…" emptyLabel="—"
          /></Field>
          <Field label="Financeur"><SearchSelect
            value={form.financeur_id ?? ''}
            onChange={(v) => set('financeur_id', v || null)}
            options={financeurs.data.map((f) => ({ value: f.id, label: f.nom }))}
            placeholder="Rechercher un financeur…" emptyLabel="—"
          /></Field>
          <Field label="Statut"><select className="input" value={form.statut} onChange={(e) => set('statut', e.target.value as PlanStatut)}>
            {STATUTS.map((s) => <option key={s} value={s}>{PLAN_STATUT_LABELS[s]}</option>)}
          </select></Field>
        </div>
      </Modal>
    </div>
  );
}

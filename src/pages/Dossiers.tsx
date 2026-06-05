import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge } from '@/components/ui';
import { DOSSIER_STATUT_TONES, DOSSIER_STATUT_LABELS } from '@/lib/constants';
import { formatMoney, genReference } from '@/lib/utils';
import { DEFAULT_PIECES } from '@/lib/dossierClient';
import type { Dossier, DossierStatut, Contact, Entreprise, Financeur, Formation, Workflow } from '@/lib/database.types';

const STATUTS: DossierStatut[] = [
  'brouillon', 'montage', 'depose', 'en_instruction', 'accorde', 'refuse', 'en_cours', 'solde', 'cloture',
];

const empty = (): Partial<Dossier> => ({
  intitule: '', contact_id: null, entreprise_id: null, financeur_id: null, formation_id: null,
  workflow_id: null, statut: 'brouillon', montant_demande: 0, montant_accorde: 0,
  date_debut: null, date_fin: null, notes: '',
});

export default function Dossiers() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { data, loading, refresh } = useCollection<Dossier>('dossiers', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');
  const formations = useCollection<Formation>('formations');
  const workflows = useCollection<Workflow>('workflows');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Dossier>>(empty());
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const set = (k: keyof Dossier, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Sélection du financeur => workflow associé
  const onFinanceur = (id: string) => {
    set('financeur_id', id || null);
    const wf = workflows.data.find((w) => w.financeur_id === id);
    set('workflow_id', wf?.id ?? null);
  };

  const create = async () => {
    setSaving(true);
    const reference = genReference('DOS');
    const payload = {
      ...form,
      reference,
      montant_demande: Number(form.montant_demande ?? 0),
      montant_accorde: Number(form.montant_accorde ?? 0),
      owner_id: session?.user.id,
    };
    const { data: created, error } = await supabase.from('dossiers').insert(payload).select().single();
    if (error || !created) { setSaving(false); alert(error?.message); return; }
    // Génère la checklist de pièces
    await supabase.from('dossier_pieces').insert(
      DEFAULT_PIECES.map((libelle) => ({ dossier_id: created.id, libelle, obligatoire: true, statut: 'manquante' as const })),
    );
    setSaving(false);
    setOpen(false);
    navigate(`/dossiers/${created.id}`);
  };

  const finName = (id: string | null) => financeurs.data.find((f) => f.id === id)?.nom ?? '—';
  const filtered = data.filter((d) =>
    (`${d.reference} ${d.intitule}`.toLowerCase().includes(q.toLowerCase())) &&
    (!statutFilter || d.statut === statutFilter),
  );

  return (
    <div>
      <PageHeader
        title="Dossiers de formation"
        subtitle="Gestion des dossiers par financeur, workflow et pièces (4.2)"
        actions={<Button onClick={() => { setForm(empty()); setOpen(true); }}><Plus className="h-4 w-4" /> Nouveau dossier</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input className="input pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input max-w-[220px]" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => <option key={s} value={s}>{DOSSIER_STATUT_LABELS[s]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun dossier" message="Créez un dossier pour démarrer le suivi de financement." />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3">Référence</th>
            <th className="px-4 py-3">Intitulé</th>
            <th className="px-4 py-3">Financeur</th>
            <th className="px-4 py-3">Montant</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3"></th>
          </tr>
        }>
          {filtered.map((d) => (
            <tr key={d.id} className="cursor-pointer hover:bg-surface-2" onClick={() => navigate(`/dossiers/${d.id}`)}>
              <td className="px-4 py-3 font-mono text-xs text-muted">{d.reference}</td>
              <td className="px-4 py-3 font-medium text-fg">{d.intitule}</td>
              <td className="px-4 py-3 text-muted">{finName(d.financeur_id)}</td>
              <td className="px-4 py-3 text-muted">{formatMoney(d.montant_accorde || d.montant_demande)}</td>
              <td className="px-4 py-3"><Badge tone={DOSSIER_STATUT_TONES[d.statut]}>{DOSSIER_STATUT_LABELS[d.statut]}</Badge></td>
              <td className="px-4 py-3 text-right"><ChevronRight className="ml-auto h-4 w-4 text-muted" /></td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title="Nouveau dossier de formation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={create} disabled={saving || !form.intitule}>{saving ? 'Création…' : 'Créer le dossier'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Intitulé" required><input className="input" value={form.intitule ?? ''} onChange={(e) => set('intitule', e.target.value)} /></Field></div>
          <Field label="Financeur" hint="Sélectionne automatiquement le workflow"><select className="input" value={form.financeur_id ?? ''} onChange={(e) => onFinanceur(e.target.value)}>
            <option value="">—</option>
            {financeurs.data.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select></Field>
          <Field label="Formation"><select className="input" value={form.formation_id ?? ''} onChange={(e) => set('formation_id', e.target.value || null)}>
            <option value="">—</option>
            {formations.data.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
          </select></Field>
          <Field label="Bénéficiaire (contact)"><select className="input" value={form.contact_id ?? ''} onChange={(e) => set('contact_id', e.target.value || null)}>
            <option value="">—</option>
            {contacts.data.map((c) => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </select></Field>
          <Field label="Entreprise"><select className="input" value={form.entreprise_id ?? ''} onChange={(e) => set('entreprise_id', e.target.value || null)}>
            <option value="">—</option>
            {entreprises.data.map((e) => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
          </select></Field>
          <Field label="Montant demandé (€)"><input className="input" type="number" value={form.montant_demande ?? 0} onChange={(e) => set('montant_demande', e.target.value)} /></Field>
          <Field label="Date de début"><input className="input" type="date" value={form.date_debut ?? ''} onChange={(e) => set('date_debut', e.target.value || null)} /></Field>
          <Field label="Date de fin"><input className="input" type="date" value={form.date_fin ?? ''} onChange={(e) => set('date_fin', e.target.value || null)} /></Field>
        </div>
        <p className="mt-3 text-xs text-muted">Une checklist de pièces justificatives sera générée automatiquement.</p>
      </Modal>
    </div>
  );
}

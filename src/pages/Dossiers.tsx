import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, UserRound } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge } from '@/components/ui';
import { DOSSIER_STATUT_TONES, DOSSIER_STATUT_LABELS } from '@/lib/constants';
import ContactFiche from '@/components/ContactFiche';
import { formatMoney, genReference, fullName } from '@/lib/utils';
import { DEFAULT_PIECES } from '@/lib/dossierClient';
import type { Dossier, DossierStatut, Contact, Entreprise, Financeur, Formation, Workflow, Profile } from '@/lib/database.types';

// « en_instruction » a été fusionné avec « depose » : il n'est plus proposé.
const STATUTS: DossierStatut[] = [
  'brouillon', 'montage', 'depose', 'accorde', 'refuse', 'en_cours', 'solde', 'cloture',
];

/**
 * Badge de synthèse : les cinq premières lignes sont visibles, le reste est
 * accessible à l'ascenseur (ticket Benjamin « tableau de synthèse Dossiers »).
 */
function SyntheseBadge({ titre, lignes, total }: { titre: string; lignes: [string, number][]; total: number }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{titre}</h3>
        <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{total}</span>
      </div>
      {lignes.length === 0 ? (
        <p className="py-2 text-xs text-muted">Aucun dossier.</p>
      ) : (
        // ~5 lignes visibles (28 px chacune), le surplus défile.
        <ul className="max-h-[8.75rem] divide-y divide-line overflow-y-auto pr-1">
          {lignes.map(([label, n]) => (
            <li key={label} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate text-muted" title={label}>{label}</span>
              <span className="shrink-0 font-semibold text-fg">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const [financeurFilter, setFinanceurFilter] = useState('');
  const [conseillerFilter, setConseillerFilter] = useState('');
  // Fiche du contact ouverte en surcouche depuis la liste des dossiers.
  const [fiche, setFiche] = useState<Contact | null>(null);
  const profiles = useCollection<Profile>('profiles');
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

  // Conseiller d'un dossier = celui affecté au contact bénéficiaire ; à défaut,
  // le propriétaire du dossier.
  const conseillerDe = (d: Dossier): string | null => {
    const ct = d.contact_id ? contacts.data.find((c) => c.id === d.contact_id) : null;
    return ct?.responsable_id ?? ct?.owner_id ?? d.owner_id ?? null;
  };
  const consName = (id: string | null) => {
    const p = id ? profiles.data.find((x) => x.id === id) : null;
    return p ? fullName(p.prenom, p.nom) : 'Non affecté';
  };

  const filtered = data.filter((d) =>
    (`${d.reference} ${d.intitule}`.toLowerCase().includes(q.toLowerCase())) &&
    (!statutFilter || d.statut === statutFilter) &&
    (!financeurFilter || (financeurFilter === 'aucun' ? !d.financeur_id : d.financeur_id === financeurFilter)) &&
    (!conseillerFilter || (conseillerFilter === 'aucun' ? !conseillerDe(d) : conseillerDe(d) === conseillerFilter)),
  );

  // ── Tableau de synthèse ─────────────────────────────────────────────────────
  // « En cours » au sens du suivi commercial : brouillon + déposé + accordé.
  const EN_COURS: DossierStatut[] = ['brouillon', 'depose', 'accorde'];
  const enCours = data.filter((d) => EN_COURS.includes(d.statut));
  const compte = (rows: Dossier[], cle: (d: Dossier) => string) => {
    const m = new Map<string, number>();
    for (const d of rows) m.set(cle(d), (m.get(cle(d)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const parAvancement = EN_COURS.map((s) => [DOSSIER_STATUT_LABELS[s], enCours.filter((d) => d.statut === s).length] as [string, number]);
  const parFinanceur = compte(enCours, (d) => finName(d.financeur_id));
  const parConseiller = compte(enCours, (d) => consName(conseillerDe(d)));
  const soldesParConseiller = compte(data.filter((d) => d.statut === 'solde'), (d) => consName(conseillerDe(d)));

  return (
    <div>
      <PageHeader
        title="Dossiers de formation"
        subtitle="Gestion des dossiers par financeur, workflow et pièces (4.2)"
        actions={<Button onClick={() => { setForm(empty()); setOpen(true); }}><Plus className="h-4 w-4" /> Nouveau dossier</Button>}
      />

      {/* ── Synthèse : dossiers en cours (brouillon + déposé + accordé) ─────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SyntheseBadge titre="En cours par avancement" lignes={parAvancement} total={enCours.length} />
        <SyntheseBadge titre="En cours par financeur" lignes={parFinanceur} total={enCours.length} />
        <SyntheseBadge titre="En cours par conseiller" lignes={parConseiller} total={enCours.length} />
        <SyntheseBadge titre="Soldés par conseiller" lignes={soldesParConseiller} total={soldesParConseiller.reduce((s, [, n]) => s + n, 0)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input className="input pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input max-w-[220px]" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => <option key={s} value={s}>{DOSSIER_STATUT_LABELS[s]}</option>)}
        </select>
        <select className="input max-w-[220px]" value={financeurFilter} onChange={(e) => setFinanceurFilter(e.target.value)} title="Filtrer par financeur">
          <option value="">Tous les financeurs</option>
          {financeurs.data.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          <option value="aucun">— Sans financeur —</option>
        </select>
        <select className="input max-w-[220px]" value={conseillerFilter} onChange={(e) => setConseillerFilter(e.target.value)} title="Filtrer par conseiller affecté au contact">
          <option value="">Tous les conseillers</option>
          {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
          <option value="aucun">— Non affecté —</option>
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
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3">Financeur</th>
            <th className="px-4 py-3">Conseiller</th>
            <th className="px-4 py-3">Montant</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3"></th>
          </tr>
        }>
          {filtered.map((d) => {
            const ct = d.contact_id ? contacts.data.find((c) => c.id === d.contact_id) : null;
            return (
              <tr key={d.id} className="cursor-pointer hover:bg-surface-2" onClick={() => navigate(`/dossiers/${d.id}`)}>
                <td className="px-4 py-3 font-mono text-xs text-muted">{d.reference}</td>
                <td className="px-4 py-3 font-medium text-fg">{d.intitule}</td>
                {/* Raccourci vers la fiche du contact, sans passer par le dossier. */}
                <td className="px-4 py-3">
                  {ct ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFiche(ct); }}
                      title="Ouvrir la fiche du contact"
                      className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline dark:text-brand-400"
                    >
                      <UserRound className="h-3.5 w-3.5" /> {fullName(ct.prenom, ct.nom)}
                    </button>
                  ) : <span className="text-sm text-muted">—</span>}
                </td>
                <td className="px-4 py-3 text-muted">{finName(d.financeur_id)}</td>
                <td className="px-4 py-3 text-muted">{consName(conseillerDe(d))}</td>
                <td className="px-4 py-3 text-muted">{formatMoney(d.montant_accorde || d.montant_demande)}</td>
                <td className="px-4 py-3"><Badge tone={DOSSIER_STATUT_TONES[d.statut]}>{DOSSIER_STATUT_LABELS[d.statut]}</Badge></td>
                <td className="px-4 py-3 text-right"><ChevronRight className="ml-auto h-4 w-4 text-muted" /></td>
              </tr>
            );
          })}
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

      {/* Fiche du contact, ouverte depuis la colonne « Contact » */}
      {fiche && (
        <ContactFiche
          key={fiche.id}
          contact={contacts.data.find((x) => x.id === fiche.id) ?? fiche}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          profiles={profiles.data}
          onClose={() => setFiche(null)}
          onEdit={() => { setFiche(null); navigate('/contacts'); }}
          onUpdated={() => contacts.refresh()}
        />
      )}
    </div>
  );
}

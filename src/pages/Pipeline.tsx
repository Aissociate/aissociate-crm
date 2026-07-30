import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner } from '@/components/ui';
import ContactFiche from '@/components/ContactFiche';
import { OPP_STAGE_LABELS, OPP_STAGE_ORDER } from '@/lib/constants';
import { formatMoney, fullName } from '@/lib/utils';
import type { Opportunite, OpportuniteStage, Contact, Entreprise, Financeur, Profile } from '@/lib/database.types';

const empty = (): Partial<Opportunite> => ({
  titre: '', montant: 0, stage: 'nouveau', probabilite: 10,
  contact_id: null, entreprise_id: null, financeur_id: null, notes: '',
});

export default function Pipeline() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { data, loading, refresh } = useCollection<Opportunite>('opportunites', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');
  const profiles = useCollection<Profile>('profiles');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Opportunite>>(empty());
  const [saving, setSaving] = useState(false);
  const [ficheContact, setFicheContact] = useState<Contact | null>(null);
  const set = (k: keyof Opportunite, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const openFiche = (contactId: string | null) => {
    const c = contactId ? contacts.data.find((x) => x.id === contactId) : null;
    if (c) setFicheContact(c);
  };

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
    const { error } = await supabase.from('opportunites').update({ stage: next }).eq('id', o.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const remove = async (o: Opportunite) => {
    if (!confirm(`Supprimer l'opportunité « ${o.titre} » ?`)) return;
    const { error } = await supabase.from('opportunites').delete().eq('id', o.id);
    if (error) { alert(error.message); return; }
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
                  <span className="text-sm font-semibold text-fg">{OPP_STAGE_LABELS[stage]}</span>
                  <span className="rounded-full bg-surface-2 px-2 text-xs text-muted">{items.length}</span>
                </div>
                <p className="mb-2 px-1 text-xs text-muted">{formatMoney(total)}</p>
                <div className="flex-1 space-y-2 rounded-xl bg-surface-2 p-2">
                  {items.map((o) => {
                    const idx = OPP_STAGE_ORDER.indexOf(o.stage);
                    const contact = o.contact_id ? contacts.data.find((x) => x.id === o.contact_id) : null;
                    const entreprise = entreprises.data.find((x) => x.id === (o.entreprise_id ?? contact?.entreprise_id));
                    const title = contact ? fullName(contact.prenom, contact.nom) : o.titre;
                    return (
                      <div key={o.id} onClick={() => openFiche(o.contact_id)} className={`card p-3 ${o.contact_id ? 'cursor-pointer hover:border-brand-300' : ''}`} title={o.contact_id ? 'Ouvrir la fiche client' : undefined}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-fg">{title}</p>
                            {entreprise && <p className="truncate text-xs text-muted">{entreprise.raison_sociale}</p>}
                          </div>
                          <div className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setForm(o); setOpen(true); }} className="rounded p-1 text-muted hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => remove(o)} className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        {contact?.telephone && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Phone className="h-3 w-3" /> {contact.telephone}</p>}
                        {contact && o.titre && <p className="mt-1 truncate text-xs text-muted">{o.titre}</p>}
                        <p className="mt-1 text-sm font-semibold text-brand-600 dark:text-brand-400">{formatMoney(Number(o.montant))}</p>
                        <p className="text-xs text-muted">{o.probabilite}% de probabilité</p>
                        {/* Les titres sont portés par les boutons eux-mêmes, sinon
                            l'infobulle « Ouvrir la fiche client » de la carte est héritée. */}
                        <div className="mt-2 flex justify-between" onClick={(e) => e.stopPropagation()}>
                          <button disabled={idx === 0} onClick={() => move(o, -1)} title="Déplacer l'opportunité à l'étape précédente" aria-label="Déplacer l'opportunité à l'étape précédente" className="rounded p-1 text-muted hover:bg-surface-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                          <button disabled={idx === OPP_STAGE_ORDER.length - 1} onClick={() => move(o, 1)} title="Déplacer l'opportunité à l'étape suivante" aria-label="Déplacer l'opportunité à l'étape suivante" className="rounded p-1 text-muted hover:bg-surface-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted">—</p>}
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

      {ficheContact && (
        <ContactFiche
          key={ficheContact.id}
          contact={contacts.data.find((x) => x.id === ficheContact.id) ?? ficheContact}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          profiles={profiles.data}
          onClose={() => setFicheContact(null)}
          onEdit={() => { setFicheContact(null); navigate('/contacts'); }}
          onUpdated={() => contacts.refresh()}
        />
      )}
    </div>
  );
}

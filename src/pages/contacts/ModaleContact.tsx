import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Modal, Field } from '@/components/ui';
import { CONTACT_TYPE_LABELS } from '@/lib/constants';
import { fullName } from '@/lib/utils';
import type { Contact, Entreprise, Financeur } from '@/lib/database.types';
import { TYPES, seedActionsFromMail, type MailSeed } from './constantes';

/**
 * Modale « Nouveau contact » / « Modifier le contact ». Montée à l'ouverture, avec le contact de départ.
 * `mailSeed` : mail à journaliser en actions quand le contact est créé depuis la Messagerie.
 */
export function ModaleContact({
  initial, mailSeed, entreprises, financeurs, userId, onClose, refresh, onActionsSeeded,
}: {
  initial: Partial<Contact>;
  mailSeed: MailSeed | null;
  entreprises: Entreprise[];
  financeurs: Financeur[];
  userId: string | undefined;
  onClose: () => void;
  refresh: () => unknown;
  onActionsSeeded: () => void;
}) {
  const [form, setForm] = useState<Partial<Contact>>(initial);
  const [tagsText, setTagsText] = useState(() => (initial.tags ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Contact, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
    const payload = { ...form, tags, owner_id: form.owner_id ?? userId };
    let newId: string | null = null;
    let error;
    if (form.id) {
      ({ error } = await supabase.from('contacts').update(payload).eq('id', form.id));
    } else {
      const { data: ins, error: insErr } = await supabase.from('contacts').insert(payload).select('id').single();
      error = insErr;
      newId = ins?.id ?? null;
    }
    // Contact créé depuis la Messagerie : on journalise le mail entrant (déjà
    // traité) et la réponse à effectuer à la première heure ouvrable.
    if (!error && newId && mailSeed) {
      await supabase.from('contact_actions').insert(seedActionsFromMail(newId, mailSeed));
      onActionsSeeded();
    }
    setSaving(false);
    if (error) { alert(error.message); return; }
    onClose();
    void refresh();
  };

  const remove = async (c: Contact) => {
    if (!confirm(`Supprimer le contact ${fullName(c.prenom, c.nom)} ?`)) return;
    const { error } = await supabase.from('contacts').delete().eq('id', c.id);
    if (error) { alert(error.message); return; }
    onClose();
    void refresh();
  };

  return (
    <Modal
      open onClose={onClose}
      title={form.id ? 'Modifier le contact' : 'Nouveau contact'}
      footer={
        <>
          {form.id && (
            <Button variant="danger" className="mr-auto" onClick={() => void remove(form as Contact)}><Trash2 className="h-4 w-4" /> Supprimer</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving || !form.nom}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type"><select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
        </select></Field>
        <Field label="Civilité"><input className="input" value={form.civilite ?? ''} onChange={(e) => set('civilite', e.target.value)} /></Field>
        <Field label="Prénom"><input className="input" value={form.prenom ?? ''} onChange={(e) => set('prenom', e.target.value)} /></Field>
        <Field label="Nom" required><input className="input" value={form.nom ?? ''} onChange={(e) => set('nom', e.target.value)} /></Field>
        <Field label="E-mail"><input className="input" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Téléphone"><input className="input" value={form.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} /></Field>
        <Field label="Fonction"><input className="input" value={form.fonction ?? ''} onChange={(e) => set('fonction', e.target.value)} /></Field>
        <Field label="Entreprise"><select className="input" value={form.entreprise_id ?? ''} onChange={(e) => set('entreprise_id', e.target.value || null)}>
          <option value="">—</option>
          {entreprises.map((e) => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
        </select></Field>
        <Field label="Financeur (si contact financeur)"><select className="input" value={form.financeur_id ?? ''} onChange={(e) => set('financeur_id', e.target.value || null)}>
          <option value="">—</option>
          {financeurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select></Field>
        <div className="col-span-2">
          <Field label="Tags" hint="Séparés par des virgules (ex. Assistance)">
            <input className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Assistance, VIP…" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Notes"><textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={!!form.rgpd_consent} onChange={(e) => set('rgpd_consent', e.target.checked)} />
          Consentement RGPD recueilli
        </label>
      </div>
    </Modal>
  );
}

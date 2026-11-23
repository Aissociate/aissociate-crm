import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Modal, Field, SearchSelect } from '@/components/ui';
import { fullName } from '@/lib/utils';
import type { Email, Contact } from '@/lib/database.types';

/** Affectation manuelle d'un e-mail (ou de tout le fil) à un contact. Montée à l'ouverture. */
export function ModaleAffectation({
  assignTarget, contacts, onClose, refresh,
}: {
  assignTarget: Email;
  contacts: Contact[];
  onClose: () => void;
  refresh: () => unknown;
}) {
  const [assignContact, setAssignContact] = useState(assignTarget.contact_id ?? '');
  const [assignWhole, setAssignWhole] = useState(true);
  const doAssign = async () => {
    const c = contacts.find((x) => x.id === assignContact);
    const owner = c ? (c.responsable_id ?? c.owner_id ?? null) : null;
    const fields = { contact_id: assignContact || null, owner_id: owner };
    const q = supabase.from('emails').update(fields);
    const { error } = assignWhole && assignTarget.expediteur
      ? await q.eq('expediteur', assignTarget.expediteur)
      : await q.eq('id', assignTarget.id);
    if (error) { alert(error.message); return; }
    onClose();
    void refresh();
  };

  return (
    <Modal
      open onClose={onClose} title="Affecter l'e-mail"
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={doAssign}>Affecter</Button></>}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">De : <strong className="text-fg">{assignTarget.expediteur ?? '—'}</strong></p>
        <Field label="Apprenant / prospect" hint="L'e-mail sera visible par le conseiller affecté à ce contact ; sinon par la direction">
          <SearchSelect
            value={assignContact} onChange={setAssignContact}
            options={contacts.map((c) => ({ value: c.id, label: fullName(c.prenom, c.nom), sub: c.email ?? undefined }))}
            placeholder="Rechercher un contact (nom, e-mail)…" emptyLabel="— Direction (non affecté) —"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={assignWhole} onChange={(e) => setAssignWhole(e.target.checked)} />
          Appliquer à toute la conversation (tous les e-mails de cet expéditeur)
        </label>
      </div>
    </Modal>
  );
}

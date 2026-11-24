import { useState } from 'react';
import { Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Modal, Field, Badge } from '@/components/ui';
import type { Contact } from '@/lib/database.types';
import { REQUEST_TYPE_GROUPS, emptyIntake } from './constantes';

/** Saisie interne d'une demande reçue — reprend le formulaire public (/formulaire). Montée à l'ouverture. */
export function ModaleSaisieDemande({ onClose, refresh }: { onClose: () => void; refresh: () => unknown }) {
  const [intake, setIntake] = useState(emptyIntake());
  const [intakeSaving, setIntakeSaving] = useState(false);
  const [intakeMsg, setIntakeMsg] = useState<string | null>(null);

  // Saisie interne : reprend le formulaire public et crée OU met à jour le contact
  // (dédoublonnage par e-mail). Type « Assistance » => tag « Assistance », sans affectation ;
  // type « Employé virtuel » => tag « Agent IA ».
  const submitIntake = async () => {
    if (!intake.lastName.trim() && !intake.email.trim()) { alert('Renseignez au moins le nom ou l\'e-mail.'); return; }
    setIntakeSaving(true);
    const isAssist = /assistance/i.test(intake.requestType);
    const assistTags = [
      ...(isAssist ? ['Assistance'] : []),
      ...(/employ[eé]s?[ -]virtuel|agents? ia/i.test(intake.requestType) ? ['Agent IA'] : []),
    ];
    let existing: Contact | null = null;
    if (intake.email.trim()) {
      const { data: ex } = await supabase.from('contacts').select('*').eq('email', intake.email.trim()).limit(1).maybeSingle();
      existing = ex as Contact | null;
    }
    let error;
    if (existing) {
      const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...assistTags]));
      ({ error } = await supabase.from('contacts').update({
        prenom: intake.firstName.trim() || existing.prenom,
        telephone: intake.phone.trim() || existing.telephone,
        formation_envisagee: intake.requestType || existing.formation_envisagee,
        besoin_resume: intake.message.trim() || existing.besoin_resume,
        tags: mergedTags,
      }).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('contacts').insert({
        type: 'prospect', nom: intake.lastName.trim() || '(lead)', prenom: intake.firstName.trim() || null,
        email: intake.email.trim() || null, telephone: intake.phone.trim() || null,
        statut_prospect: 'non assigné', besoin_resume: intake.message.trim() || null,
        formation_envisagee: intake.requestType || null,
        notes: 'Saisie interne (formulaire)' + (intake.company.trim() ? ' — entreprise : ' + intake.company.trim() : ''),
        tags: ['nouveau prospect', ...assistTags], owner_id: null, // lead non assigné, pas d'affectation
      }));
    }
    setIntakeSaving(false);
    if (error) { alert(error.message); return; }
    setIntakeMsg(existing ? 'Contact mis à jour ✓' : 'Contact créé ✓');
    setTimeout(onClose, 1200);
    void refresh();
  };

  return (
    <Modal
      open onClose={onClose} wide
      title="Saisir une demande reçue"
      footer={
        <>
          {intakeMsg && <span className="mr-auto text-sm text-emerald-600">{intakeMsg}</span>}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={submitIntake} disabled={intakeSaving}>{intakeSaving ? 'Enregistrement…' : 'Créer / mettre à jour'}</Button>
        </>
      }
    >
      <p className="mb-4 text-xs text-muted">
        Reprend le formulaire public. Le contact est <strong>créé</strong> ou <strong>mis à jour</strong> (dédoublonnage par e-mail).
        Une demande de type <strong>Assistance</strong> ajoute le tag « Assistance » (sans affectation).
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Prénom"><input className="input" value={intake.firstName} onChange={(e) => setIntake({ ...intake, firstName: e.target.value })} /></Field>
        <Field label="Nom"><input className="input" value={intake.lastName} onChange={(e) => setIntake({ ...intake, lastName: e.target.value })} /></Field>
        <Field label="E-mail" hint="Sert au dédoublonnage"><input className="input" type="email" value={intake.email} onChange={(e) => setIntake({ ...intake, email: e.target.value })} /></Field>
        <Field label="Téléphone"><input className="input" value={intake.phone} onChange={(e) => setIntake({ ...intake, phone: e.target.value })} /></Field>
        <Field label="Entreprise"><input className="input" value={intake.company} onChange={(e) => setIntake({ ...intake, company: e.target.value })} /></Field>
        <Field label="Type de demande">
          <select className="input" value={intake.requestType} onChange={(e) => setIntake({ ...intake, requestType: e.target.value })}>
            <option value="">— Sélectionner —</option>
            {REQUEST_TYPE_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Message"><textarea className="input" rows={3} value={intake.message} onChange={(e) => setIntake({ ...intake, message: e.target.value })} /></Field>
        </div>
        {/assistance/i.test(intake.requestType) && (
          <div className="col-span-2">
            <Badge tone="info"><Tag className="mr-1 h-3 w-3" /> Sera tagué « Assistance »</Badge>
          </div>
        )}
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Modal, Field } from '@/components/ui';
import type { TresorerieCharge, ChargeRecurrence, ChargeStatut } from '@/lib/database.types';
import { RECURRENCE_LABELS, STATUT_CHARGE_LABELS, chargeVide } from './calculs';

/** Modale d'une charge prévisionnelle, ponctuelle ou récurrente. Montée à l'ouverture. */
export function ModaleCharge({
  chargeEdit, userId, onClose, setErreur, onSaved,
}: {
  /** Charge à modifier, ou `null` pour une création. */
  chargeEdit: TresorerieCharge | null;
  userId: string | null;
  onClose: () => void;
  setErreur: (message: string | null) => void;
  /** Recharge les données après un enregistrement réussi. */
  onSaved: () => Promise<unknown>;
}) {
  const c = chargeEdit;
  const [chargeForm, setChargeForm] = useState(c
    ? {
        libelle: c.libelle, categorie: c.categorie ?? '', fournisseur: c.fournisseur ?? '',
        montant: String(c.montant), date_echeance: c.date_echeance, recurrence: c.recurrence,
        recurrence_fin: c.recurrence_fin ?? '', statut: c.statut,
        date_paiement: c.date_paiement ?? '', notes: c.notes ?? '',
      }
    : chargeVide());
  const setC = (k: keyof ReturnType<typeof chargeVide>, v: string) =>
    setChargeForm((f) => ({ ...f, [k]: v }));

  const enregistrerCharge = async () => {
    if (!chargeForm.libelle.trim()) { setErreur('Le libellé de la charge est obligatoire.'); return; }
    const ponctuelle = chargeForm.recurrence === 'ponctuelle';
    const payload = {
      libelle: chargeForm.libelle.trim(),
      categorie: chargeForm.categorie.trim() || null,
      fournisseur: chargeForm.fournisseur.trim() || null,
      montant: Number(chargeForm.montant) || 0,
      date_echeance: chargeForm.date_echeance,
      recurrence: chargeForm.recurrence,
      recurrence_fin: ponctuelle ? null : (chargeForm.recurrence_fin || null),
      // « Payée » et sa date n'ont de sens que pour une charge ponctuelle : une
      // charge récurrente est une projection, pas une facture unique.
      statut: ponctuelle ? chargeForm.statut : (chargeForm.statut === 'annulee' ? 'annulee' : 'prevue'),
      date_paiement: ponctuelle && chargeForm.statut === 'payee'
        ? (chargeForm.date_paiement || chargeForm.date_echeance) : null,
      notes: chargeForm.notes.trim() || null,
    };
    const { error } = chargeEdit
      ? await supabase.from('tresorerie_charges').update(payload).eq('id', chargeEdit.id)
      : await supabase.from('tresorerie_charges').insert({ ...payload, created_by: userId });
    if (error) { setErreur(error.message); return; }
    onClose();
    await onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={chargeEdit ? 'Modifier la charge' : 'Nouvelle charge'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => void enregistrerCharge()}>Enregistrer</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="Libellé" required>
          <input className="input" value={chargeForm.libelle} onChange={(e) => setC('libelle', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Catégorie" hint="Texte libre : loyer, salaires, URSSAF…">
            <input className="input" value={chargeForm.categorie} onChange={(e) => setC('categorie', e.target.value)} />
          </Field>
          <Field label="Fournisseur">
            <input className="input" value={chargeForm.fournisseur} onChange={(e) => setC('fournisseur', e.target.value)} />
          </Field>
          <Field label="Montant">
            <input
              type="number" step="0.01" className="input"
              value={chargeForm.montant} onChange={(e) => setC('montant', e.target.value)}
            />
          </Field>
          <Field label="Échéance" hint="Première échéance si la charge est récurrente.">
            <input
              type="date" className="input"
              value={chargeForm.date_echeance} onChange={(e) => setC('date_echeance', e.target.value)}
            />
          </Field>
          <Field label="Récurrence">
            <select className="input" value={chargeForm.recurrence} onChange={(e) => setC('recurrence', e.target.value)}>
              {(Object.keys(RECURRENCE_LABELS) as ChargeRecurrence[]).map((r) => (
                <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>
              ))}
            </select>
          </Field>
          {chargeForm.recurrence === 'ponctuelle' ? (
            <Field label="Statut">
              <select className="input" value={chargeForm.statut} onChange={(e) => setC('statut', e.target.value)}>
                {(Object.keys(STATUT_CHARGE_LABELS) as ChargeStatut[]).map((s) => (
                  <option key={s} value={s}>{STATUT_CHARGE_LABELS[s]}</option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Jusqu'au" hint="Vide = sans fin (bornée à l'horizon affiché).">
              <input
                type="date" className="input"
                value={chargeForm.recurrence_fin} onChange={(e) => setC('recurrence_fin', e.target.value)}
              />
            </Field>
          )}
        </div>
        {chargeForm.recurrence === 'ponctuelle' && chargeForm.statut === 'payee' && (
          <Field label="Payée le">
            <input
              type="date" className="input"
              value={chargeForm.date_paiement} onChange={(e) => setC('date_paiement', e.target.value)}
            />
          </Field>
        )}
        {chargeForm.recurrence !== 'ponctuelle' && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            Une charge récurrente est une projection : elle se répète dans le prévisionnel sans
            être « payée » ligne à ligne. Pour un suivi au réel, créez des charges ponctuelles.
          </p>
        )}
        <Field label="Notes">
          <textarea className="input" rows={2} value={chargeForm.notes} onChange={(e) => setC('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

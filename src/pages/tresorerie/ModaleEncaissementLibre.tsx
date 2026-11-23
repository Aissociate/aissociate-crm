import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Modal, Field } from '@/components/ui';
import type { TresorerieEncaissement, EncaissementStatut } from '@/lib/database.types';
import { STATUT_ENC_LABELS, ligneVide, type LigneEcheance } from './calculs';

/** Modale d'un encaissement hors pipeline (subvention, remboursement, apport…). Montée à l'ouverture. */
export function ModaleEncaissementLibre({
  libreEdit, userId, onClose, setErreur, onSaved,
}: {
  /** Encaissement à modifier, ou `null` pour une création. */
  libreEdit: TresorerieEncaissement | null;
  userId: string | null;
  onClose: () => void;
  setErreur: (message: string | null) => void;
  /** Recharge les données après un enregistrement réussi. */
  onSaved: () => Promise<unknown>;
}) {
  const e = libreEdit;
  const [libreForm, setLibreForm] = useState<LigneEcheance>(e
    ? {
        id: e.id, libelle: e.libelle, date_prevue: e.date_prevue, montant: String(e.montant),
        statut: e.statut, date_encaissement: e.date_encaissement ?? '', mode_reglement: e.mode_reglement ?? '',
      }
    : ligneVide());

  const enregistrerLibre = async () => {
    const payload = {
      opportunite_id: null,
      libelle: libreForm.libelle.trim() || 'Encaissement',
      montant: Number(libreForm.montant) || 0,
      date_prevue: libreForm.date_prevue,
      statut: libreForm.statut,
      date_encaissement: libreForm.statut === 'encaisse'
        ? (libreForm.date_encaissement || libreForm.date_prevue) : null,
      mode_reglement: libreForm.mode_reglement.trim() || null,
    };
    const { error } = libreEdit
      ? await supabase.from('tresorerie_encaissements').update(payload).eq('id', libreEdit.id)
      : await supabase.from('tresorerie_encaissements').insert({ ...payload, created_by: userId });
    if (error) { setErreur(error.message); return; }
    onClose();
    await onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={libreEdit ? "Modifier l'encaissement" : 'Nouvel encaissement'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => void enregistrerLibre()}>Enregistrer</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="Libellé" required>
          <input
            className="input" value={libreForm.libelle}
            onChange={(e) => setLibreForm((f) => ({ ...f, libelle: e.target.value }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant">
            <input
              type="number" step="0.01" className="input" value={libreForm.montant}
              onChange={(e) => setLibreForm((f) => ({ ...f, montant: e.target.value }))}
            />
          </Field>
          <Field label="Date prévue">
            <input
              type="date" className="input" value={libreForm.date_prevue}
              onChange={(e) => setLibreForm((f) => ({ ...f, date_prevue: e.target.value }))}
            />
          </Field>
          <Field label="Statut">
            <select
              className="input" value={libreForm.statut}
              onChange={(e) => setLibreForm((f) => ({ ...f, statut: e.target.value as EncaissementStatut }))}
            >
              {(Object.keys(STATUT_ENC_LABELS) as EncaissementStatut[]).map((s) => (
                <option key={s} value={s}>{STATUT_ENC_LABELS[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Encaissé le">
            <input
              type="date" className="input" value={libreForm.date_encaissement}
              disabled={libreForm.statut !== 'encaisse'}
              onChange={(e) => setLibreForm((f) => ({ ...f, date_encaissement: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Mode de règlement" hint="Virement, prélèvement, chèque…">
          <input
            className="input" value={libreForm.mode_reglement}
            onChange={(e) => setLibreForm((f) => ({ ...f, mode_reglement: e.target.value }))}
          />
        </Field>
      </div>
    </Modal>
  );
}

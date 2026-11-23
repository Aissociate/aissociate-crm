import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Modal, Field } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { TresorerieConfig } from '@/lib/database.types';
import { aujourdhui } from './calculs';

/** Modale « Point de départ du solde » : dernier solde bancaire connu et date du relevé. */
export function ModaleSolde({
  open, conf, nomProfil, userId, onClose, setErreur, onSaved,
}: {
  open: boolean;
  conf: TresorerieConfig | null;
  nomProfil: (id: string | null) => string;
  userId: string | null;
  onClose: () => void;
  setErreur: (message: string | null) => void;
  /** Recharge les données après un enregistrement réussi. */
  onSaved: () => Promise<unknown>;
}) {
  const [soldeForm, setSoldeForm] = useState({ solde_initial: '', date_solde: aujourdhui() });
  useEffect(() => {
    if (conf) setSoldeForm({ solde_initial: String(conf.solde_initial ?? 0), date_solde: conf.date_solde });
  }, [conf?.solde_initial, conf?.date_solde]);

  const enregistrerSolde = async () => {
    const { error } = await supabase.from('tresorerie_config').upsert({
      id: true,
      solde_initial: Number(soldeForm.solde_initial) || 0,
      date_solde: soldeForm.date_solde,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) { setErreur(error.message); return; }
    onClose();
    await onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Point de départ du solde"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={() => void enregistrerSolde()}>Enregistrer</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Field label="Solde bancaire" hint="Montant disponible sur le compte à la date du relevé.">
          <input
            type="number" step="0.01" className="input"
            value={soldeForm.solde_initial}
            onChange={(e) => setSoldeForm((f) => ({ ...f, solde_initial: e.target.value }))}
          />
        </Field>
        <Field label="Date du relevé">
          <input
            type="date" className="input"
            value={soldeForm.date_solde}
            onChange={(e) => setSoldeForm((f) => ({ ...f, date_solde: e.target.value }))}
          />
        </Field>
        {conf?.updated_by && (
          <p className="text-xs text-muted">
            Dernière mise à jour par {nomProfil(conf.updated_by)} le {formatDate(conf.updated_at)}.
          </p>
        )}
      </div>
    </Modal>
  );
}

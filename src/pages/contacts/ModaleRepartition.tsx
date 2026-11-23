import { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Modal } from '@/components/ui';
import { fullName } from '@/lib/utils';
import type { Contact, Profile } from '@/lib/database.types';

/**
 * Répartition round-robin entre conseillers. `targets` = la sélection si elle existe, sinon les
 * prospects non affectés. Montée à l'ouverture : les conseillers actifs sont présélectionnés.
 */
export function ModaleRepartition({
  assignables, targets, surSelection, distributing, setDistributing, setSelected, refresh, onClose,
}: {
  assignables: Profile[];
  targets: Contact[];
  /** Vrai quand les cibles viennent de la sélection (change seulement le libellé). */
  surSelection: boolean;
  distributing: boolean;
  setDistributing: (v: boolean) => void;
  setSelected: (s: Set<string>) => void;
  refresh: () => unknown;
  onClose: () => void;
}) {
  const [rrConseillers, setRrConseillers] = useState<Set<string>>(
    () => new Set(assignables.filter((p) => p.role === 'conseiller').map((p) => p.id)),
  );
  const toggleRrConseiller = (id: string) => setRrConseillers((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Répartition round-robin sur les conseillers sélectionnés (partielle possible).
  const runRoundRobin = async () => {
    const ids = [...rrConseillers];
    if (!ids.length) { alert('Sélectionnez au moins un conseiller.'); return; }
    if (!targets.length) { alert('Aucune cible à répartir.'); return; }
    setDistributing(true);
    for (let i = 0; i < targets.length; i++) {
      await supabase.from('contacts').update({ owner_id: ids[i % ids.length] }).eq('id', targets[i].id);
    }
    setDistributing(false);
    onClose();
    setSelected(new Set());
    void refresh();
    alert(`${targets.length} contact(s) répartis sur ${ids.length} conseiller(s) (round-robin).`);
  };

  return (
    <Modal
      open onClose={onClose} title="Répartir entre les conseillers"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={runRoundRobin} disabled={distributing || rrConseillers.size === 0}>
            <UserCheck className="h-4 w-4" /> {distributing ? 'Répartition…' : 'Confirmer la répartition'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-fg">
          Répartir <strong>{targets.length}</strong> {surSelection ? 'contact(s) sélectionné(s)' : 'prospect(s) non affecté(s)'} sur <strong>{rrConseillers.size}</strong> conseiller(s) sélectionné(s).
        </p>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Conseillers concernés</p>
          {assignables.length === 0 ? (
            <p className="text-sm text-muted">Aucun conseiller actif disponible.</p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {assignables.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-2">
                  <input type="checkbox" checked={rrConseillers.has(p.id)} onChange={() => toggleRrConseiller(p.id)} />
                  <span className="text-fg">{fullName(p.prenom, p.nom)}</span>
                  <span className="text-xs text-muted">· {p.role === 'directeur_commercial' ? 'directeur commercial' : p.role}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

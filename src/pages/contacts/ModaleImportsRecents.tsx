import { Undo2 } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { ImportBatch } from '@/lib/database.types';

/** Imports récents : chacun peut être annulé (lots gardés en base). */
export function ModaleImportsRecents({
  open, onClose, batches, undoBatch, importing,
}: {
  open: boolean;
  onClose: () => void;
  batches: ImportBatch[];
  undoBatch: (b: ImportBatch) => Promise<void>;
  importing: boolean;
}) {
  return (
    <Modal
      open={open} onClose={onClose} title="Imports récents"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <p className="mb-3 text-sm text-muted">Annuler un import supprime les contacts qu'il a créés. Ceux qu'il a seulement mis à jour ne changent pas.</p>
      {batches.length === 0 ? <p className="text-sm text-muted">Aucun import à annuler.</p> : (
        <ul className="space-y-2">
          {batches.slice(0, 10).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <span className="text-fg"><strong>{b.count}</strong> contact(s) créé(s)</span>
              <span className="text-xs text-muted">{formatDate(b.created_at, 'dd/MM/yyyy HH:mm')}</span>
              <button onClick={() => undoBatch(b)} disabled={importing} className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50">
                <Undo2 className="h-3.5 w-3.5" /> Annuler cet import
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

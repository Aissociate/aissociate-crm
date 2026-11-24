import { useState } from 'react';
import { UserCheck, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui';
import { CONTACT_TYPE_LABELS } from '@/lib/constants';
import { fullName } from '@/lib/utils';
import type { ContactType, Profile } from '@/lib/database.types';
import { TYPES } from './constantes';

/** Barre d'actions de masse sur la sélection (managers) : attribuer, répartir, changer le type. */
export function BarreSelection({
  selected, setSelected, assignables, ownerName, distributing, setDistributing, refresh, openRoundRobin,
}: {
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  assignables: Profile[];
  ownerName: (id: string | null) => string;
  distributing: boolean;
  setDistributing: (v: boolean) => void;
  refresh: () => unknown;
  openRoundRobin: () => void;
}) {
  const [bulkOwner, setBulkOwner] = useState('');
  const [bulkType, setBulkType] = useState<ContactType>('prospect');

  // Attribution globale de la sélection à un conseiller (avec confirmation).
  const bulkAssign = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    const label = bulkOwner ? ownerName(bulkOwner) : 'Non affecté';
    if (!confirm(`Attribuer ${ids.length} contact(s) à ${label} ?`)) return;
    setDistributing(true);
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('contacts').update({ owner_id: bulkOwner || null }).in('id', ids.slice(i, i + 200));
      if (error) { setDistributing(false); alert(error.message); return; }
    }
    setDistributing(false);
    setSelected(new Set());
    void refresh();
  };

  // Changement de type en masse de la sélection (ex. requalifier des contacts en prospects).
  const bulkChangeType = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Changer le type de ${ids.length} contact(s) en « ${CONTACT_TYPE_LABELS[bulkType]} » ?`)) return;
    setDistributing(true);
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('contacts').update({ type: bulkType }).in('id', ids.slice(i, i + 200));
      if (error) { setDistributing(false); alert(error.message); return; }
    }
    setDistributing(false);
    setSelected(new Set());
    void refresh();
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm">
      <span className="font-medium text-brand-700 dark:text-brand-300">{selected.size} sélectionné(s)</span>
      <span className="mx-1 text-muted">·</span>
      <select className="input max-w-[200px] py-1 text-xs" value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)}>
        <option value="">Non affecté</option>
        {assignables.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
      </select>
      <Button variant="secondary" onClick={bulkAssign} disabled={distributing}>
        <UserCheck className="h-4 w-4" /> Attribuer
      </Button>
      <Button variant="secondary" onClick={openRoundRobin} disabled={distributing}>
        <UserCheck className="h-4 w-4" /> Répartir
      </Button>
      <span className="mx-1 text-muted">·</span>
      <select className="input max-w-[170px] py-1 text-xs" value={bulkType} onChange={(e) => setBulkType(e.target.value as ContactType)} title="Type cible">
        {TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
      </select>
      <Button variant="secondary" onClick={bulkChangeType} disabled={distributing}>
        <Tag className="h-4 w-4" /> Changer le type
      </Button>
      <button onClick={() => setSelected(new Set())} className="ml-auto text-xs font-medium text-muted underline-offset-2 hover:underline">Désélectionner</button>
    </div>
  );
}

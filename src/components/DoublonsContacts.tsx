import { useEffect, useState } from 'react';
import { GitMerge, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Modal, Button, Spinner, EmptyState, Badge } from '@/components/ui';
import { fullName, formatDate } from '@/lib/utils';
import type { Contact } from '@/lib/database.types';

/**
 * Détection et fusion des contacts en doublon (même e-mail, téléphone ou
 * nom+prénom). La fusion (direction uniquement) réaffecte toutes les données
 * du doublon — actions, dossiers, devis, e-mails… — vers le contact conservé,
 * complète ses champs vides, puis supprime le doublon. L'external_id du
 * doublon est exclu de l'import Sheets pour qu'il ne soit pas recréé.
 */

type Paire = { id1: string; id2: string; raisons: string };

export default function DoublonsContacts({
  open, onClose, contacts, isManager, onMerged,
}: {
  open: boolean; onClose: () => void;
  contacts: Contact[]; isManager: boolean;
  onMerged: () => void;
}) {
  const [paires, setPaires] = useState<Paire[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);

  const byId = new Map(contacts.map((c) => [c.id, c]));

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('contacts_doublons');
    if (error) alert(`Détection indisponible : ${error.message}`);
    setPaires(((data ?? []) as Paire[]).filter((p) => byId.has(p.id1) && byId.has(p.id2)));
    setLoading(false);
  };

  useEffect(() => { if (open) void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [open]);

  const fusionner = async (garde: Contact, doublon: Contact, key: string) => {
    if (!confirm(
      `Conserver « ${fullName(garde.prenom, garde.nom)} » et fusionner « ${fullName(doublon.prenom, doublon.nom)} » dedans ?\n\n` +
      'Toutes les données du doublon (actions, dossiers, devis, e-mails…) seront réaffectées, puis le doublon sera supprimé. Action irréversible.',
    )) return;
    setMerging(key);
    const { error } = await supabase.rpc('merge_contacts', { p_garde: garde.id, p_doublon: doublon.id });
    setMerging(null);
    if (error) { alert(`Fusion impossible : ${error.message}`); return; }
    setPaires((ps) => ps.filter((p) => p.id1 !== doublon.id && p.id2 !== doublon.id));
    onMerged();
  };

  const CarteContact = ({ c }: { c: Contact }) => (
    <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2/50 p-2.5">
      <p className="truncate text-sm font-medium text-fg">{fullName(c.prenom, c.nom)}</p>
      <p className="truncate text-xs text-muted">{c.email ?? '—'} · {c.telephone ?? '—'}</p>
      <p className="text-[11px] text-muted/70">Créé le {formatDate(c.created_at)}{c.ville ? ` · ${c.ville}` : ''}</p>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Doublons probables" wide
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">
          {loading ? 'Analyse en cours…' : `${paires.length} paire(s) détectée(s) (e-mail, téléphone ou nom identiques).`}
        </p>
        <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4" /> Réanalyser</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : paires.length === 0 ? (
        <EmptyState title="Aucun doublon détecté" message="Les contacts semblent uniques (parmi ceux que vous pouvez voir)." />
      ) : (
        <ul className="space-y-3">
          {paires.map((p) => {
            const a = byId.get(p.id1)!;
            const b = byId.get(p.id2)!;
            const key = `${p.id1}-${p.id2}`;
            return (
              <li key={key} className="rounded-xl border border-line p-3">
                <Badge tone="warning" className="mb-2">{p.raisons}</Badge>
                <div className="flex items-stretch gap-2">
                  <CarteContact c={a} />
                  <CarteContact c={b} />
                </div>
                {isManager ? (
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" disabled={merging === key} onClick={() => fusionner(a, b, key)}>
                      <GitMerge className="h-4 w-4" /> Garder « {fullName(a.prenom, a.nom)} »
                    </Button>
                    <Button variant="secondary" disabled={merging === key} onClick={() => fusionner(b, a, key)}>
                      <GitMerge className="h-4 w-4" /> Garder « {fullName(b.prenom, b.nom)} »
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-right text-xs text-muted">Fusion réservée à la direction.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

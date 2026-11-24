import { useState, type Dispatch, type SetStateAction } from 'react';
import { Trash2, ChevronDown, ChevronRight, Paperclip, UserRound, Forward, Send, Bot } from 'lucide-react';
import { Badge, TONE_TILE } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import { LinkedText } from '@/lib/linkify';
import PieceJointeLien from '@/components/PieceJointeLien';
import type { Email, Contact } from '@/lib/database.types';
import { KIND_LABEL, KIND_TONE, atOf, estIA, type Expediteur, type Peer } from './conversations';
import { BadgeExpediteur } from './BadgeExpediteur';

/** Vue « Envoyés » : tous les e-mails partis du CRM, un par ligne, dépliables. */
export function ListeEnvoyes({
  sentList, selection, setSelection, resolvePeer, expediteurDe, contacts, setFiche, forward, remove,
}: {
  sentList: Email[];
  selection: Set<string>;
  setSelection: Dispatch<SetStateAction<Set<string>>>;
  resolvePeer: (e: Email) => Peer;
  expediteurDe: (e: Email) => Expediteur;
  contacts: Contact[];
  setFiche: (c: Contact) => void;
  forward: (e: Email) => void;
  remove: (e: Email) => Promise<void>;
}) {
  const [openSent, setOpenSent] = useState<string | null>(null);

  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {sentList.map((e) => {
        const peer = resolvePeer(e);
        const ouvert = openSent === e.id;
        const ia = estIA(expediteurDe(e).origine);
        return (
          <div key={e.id} className={selection.has(e.id) ? 'bg-brand-500/5' : ''}>
            <div className="flex items-start gap-2.5 p-3">
              <input
                type="checkbox" className="mt-2 shrink-0" checked={selection.has(e.id)} title="Sélectionner ce message"
                onChange={() => setSelection((sel) => { const n = new Set(sel); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}
              />
              <button onClick={() => setOpenSent(ouvert ? null : e.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <div className={cn('mt-0.5 shrink-0 rounded-full p-2', TONE_TILE[ia ? 'info' : 'brand'])}>
                  {ia ? <Bot className="h-5 w-5" /> : <Send className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-fg">{e.sujet || '(sans objet)'}</p>
                    {e.attachments && e.attachments.length > 0 && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />}
                    <span className="ml-auto shrink-0 text-xs text-muted">{formatDate(atOf(e), 'dd/MM/yyyy HH:mm')}</span>
                    {ouvert ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted" />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    À {e.destinataires.join(', ') || '—'}{e.copie?.length ? ` · copie : ${e.copie.join(', ')}` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {<BadgeExpediteur x={expediteurDe(e)} />}
                    {peer.kind ? <Badge tone={KIND_TONE[peer.kind]}>{KIND_LABEL[peer.kind]} · {peer.label}</Badge> : <Badge tone="warning">Non rattaché</Badge>}
                    {e.statut === 'echec' ? <Badge tone="danger">non délivré</Badge> : <Badge tone={e.statut === 'envoye' ? 'success' : 'neutral'}>{e.statut}</Badge>}
                  </div>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                {peer.contactId && (
                  <button onClick={() => { const ct = contacts.find((x) => x.id === peer.contactId); if (ct) setFiche(ct); }} title="Ouvrir la fiche du contact" className="rounded p-1.5 text-muted hover:text-brand-600">
                    <UserRound className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => forward(e)} title="Transférer ce message" className="rounded p-1.5 text-muted hover:text-brand-600"><Forward className="h-4 w-4" /></button>
                <button onClick={() => remove(e)} title="Supprimer ce message" className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {ouvert && (
              <div className="border-t border-line bg-surface-2/40 p-3">
                {e.corps
                  ? <p className="whitespace-pre-wrap break-words text-sm text-fg"><LinkedText text={e.corps} /></p>
                  : <p className="text-sm text-muted">(message vide)</p>}
                {e.attachments && e.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.attachments.map((a, i) => <PieceJointeLien key={i} piece={a} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

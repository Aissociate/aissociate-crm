import { useState } from 'react';
import { Mail, MailOpen, Trash2, UserCog, TriangleAlert, ChevronDown, ChevronRight, Reply, Paperclip, MessageCircle, Pencil, UserRound, UserPlus, CheckCheck, CircleSlash2, Forward } from 'lucide-react';
import { Button, Badge, TONE_TILE } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import { LinkedText } from '@/lib/linkify';
import PieceJointeLien from '@/components/PieceJointeLien';
import { OPP_STAGE_LABELS } from '@/lib/constants';
import type { Email, EmailCanal } from '@/lib/database.types';
import { KIND_LABEL, KIND_TONE, type Convo, type Expediteur } from './conversations';
import { BadgeExpediteur } from './BadgeExpediteur';

/** Liste des conversations : une ligne par interlocuteur, dépliable en fil façon chat. */
export function ListeConversations({
  convos, newestFirst, affectationLabel, convoSelected, toggleConvo, expediteurDe,
  reply, openPeer, toggleClose, editDraft, forward, toggleLu, openAssign, remove,
}: {
  convos: Convo[];
  /** Messages de la conversation, du plus récent au plus ancien, quel que soit l'ordre affiché. */
  newestFirst: (c: Convo) => Email[];
  affectationLabel: (c: Convo) => string | null;
  convoSelected: (c: Convo) => boolean;
  toggleConvo: (c: Convo) => void;
  expediteurDe: (e: Email) => Expediteur;
  reply: (c: Convo) => void;
  openPeer: (c: Convo) => void;
  toggleClose: (c: Convo) => Promise<void>;
  editDraft: (e: Email) => void;
  forward: (e: Email) => void;
  toggleLu: (e: Email) => Promise<void>;
  openAssign: (e: Email) => void;
  remove: (e: Email) => Promise<void>;
}) {
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const toggleThread = (k: string) => setOpenThreads((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // Pastille canal (e-mail / WhatsApp)
  const channelIcon = (c: EmailCanal, cls = 'h-4 w-4') => (c === 'whatsapp' ? <MessageCircle className={cls} /> : <Mail className={cls} />);

  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {convos.map((c) => {
        const expanded = openThreads.has(c.key);
        const last = newestFirst(c)[0];
        const aff = affectationLabel(c);
        return (
          <div key={c.key} className={convoSelected(c) ? 'bg-brand-500/5' : ''}>
            {/* En-tête : interlocuteur, dernière interaction, canaux, affectation */}
            <div className="flex items-start gap-2.5 p-3">
              <input type="checkbox" className="mt-2 shrink-0" checked={convoSelected(c)} onChange={() => toggleConvo(c)} title="Sélectionner la conversation" />
              <button onClick={() => toggleThread(c.key)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <div className={cn('mt-0.5 shrink-0 rounded-full p-2', TONE_TILE[c.lastCanal === 'whatsapp' ? 'success' : c.lastDir === 'entrant' ? 'info' : 'brand'])}>
                  {channelIcon(c.lastCanal, 'h-5 w-5')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {c.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" title="Non lu" />}
                    <p className={`truncate ${c.unread ? 'font-semibold' : 'font-medium'} text-fg`}>{c.label}</p>
                    {c.channels.has('email') && <Mail className="h-3 w-3 shrink-0 text-muted" />}
                    {c.channels.has('whatsapp') && <MessageCircle className="h-3 w-3 shrink-0 text-emerald-500" />}
                    <span className="shrink-0 text-xs text-muted">· {c.emails.length}</span>
                    {c.emails.some((e) => e.attachments && e.attachments.length > 0) && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted" />}
                    <span className="ml-auto shrink-0 text-xs text-muted">{formatDate(c.lastAt, 'dd/MM/yyyy HH:mm')}</span>
                    {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted" />}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    <span className="text-fg/70">{last.direction === 'entrant' ? '↩ ' : '↪ '}{last.sujet || (last.canal === 'whatsapp' ? 'WhatsApp' : '(sans objet)')}</span>
                    {last.corps ? ` — ${last.corps}` : ''}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {c.kind ? (
                      <>
                        <Badge tone={KIND_TONE[c.kind]}>{KIND_LABEL[c.kind]}</Badge>
                        <Badge tone={c.owners.size > 0 ? 'neutral' : 'info'}>{aff ?? 'Direction'}</Badge>
                      </>
                    ) : c.hasInbound ? <Badge tone="warning">Non rattaché</Badge> : null}
                    {/* Statut de traitement : réponse apportée / attendue / discussion close. */}
                    {c.closed
                      ? <Badge tone="neutral">Discussion close</Badge>
                      : c.answered ? <Badge tone="success">Répondu</Badge> : <Badge tone="warning">À répondre</Badge>}
                    {c.oppStage && <Badge tone="info">Opportunité · {OPP_STAGE_LABELS[c.oppStage] ?? c.oppStage}</Badge>}
                    {/* Repère visuel : un brouillon attend d'être finalisé dans ce fil. */}
                    {c.emails.some((e) => e.statut === 'brouillon') && <Badge tone="warning">Brouillon à finaliser</Badge>}
                  </div>
                </div>
              </button>

              {/* Accès direct à la fiche du contact, ou création si l'interlocuteur est inconnu. */}
              <div className="flex shrink-0 items-center gap-0.5">
                <button onClick={() => reply(c)} title="Répondre" className="rounded p-1.5 text-muted hover:text-brand-600">
                  <Reply className="h-4 w-4" />
                </button>
                <button
                  onClick={() => openPeer(c)}
                  title={c.contactId ? 'Ouvrir la fiche du contact' : 'Créer ce contact dans Contacts'}
                  className="rounded p-1.5 text-muted hover:text-brand-600"
                >
                  {c.contactId ? <UserRound className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => toggleClose(c)}
                  title={c.closed ? 'Rouvrir la discussion' : 'Clore la discussion (aucune réponse attendue)'}
                  className={cn('rounded p-1.5 hover:text-brand-600', c.closed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted')}
                >
                  {c.closed ? <CircleSlash2 className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Détail déplié : tag interlocuteur + Répondre, puis fil façon chat */}
            {expanded && (
              <div className="border-t border-line bg-surface-2/40">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  {c.kind ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white">
                      <UserCog className="h-3.5 w-3.5" /> {c.label} <span className="opacity-80">· {aff ?? 'Direction'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <TriangleAlert className="h-3.5 w-3.5" /> {c.label} · non rattaché
                    </span>
                  )}
                  <Button variant="secondary" onClick={() => reply(c)}><Reply className="h-4 w-4" /> Répondre</Button>
                </div>
                <div className="max-h-[28rem] space-y-3 overflow-y-auto p-3 pt-0">
                  {c.emails.map((e) => {
                    const wa = e.canal === 'whatsapp';
                    return (
                      <div key={e.id} className={`flex ${e.direction === 'sortant' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[88%] rounded-xl border p-3 ${wa ? 'border-emerald-500/20 bg-emerald-500/5' : e.direction === 'sortant' ? 'border-brand-500/20 bg-brand-500/5' : 'border-line bg-surface'}`}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted">
                            <span className="flex min-w-0 items-center gap-1 truncate">
                              {channelIcon(e.canal, 'h-3 w-3 shrink-0')}
                              {e.direction === 'entrant' ? `De ${e.expediteur ?? '—'}` : `À ${e.destinataires.join(', ') || '—'}`}
                              {e.copie?.length > 0 && <span className="truncate">· copie : {e.copie.join(', ')}</span>}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              {/* Un avis de non-remise arrive en « entrant » : il doit rester visible. */}
                              {e.statut === 'echec'
                                ? <Badge tone="danger">non délivré</Badge>
                                : e.direction === 'sortant' && !wa && <Badge tone={e.statut === 'envoye' ? 'success' : 'neutral'}>{e.statut}</Badge>}
                              {e.direction === 'sortant' && !wa && e.statut !== 'brouillon' && <BadgeExpediteur x={expediteurDe(e)} />}
                              {formatDate(e.sent_at ?? e.created_at, 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                          {!wa && e.sujet && <p className="mb-1 text-sm font-medium text-fg">{e.sujet}</p>}
                          {e.corps && <p className="whitespace-pre-wrap break-words text-sm text-fg"><LinkedText text={e.corps} /></p>}
                          {e.attachments && e.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {e.attachments.map((a, i) => <PieceJointeLien key={i} piece={a} />)}
                            </div>
                          )}
                          <div className="mt-2 flex items-center justify-end gap-1">
                            {e.direction === 'sortant' && e.statut === 'brouillon' && (
                              <button onClick={() => editDraft(e)} title="Reprendre le brouillon" className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-500/10 dark:text-brand-400">
                                <Pencil className="h-3.5 w-3.5" /> Reprendre
                              </button>
                            )}
                            {/* Transfert : e-mail uniquement — un message WhatsApp
                                part par wa.me, sans pièces jointes ni objet. */}
                            {!wa && e.statut !== 'brouillon' && (
                              <button onClick={() => forward(e)} title="Transférer ce message" className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-muted hover:bg-brand-500/10 hover:text-brand-600 dark:hover:text-brand-400">
                                <Forward className="h-3.5 w-3.5" /> Transférer
                              </button>
                            )}
                            {/* Lu / non lu : le message peut être remis en « à traiter ». */}
                            {e.direction === 'entrant' && (
                              <button
                                onClick={() => toggleLu(e)}
                                title={e.lu ? 'Marquer comme non lu' : 'Marquer comme lu'}
                                className={cn('rounded p-1 hover:text-brand-600', e.lu ? 'text-muted' : 'text-brand-600 dark:text-brand-400')}
                              >
                                {e.lu ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                              </button>
                            )}
                            {e.direction === 'entrant' && !wa && <button onClick={() => openAssign(e)} title="Affecter à un contact/conseiller" className="rounded p-1 text-muted hover:text-brand-600"><UserCog className="h-4 w-4" /></button>}
                            <button onClick={() => remove(e)} title="Supprimer ce message" className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, ArrowDownLeft, ArrowUpRight, PenSquare, Reply, ExternalLink, FolderLock, Check, Paperclip } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Button, Card, Badge, Spinner } from '@/components/ui';
import ComposeMessageModal, { type ComposeInitial } from '@/components/ComposeMessageModal';
import PieceJointeLien from '@/components/PieceJointeLien';
import { copyToBucket, type Bucket } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, fullName } from '@/lib/utils';
import type { Dossier, Contact, Email, EmailAttachment } from '@/lib/database.types';

/**
 * Onglet « Messagerie » du dossier client : derniers messages échangés avec le
 * bénéficiaire (ou rattachés au dossier), et envoi d'un nouveau message ou
 * d'une réponse. Les messages envoyés d'ici sont journalisés comme ailleurs.
 */
export default function OngletMessagerie({ dossier, contact }: { dossier: Dossier; contact: Contact | null }) {
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeInitial | null>(null);
  const { session } = useAuth();
  // Pièces reçues déjà rangées dans le coffre-fort pendant cette visite.
  const [ranges, setRanges] = useState<Set<string>>(new Set());

  /** Copie une pièce reçue dans le coffre-fort du bénéficiaire (ex. convention signée en retour). */
  const rangerAuCoffre = async (e: Email, a: EmailAttachment) => {
    if (!dossier.contact_id || !a.bucket) return;
    const { path, error } = await copyToBucket(a.bucket as Bucket, a.url, 'coffre');
    if (error || !path) { alert(`Copie impossible : ${error ?? 'chemin vide'}`); return; }
    const { error: insErr } = await supabase.from('contact_documents').insert({
      contact_id: dossier.contact_id, titre: a.filename, categorie: 'Reçu par e-mail',
      fichier_url: path, created_by: session?.user.id ?? null,
    });
    if (insErr) { alert(insErr.message); return; }
    setRanges((prev) => new Set(prev).add(`${e.id}:${a.url}`));
  };

  const charger = useCallback(async () => {
    const filtre = [`dossier_id.eq.${dossier.id}`, dossier.contact_id ? `contact_id.eq.${dossier.contact_id}` : '']
      .filter(Boolean).join(',');
    const { data } = await supabase.from('emails').select('*').or(filtre)
      .neq('statut', 'brouillon').order('created_at', { ascending: false }).limit(50);
    setEmails(data ?? []);
  }, [dossier.id, dossier.contact_id]);
  useEffect(() => { void charger(); }, [charger]);
  useRealtimeRefresh('emails', charger);

  const base: ComposeInitial = { canal: 'email', contactId: dossier.contact_id, dossierId: dossier.id };
  const nouveau = () => setCompose({ ...base, dest: contact?.email ?? '' });
  const repondre = (e: Email) => setCompose({
    ...base,
    canal: e.canal,
    dest: e.direction === 'entrant' ? (e.expediteur ?? '') : e.destinataires.join(', '),
    sujet: /^re\s*:/i.test(e.sujet) ? e.sujet : `Re : ${e.sujet}`,
    corps: `\n\n— Le ${formatDate(e.sent_at ?? e.created_at, 'dd/MM/yyyy HH:mm')}, ${e.expediteur ?? ''} a écrit :\n${(e.corps ?? '').split('\n').map((l) => `> ${l}`).join('\n')}`,
  });

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold text-fg">
          <Mail className="h-4 w-4 text-brand-500" /> Messagerie
          {contact && <span className="text-sm font-normal text-muted">· {fullName(contact.prenom, contact.nom)}{contact.email ? ` <${contact.email}>` : ''}</span>}
        </h2>
        <div className="flex items-center gap-2">
          <Link to="/messagerie" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-600">
            <ExternalLink className="h-3.5 w-3.5" /> Toute la messagerie
          </Link>
          <Button onClick={nouveau}><PenSquare className="h-4 w-4" /> Nouveau message</Button>
        </div>
      </div>

      {emails === null ? <div className="flex justify-center py-8"><Spinner /></div>
        : emails.length === 0 ? <p className="text-sm text-muted">Aucun message échangé avec ce bénéficiaire.</p> : (
          <ul className="space-y-1.5">
            {emails.map((e) => {
              const entrant = e.direction === 'entrant';
              return (
                <li key={e.id} className="rounded-lg border border-line">
                  <button onClick={() => setOuvert(ouvert === e.id ? null : e.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2">
                    {entrant ? <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-500" /> : <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-500" />}
                    {e.canal === 'whatsapp' && <MessageCircle className="h-4 w-4 shrink-0 text-muted" />}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${entrant && !e.lu ? 'font-semibold text-fg' : 'text-fg'}`}>{e.sujet || '(sans objet)'}</span>
                      <span className="block truncate text-xs text-muted">
                        {entrant ? `De ${e.expediteur ?? '—'}` : `À ${e.destinataires.join(', ')}`}
                        {e.attachments?.length ? ` · ${e.attachments.length} pièce(s) jointe(s)` : ''}
                      </span>
                    </span>
                    {e.statut === 'erreur' && <Badge tone="danger">Échec</Badge>}
                    <span className="shrink-0 text-xs text-muted">{formatDate(e.sent_at ?? e.created_at, 'dd/MM/yyyy HH:mm')}</span>
                  </button>
                  {ouvert === e.id && (
                    <div className="border-t border-line px-3 py-3">
                      <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-sm text-fg">{e.corps ?? ''}</pre>
                      {(e.attachments ?? []).length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="flex items-center gap-1 text-xs font-medium text-muted"><Paperclip className="h-3.5 w-3.5" /> Pièces jointes</p>
                          {(e.attachments ?? []).map((a, i) => {
                            const range = ranges.has(`${e.id}:${a.url}`);
                            return (
                              <div key={i} className="flex flex-wrap items-center gap-2">
                                <PieceJointeLien piece={a} />
                                {a.bucket && dossier.contact_id && (
                                  <button type="button" onClick={() => void rangerAuCoffre(e, a)} disabled={range}
                                    className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-600 disabled:text-emerald-600">
                                    {range ? <><Check className="h-3.5 w-3.5" /> Dans le coffre-fort</> : <><FolderLock className="h-3.5 w-3.5" /> Ranger dans le coffre-fort</>}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-2 flex justify-end">
                        <Button variant="secondary" onClick={() => repondre(e)}><Reply className="h-4 w-4" /> Répondre</Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

      <ComposeMessageModal open={!!compose} onClose={() => setCompose(null)} initial={compose ?? {}} onSent={() => void charger()} />
    </Card>
  );
}

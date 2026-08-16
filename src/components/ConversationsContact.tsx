import { useCallback, useEffect, useState } from 'react';
import { Mic, Play, FileText, Loader2, RefreshCw, TriangleAlert as AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { formatDuree } from '@/lib/audioRecorder';
import { traiterConversation } from '@/lib/conversation';
import type { Conversation } from '@/lib/database.types';

const LIBELLE_STATUT: Record<Conversation['statut'], string> = {
  en_cours: 'enregistrement en cours',
  a_traiter: 'à transcrire',
  traitement: 'transcription en cours',
  traitee: 'traitée',
  erreur: 'échec',
};

/**
 * Conversations enregistrées depuis la Capture mobile pour ce contact :
 * compte-rendu, transcription et réécoute de l'audio (URL signée à la demande,
 * le bucket est privé).
 */
export default function ConversationsContact({ contactId }: { contactId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [audio, setAudio] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data } = await supabase.from('conversations')
      .select('*').eq('contact_id', contactId).order('demarree_at', { ascending: false });
    setConversations((data ?? []) as Conversation[]);
  }, [contactId]);
  useEffect(() => { void charger(); }, [charger]);

  // Bucket privé : une URL signée d'une heure par morceau, générée à l'ouverture.
  const preparerAudio = async (c: Conversation) => {
    if (audio[c.id]) return;
    const urls: string[] = [];
    for (const seg of c.segments ?? []) {
      const { data } = await supabase.storage.from('conversations').createSignedUrl(seg.path, 3600);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    setAudio((prev) => ({ ...prev, [c.id]: urls }));
  };

  const basculer = (c: Conversation) => {
    const suivant = ouverte === c.id ? null : c.id;
    setOuverte(suivant);
    if (suivant) void preparerAudio(c);
  };

  const relancer = async (c: Conversation) => {
    setBusy(c.id);
    await traiterConversation(c.id);
    setBusy(null);
    void charger();
  };

  if (!conversations.length) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Mic className="h-4 w-4 text-muted" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Conversations enregistrées</h3>
        <span className="ml-auto text-xs text-muted">{conversations.length}</span>
      </div>

      <ul className="space-y-1.5">
        {conversations.map((c) => (
          <li key={c.id} className="rounded-lg border border-line">
            <button onClick={() => basculer(c)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm">
              <span className="flex-1 text-fg">
                {formatDate(c.demarree_at, 'dd/MM/yyyy HH:mm')}
                {c.duree_secondes ? ` · ${formatDuree(c.duree_secondes)}` : ''}
              </span>
              <span className="shrink-0 text-xs text-muted">{LIBELLE_STATUT[c.statut]}</span>
            </button>

            {ouverte === c.id && (
              <div className="space-y-3 border-t border-line px-2.5 py-2.5">
                {c.resume && <p className="whitespace-pre-line text-sm text-fg">{c.resume}</p>}

                {c.statut === 'erreur' && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{c.erreur ?? 'Le traitement a échoué.'}</span>
                  </div>
                )}

                {(c.statut === 'a_traiter' || c.statut === 'erreur') && (
                  <button onClick={() => void relancer(c)} disabled={busy === c.id} className="btn-secondary py-1.5 text-sm">
                    {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Relancer la transcription
                  </button>
                )}

                {(audio[c.id] ?? []).map((url, i) => (
                  <div key={url} className="flex items-center gap-2">
                    <Play className="h-3.5 w-3.5 shrink-0 text-muted" />
                    <span className="shrink-0 text-xs text-muted">{i + 1}</span>
                    <audio controls preload="none" src={url} className="h-8 w-full" />
                  </div>
                ))}

                {c.transcription && (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">
                      <FileText className="mr-1 inline h-3.5 w-3.5" />Transcription complète
                    </summary>
                    <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-lg bg-surface-2 p-2.5 text-xs text-muted">
                      {c.transcription}
                    </p>
                  </details>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

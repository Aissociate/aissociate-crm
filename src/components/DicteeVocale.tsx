// Bouton micro : dictée vocale des instructions de l'assistant IA.
// Enregistre un unique blob (dictée courte, 2 min max), l'envoie en base64 à
// l'Edge Function `agent` (mode "transcribe") et rend le texte via onTexte —
// le texte atterrit dans le champ de saisie, l'utilisateur relit avant d'envoyer.
import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { pickMime, micSupporte, formatDuree } from '@/lib/audioRecorder';
import { Spinner } from '@/components/ui';

const MAX_SECONDES = 120;
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent`;

/** Blob → base64 (par tranches, sans exploser la pile sur les gros fichiers). */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** « audio/webm;codecs=opus » → « webm » (format attendu par l'endpoint STT). */
function formatOf(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('wav')) return 'wav';
  return 'webm';
}

type Props = {
  /** Reçoit le texte transcrit (à insérer dans le champ de saisie). */
  onTexte: (texte: string) => void;
  onErreur?: (message: string) => void;
  disabled?: boolean;
};

export default function DicteeVocale({ onTexte, onErreur, disabled }: Props) {
  const [etat, setEtat] = useState<'repos' | 'enregistre' | 'transcrit'>('repos');
  const [secondes, setSecondes] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  /** `true` si l'utilisateur a annulé : le blob final est jeté sans transcription. */
  const annuleRef = useRef(false);

  const liberer = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };
  useEffect(() => () => { annuleRef.current = true; recorderRef.current?.state === 'recording' && recorderRef.current.stop(); liberer(); }, []);

  const transcrire = async (blob: Blob, mime: string) => {
    setEtat('transcrit');
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const res = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: JSON.stringify({ mode: 'transcribe', audio: await blobToBase64(blob), format: formatOf(mime) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
      onTexte(String((body as { texte?: string }).texte ?? '').trim());
    } catch (err) {
      onErreur?.(err instanceof Error ? err.message : String(err));
    } finally {
      setEtat('repos');
    }
  };

  const demarrer = async () => {
    if (!micSupporte()) { onErreur?.("Micro non disponible dans ce navigateur."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      streamRef.current = stream;
      const mime = pickMime();
      chunksRef.current = [];
      annuleRef.current = false;
      const rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 32000, // voix mono : ~480 Ko pour 2 min
      });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = mime || rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        liberer();
        if (annuleRef.current || blob.size === 0) { setEtat('repos'); return; }
        void transcrire(blob, type);
      };
      rec.start();
      recorderRef.current = rec;
      setSecondes(0);
      setEtat('enregistre');
      timerRef.current = window.setInterval(() => {
        setSecondes((s) => {
          if (s + 1 >= MAX_SECONDES) recorderRef.current?.state === 'recording' && recorderRef.current.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      onErreur?.("Accès au micro refusé.");
      liberer();
      setEtat('repos');
    }
  };

  const arreter = () => { recorderRef.current?.state === 'recording' && recorderRef.current.stop(); };

  if (etat === 'transcrit') {
    return (
      <span className="flex h-[44px] items-center gap-1.5 px-2 text-sm text-muted" title="Transcription en cours">
        <Spinner className="h-4 w-4" /> Transcription…
      </span>
    );
  }
  if (etat === 'enregistre') {
    return (
      <button type="button" onClick={arreter}
        className="flex h-[44px] items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 text-sm font-medium text-red-600 transition hover:bg-red-500/20 dark:text-red-400"
        title="Arrêter et transcrire">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        {formatDuree(secondes)}
        <Square className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <button type="button" onClick={() => void demarrer()} disabled={disabled}
      className="flex h-[44px] w-[44px] items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand-300 hover:bg-surface-2 hover:text-brand-600 disabled:opacity-50 dark:hover:text-brand-400"
      title="Dicter votre demande au micro">
      <Mic className="h-4 w-4" />
    </button>
  );
}

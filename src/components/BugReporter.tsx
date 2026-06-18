import { useState, useRef } from 'react';
import { Bug, Camera, X, Send, Loader as Loader2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Field } from '@/components/ui';
import { cn } from '@/lib/utils';

// ─── Capture d'écran via l'API navigateur ──────────────────────────────────────

async function captureScreen(): Promise<Blob | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true } as DisplayMediaStreamOptions);
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        // Délai pour que la première frame soit disponible
        setTimeout(() => {
          const MAX_W = 1280;
          const scale = Math.min(1, MAX_W / video.videoWidth);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
          stream.getTracks().forEach((t) => t.stop());
          canvas.toBlob((blob) => resolve(blob), 'image/png', 0.85);
        }, 150);
      };
    });
  } catch {
    return null;
  }
}

async function uploadScreenshot(blob: Blob, userId: string): Promise<string | null> {
  const path = `${userId}/${Date.now()}.png`;
  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, blob, { contentType: 'image/png' });
  if (error) return null;
  const { data } = supabase.storage.from('screenshots').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Composant ─────────────────────────────────────────────────────────────────

export default function BugReporter() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [priorite, setPriorite] = useState<'faible' | 'normale' | 'haute' | 'critique'>('normale');
  const [capturing, setCapturing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setScreenshot(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTitre('');
    setDescription('');
    setPriorite('normale');
    setSent(false);
  };

  const handleClose = () => { setOpen(false); reset(); };

  const handleCapture = async () => {
    setCapturing(true);
    const blob = await captureScreen();
    setCapturing(false);
    if (!blob) return;
    applyBlob(blob);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyBlob(file);
    if (e.target) e.target.value = '';
  };

  const applyBlob = (blob: Blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setScreenshot(blob);
    setPreviewUrl(URL.createObjectURL(blob));
  };

  const handleSend = async () => {
    if (!session || !description.trim()) return;
    setSending(true);
    let screenshotUrl: string | null = null;
    if (screenshot) {
      screenshotUrl = await uploadScreenshot(screenshot, session.user.id);
    }
    const finalTitre = titre.trim() || (screenshot ? 'Bug signalé via capture d\'écran' : 'Bug signalé');
    await supabase.from('tickets').insert({
      type: 'bug',
      titre: finalTitre,
      description: description.trim(),
      priorite,
      created_by: session.user.id,
      screenshot_url: screenshotUrl,
    });
    setSending(false);
    setSent(true);
    setTimeout(() => { handleClose(); }, 1800);
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => { setOpen(true); setSent(false); }}
        title="Signaler un bug"
        className={cn(
          'fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg',
          'bg-red-600 text-white transition hover:bg-red-500 hover:shadow-xl active:scale-95',
          open && 'invisible',
        )}
      >
        <Bug className="h-4 w-4" />
        <span className="text-sm font-medium">Bug</span>
      </button>

      {/* Popup */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-40 w-[380px] rounded-2xl border border-line bg-surface shadow-2xl"
          style={{ animation: 'slide-up 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}
        >
          {/* En-tête */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-red-500/10 p-1.5 text-red-500">
                <Bug className="h-4 w-4" />
              </div>
              <span className="font-semibold text-fg">Signaler un bug</span>
            </div>
            <button onClick={handleClose} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
                <Send className="h-6 w-6" />
              </div>
              <p className="font-medium text-fg">Bug envoyé !</p>
              <p className="text-sm text-muted">Il apparaît dans l'onglet Développement.</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">

              {/* Zone capture */}
              {previewUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-line">
                  <img src={previewUrl} alt="Capture" className="max-h-40 w-full object-contain bg-surface-2" />
                  <button
                    onClick={() => { setScreenshot(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                    className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/70 p-1 text-white hover:bg-slate-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleCapture}
                    className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-1 text-xs text-white hover:bg-slate-900"
                  >
                    <RefreshCw className="h-3 w-3" /> Recapturer
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleCapture}
                    disabled={capturing}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-2 py-3 text-sm text-muted transition hover:border-red-400 hover:text-red-600 disabled:opacity-60"
                  >
                    {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {capturing ? 'Sélection…' : 'Capturer l\'écran'}
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-surface-2 px-3 text-xs text-muted transition hover:border-brand-400 hover:text-brand-600"
                    title="Importer une image"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              )}

              {/* Titre (optionnel) */}
              <Field label="Titre (optionnel)">
                <input
                  className="input text-sm py-1.5"
                  placeholder="Ex : Le bouton X ne répond plus"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                />
              </Field>

              {/* Description */}
              <Field label="Description" required>
                <textarea
                  className="input min-h-[72px] resize-none text-sm"
                  placeholder="Décrivez le problème : étapes pour reproduire, comportement observé…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>

              {/* Priorité */}
              <Field label="Priorité">
                <div className="flex gap-1.5">
                  {(['faible', 'normale', 'haute', 'critique'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorite(p)}
                      className={cn(
                        'flex-1 rounded-lg border py-1 text-xs font-medium capitalize transition',
                        priorite === p
                          ? {
                              faible:   'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                              normale:  'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
                              haute:    'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                              critique: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
                            }[p]
                          : 'border-line text-muted hover:border-line hover:bg-surface-2',
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleClose} className="btn-secondary flex-1 py-2 text-sm">
                  Annuler
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || !description.trim()}
                  className="btn-primary flex-1 py-2 text-sm disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  {sending ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}

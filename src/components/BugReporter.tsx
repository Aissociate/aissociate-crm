import { useState, useRef, useEffect, useCallback } from 'react';
import { Bug, Camera, X, Send, Loader as Loader2, Image as ImageIcon, RefreshCw, Pencil, Undo2, Check, Monitor } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Field } from '@/components/ui';
import { cn } from '@/lib/utils';
import { capturerFenetre, capturerViaPartage, IGNORER_CAPTURE } from '@/lib/captureEcran';
import { contexteTechnique, installerCollecteErreurs } from '@/lib/bugContext';

installerCollecteErreurs();

type Priorite = 'faible' | 'normale' | 'haute' | 'critique';
const ignorer = { [IGNORER_CAPTURE]: '' };

async function uploadScreenshot(blob: Blob, userId: string): Promise<string | null> {
  const path = `${userId}/${Date.now()}.png`;
  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, blob, { contentType: 'image/png' });
  if (error) return null;
  const { data } = supabase.storage.from('screenshots').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Annotation au stylo sur la capture ───────────────────────────────────────

function Annotateur({ image, onValider, onAnnuler }: { image: Blob; onValider: (b: Blob) => void; onAnnuler: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historique = useRef<ImageData[]>([]);
  const dessin = useRef<{ x: number; y: number } | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(image);
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')?.drawImage(img, 0, 0);
      setPret(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const debut = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    c.setPointerCapture(e.pointerId);
    historique.current.push(ctx.getImageData(0, 0, c.width, c.height));
    dessin.current = point(e);
  };

  const trace = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !dessin.current) return;
    const p = point(e);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = Math.max(3, (canvasRef.current?.width ?? 1000) / 300);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(dessin.current.x, dessin.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dessin.current = p;
  };

  const annulerTrait = () => {
    const c = canvasRef.current;
    const prec = historique.current.pop();
    if (c && prec) c.getContext('2d')?.putImageData(prec, 0, 0);
  };

  const valider = () => canvasRef.current?.toBlob((b) => b && onValider(b), 'image/png');

  return (
    <div {...ignorer} className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-white">
        <Pencil className="h-4 w-4" />
        <span className="text-sm font-medium">Entourez ou soulignez le problème</span>
        <div className="ml-auto flex gap-2">
          <button onClick={annulerTrait} className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
            <Undo2 className="h-4 w-4" /> Annuler le trait
          </button>
          <button onClick={onAnnuler} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">Fermer</button>
          <button onClick={valider} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500">
            <Check className="h-4 w-4" /> Valider
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {!pret && <Loader2 className="h-6 w-6 animate-spin text-white" />}
        <canvas
          ref={canvasRef}
          onPointerDown={debut}
          onPointerMove={trace}
          onPointerUp={() => { dessin.current = null; }}
          className={cn('max-h-full max-w-full cursor-crosshair touch-none rounded-lg shadow-2xl', !pret && 'hidden')}
        />
      </div>
    </div>
  );
}

// ─── Composant ─────────────────────────────────────────────────────────────────

export default function BugReporter() {
  const { session, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [annoter, setAnnoter] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [priorite, setPriorite] = useState<Priorite>('normale');
  const [capturing, setCapturing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [captureEchouee, setCaptureEchouee] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyBlob = useCallback((blob: Blob) => {
    setPreviewUrl((ancien) => { if (ancien) URL.revokeObjectURL(ancien); return URL.createObjectURL(blob); });
    setScreenshot(blob);
  }, []);

  const retirerCapture = () => {
    setScreenshot(null);
    setPreviewUrl((ancien) => { if (ancien) URL.revokeObjectURL(ancien); return null; });
  };

  const reset = () => {
    retirerCapture();
    setTitre('');
    setDescription('');
    setPriorite('normale');
    setSent(false);
    setErreur(null);
    setCaptureEchouee(false);
  };

  const handleClose = () => { setOpen(false); setAnnoter(false); reset(); };

  /** Un clic : capture de la page telle qu'elle est, puis ouverture du formulaire. */
  const signaler = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    setOpen(false);
    // Laisse le navigateur masquer le panneau avant de photographier la page.
    // (setTimeout et non requestAnimationFrame, qui ne se déclenche pas si l'onglet est en arrière-plan.)
    await new Promise((r) => setTimeout(r, 60));
    const blob = await capturerFenetre();
    setCapturing(false);
    setCaptureEchouee(!blob);
    if (blob) applyBlob(blob);
    setSent(false);
    setOpen(true);
  }, [capturing, applyBlob]);

  // Raccourci clavier : Ctrl + Maj + B (Cmd + Maj + B sur Mac).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        void signaler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signaler]);

  const handlePartage = async () => {
    const blob = await capturerViaPartage();
    if (blob) { applyBlob(blob); setCaptureEchouee(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyBlob(file);
    setCaptureEchouee(false);
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!session || !description.trim()) return;
    setSending(true);
    setErreur(null);
    let screenshotUrl: string | null = null;
    if (screenshot) {
      screenshotUrl = await uploadScreenshot(screenshot, session.user.id);
    }
    const finalTitre = titre.trim() || description.trim().split('\n')[0].slice(0, 80);
    const nom = [profile?.prenom, profile?.nom].filter(Boolean).join(' ');
    const qui = [nom, session.user.email].filter(Boolean).join(' · ');
    const { error } = await supabase.from('tickets').insert({
      type: 'bug',
      titre: finalTitre,
      description: description.trim() + contexteTechnique(qui),
      priorite,
      created_by: session.user.id,
      screenshot_url: screenshotUrl,
    });
    setSending(false);
    if (error) { setErreur(`Envoi impossible : ${error.message}`); return; }
    if (screenshot && !screenshotUrl) {
      setErreur('Bug enregistré, mais la capture n\'a pas pu être jointe.');
    }
    setSent(true);
    setTimeout(() => { handleClose(); }, 1800);
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        {...ignorer}
        onClick={() => void signaler()}
        disabled={capturing}
        title="Signaler un bug avec une capture de la page (Ctrl + Maj + B)"
        className={cn(
          'fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg',
          'bg-red-600 text-white transition hover:bg-red-500 hover:shadow-xl active:scale-95 disabled:opacity-80',
          open && 'invisible',
        )}
      >
        {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
        <span className="text-sm font-medium">{capturing ? 'Capture…' : 'Bug'}</span>
      </button>

      {/* Popup */}
      {open && (
        <div
          {...ignorer}
          className="fixed bottom-6 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface shadow-2xl"
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
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
                <Send className="h-6 w-6" />
              </div>
              <p className="font-medium text-fg">Bug envoyé !</p>
              <p className="text-sm text-muted">Il apparaît dans l'onglet Développement.</p>
              {erreur && <p className="text-xs text-amber-600">{erreur}</p>}
            </div>
          ) : (
            <div className="space-y-3 p-4">

              {/* Zone capture */}
              {previewUrl ? (
                <div className="group relative overflow-hidden rounded-lg border border-line">
                  <button onClick={() => setAnnoter(true)} className="block w-full" title="Annoter la capture">
                    <img src={previewUrl} alt="Capture de la page" className="max-h-44 w-full bg-surface-2 object-contain" />
                  </button>
                  <button
                    onClick={retirerCapture}
                    title="Retirer la capture"
                    className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/70 p-1 text-white hover:bg-slate-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                    <button
                      onClick={() => setAnnoter(true)}
                      className="flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-1 text-xs text-white hover:bg-red-600"
                    >
                      <Pencil className="h-3 w-3" /> Annoter
                    </button>
                    <button
                      onClick={() => void signaler()}
                      className="flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-1 text-xs text-white hover:bg-slate-900"
                    >
                      <RefreshCw className="h-3 w-3" /> Reprendre
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {captureEchouee && (
                    <p className="text-xs text-amber-600">La capture automatique a échoué : utilisez le partage d'écran ou importez une image.</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => void signaler()}
                      disabled={capturing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-2 py-3 text-sm text-muted transition hover:border-red-400 hover:text-red-600 disabled:opacity-60"
                    >
                      {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      Capturer la page
                    </button>
                    <button
                      onClick={() => void handlePartage()}
                      className="flex items-center justify-center rounded-lg border border-dashed border-line bg-surface-2 px-3 text-muted transition hover:border-brand-400 hover:text-brand-600"
                      title="Capturer via le partage d'écran (autre fenêtre, autre application…)"
                    >
                      <Monitor className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center justify-center rounded-lg border border-dashed border-line bg-surface-2 px-3 text-muted transition hover:border-brand-400 hover:text-brand-600"
                      title="Importer une image"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              {/* Description */}
              <Field label="Qu'est-ce qui ne va pas ?" required>
                <textarea
                  autoFocus
                  className="input min-h-[72px] resize-none text-sm"
                  placeholder="Ex : le bouton Enregistrer ne fait rien sur cette fiche"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void handleSend(); }}
                />
              </Field>

              {/* Titre (optionnel) */}
              <Field label="Titre (optionnel)">
                <input
                  className="input py-1.5 text-sm"
                  placeholder="Par défaut : début de la description"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
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

              <p className="text-[11px] leading-snug text-muted">
                La page, le navigateur et les dernières erreurs techniques sont joints automatiquement.
              </p>
              {erreur && <p className="text-xs text-red-600">{erreur}</p>}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={handleClose} className="btn-secondary flex-1 py-2 text-sm">
                  Annuler
                </button>
                <button
                  onClick={() => void handleSend()}
                  disabled={sending || !description.trim()}
                  className="btn-primary flex-1 py-2 text-sm disabled:opacity-60"
                  title="Envoyer (Ctrl + Entrée)"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  {sending ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {annoter && screenshot && (
        <Annotateur
          image={screenshot}
          onAnnuler={() => setAnnoter(false)}
          onValider={(b) => { applyBlob(b); setAnnoter(false); }}
        />
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

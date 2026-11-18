import { useCallback, useEffect, useRef, useState } from 'react';
import { Bug, Camera, Image as ImageIcon, Loader2, Monitor, Pencil, RefreshCw, Send, X } from 'lucide-react';
import { appel } from '../api';
// Modules autonomes partagés avec le CRM (aucune dépendance à Supabase ni à l'auth du CRM).
import { capturerFenetre, capturerViaPartage, IGNORER_CAPTURE } from '../../lib/captureEcran';
import { contexteTechnique, installerCollecteErreurs } from '../../lib/bugContext';
import AnnotateurCapture from '../../lib/AnnotateurCapture';

installerCollecteErreurs();

type Priorite = 'faible' | 'normale' | 'haute' | 'critique';
const PRIORITES: Priorite[] = ['faible', 'normale', 'haute', 'critique'];
const ignorer = { [IGNORER_CAPTURE]: '' };

function enBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Les images importées (JPEG, WebP…) sont converties en PNG : le serveur n'accepte que ce format. */
async function enPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  c.getContext('2d')?.drawImage(bitmap, 0, 0);
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Conversion impossible'))), 'image/png'));
}

/** Événement qui ouvre le signalement (déclenché par l'entrée du menu). */
export const EVENEMENT_SIGNALER = 'studio:signaler-bug';
export const ouvrirSignalement = () => window.dispatchEvent(new Event(EVENEMENT_SIGNALER));

/**
 * Signalement d'un problème depuis le Studio : capture de la page en un clic, annotation,
 * envoi à l'équipe Aissociate. Ouvert par l'entrée « Signaler un problème » du menu
 * (pas de bouton flottant : il masquerait la zone de saisie du chat) ou par Ctrl + Maj + B.
 */
export default function SignalerBug() {
  const [ouvert, setOuvert] = useState(false);
  const [capture, setCapture] = useState<Blob | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [annoter, setAnnoter] = useState(false);
  const [description, setDescription] = useState('');
  const [titre, setTitre] = useState('');
  const [priorite, setPriorite] = useState<Priorite>('normale');
  const [capturant, setCapturant] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [captureEchouee, setCaptureEchouee] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  const appliquer = useCallback((b: Blob) => {
    setApercu((ancien) => { if (ancien) URL.revokeObjectURL(ancien); return URL.createObjectURL(b); });
    setCapture(b);
  }, []);

  const retirer = () => {
    setCapture(null);
    setApercu((ancien) => { if (ancien) URL.revokeObjectURL(ancien); return null; });
  };

  const fermer = () => {
    setOuvert(false); setAnnoter(false); retirer();
    setDescription(''); setTitre(''); setPriorite('normale');
    setEnvoye(false); setErreur(null); setCaptureEchouee(false);
  };

  const signaler = useCallback(async () => {
    if (capturant) return;
    setCapturant(true);
    setOuvert(false);
    await new Promise((r) => setTimeout(r, 60)); // laisse le panneau disparaître avant la photo
    const b = await capturerFenetre();
    setCapturant(false);
    setCaptureEchouee(!b);
    if (b) appliquer(b);
    setEnvoye(false);
    setOuvert(true);
  }, [capturant, appliquer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); void signaler(); }
    };
    const onOuvrir = () => void signaler();
    window.addEventListener('keydown', onKey);
    window.addEventListener(EVENEMENT_SIGNALER, onOuvrir);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(EVENEMENT_SIGNALER, onOuvrir); };
  }, [signaler]);

  const envoyer = async () => {
    if (!description.trim() || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await appel<{ capture_echouee?: boolean }>('bug_signaler', {
        description: description.trim(),
        titre: titre.trim(),
        priorite,
        contexte: contexteTechnique().trim(),
        capture: capture ? await enBase64(await enPng(capture)) : null,
      });
      if (r.capture_echouee) setErreur('Message bien reçu, mais la capture n\'a pas pu être jointe.');
      setEnvoye(true);
      setTimeout(fermer, 2200);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      {capturant && (
        <div {...ignorer} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" /> Capture de la page…
        </div>
      )}

      {ouvert && (
        <div {...ignorer} className="fixed bottom-5 right-5 z-40 w-[380px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <p className="flex items-center gap-2 font-semibold"><Bug className="h-4 w-4 text-orange-500" /> Signaler un problème</p>
            <button onClick={fermer} className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Fermer"><X className="h-4 w-4" /></button>
          </div>

          {envoye ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <div className="rounded-full bg-emerald-50 p-3 text-emerald-600"><Send className="h-6 w-6" /></div>
              <p className="font-medium">Merci, c'est transmis !</p>
              <p className="text-sm text-neutral-500">L'équipe Aissociate s'en occupe.</p>
              {erreur && <p className="text-xs text-amber-600">{erreur}</p>}
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {apercu ? (
                <div className="relative overflow-hidden rounded-xl border border-neutral-200">
                  <button onClick={() => setAnnoter(true)} className="block w-full" title="Annoter la capture">
                    <img src={apercu} alt="Capture de la page" className="max-h-44 w-full bg-neutral-50 object-contain" />
                  </button>
                  <button onClick={retirer} title="Retirer la capture" className="absolute right-1.5 top-1.5 rounded-full bg-neutral-900/70 p-1 text-white hover:bg-neutral-900"><X className="h-3 w-3" /></button>
                  <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                    <button onClick={() => setAnnoter(true)} className="flex items-center gap-1 rounded-full bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600"><Pencil className="h-3 w-3" /> Annoter</button>
                    <button onClick={() => void signaler()} className="flex items-center gap-1 rounded-full bg-neutral-900/70 px-2 py-1 text-xs text-white hover:bg-neutral-900"><RefreshCw className="h-3 w-3" /> Reprendre</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {captureEchouee && <p className="text-xs text-amber-600">La capture automatique a échoué : utilisez le partage d'écran ou importez une image.</p>}
                  <div className="flex gap-2">
                    <button onClick={() => void signaler()} disabled={capturant} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-3 text-sm text-neutral-500 hover:border-orange-300 hover:text-orange-600">
                      <Camera className="h-4 w-4" /> Capturer la page
                    </button>
                    <button onClick={async () => { const b = await capturerViaPartage(); if (b) { appliquer(b); setCaptureEchouee(false); } }} title="Capturer via le partage d'écran" className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 text-neutral-500 hover:border-orange-300 hover:text-orange-600">
                      <Monitor className="h-4 w-4" />
                    </button>
                    <button onClick={() => fichierRef.current?.click()} title="Importer une image" className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 text-neutral-500 hover:border-orange-300 hover:text-orange-600">
                      <ImageIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              <input ref={fichierRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { appliquer(f); setCaptureEchouee(false); } e.target.value = ''; }} />

              <label className="block text-sm">
                <span className="font-medium">Qu'est-ce qui ne va pas ? <span className="text-orange-500">*</span></span>
                <textarea autoFocus value={description} onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void envoyer(); }}
                  placeholder="Ex : l'agent ne répond plus quand j'envoie un fichier"
                  className="mt-1 min-h-[72px] w-full resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-orange-400" />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Titre (optionnel)</span>
                <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Par défaut : début de la description"
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-orange-400" />
              </label>
              <div className="text-sm">
                <span className="font-medium">Urgence</span>
                <div className="mt-1 flex gap-1.5">
                  {PRIORITES.map((p) => (
                    <button key={p} onClick={() => setPriorite(p)}
                      className={`flex-1 rounded-lg border py-1 text-xs font-medium capitalize ${priorite === p ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] leading-snug text-neutral-400">La page et votre navigateur sont joints automatiquement pour nous aider à reproduire le problème.</p>
              {erreur && <p className="text-xs text-red-600">{erreur}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={fermer} className="flex-1 rounded-xl border border-neutral-200 py-2 text-sm hover:bg-neutral-50">Annuler</button>
                <button onClick={() => void envoyer()} disabled={envoi || !description.trim()} title="Envoyer (Ctrl + Entrée)"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-900 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                  {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {envoi ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {annoter && capture && (
        <AnnotateurCapture image={capture} onAnnuler={() => setAnnoter(false)} onValider={(b) => { appliquer(b); setAnnoter(false); }} />
      )}
    </>
  );
}

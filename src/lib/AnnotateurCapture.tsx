import { useEffect, useRef, useState } from 'react';
import { Check, Loader as Loader2, Pencil, Undo2 } from 'lucide-react';
import { IGNORER_CAPTURE } from './captureEcran';

// Annotation au stylo d'une capture d'écran. Module autonome (aucune dépendance au CRM) :
// partagé par le bouton « Bug » du CRM et celui du Studio.

export default function AnnotateurCapture({ image, onValider, onAnnuler }: { image: Blob; onValider: (b: Blob) => void; onAnnuler: () => void }) {
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
    <div {...{ [IGNORER_CAPTURE]: '' }} className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 p-4">
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
          className={`max-h-full max-w-full cursor-crosshair touch-none rounded-lg shadow-2xl${pret ? '' : ' hidden'}`}
        />
      </div>
    </div>
  );
}

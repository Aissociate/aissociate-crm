import { useRef, useState } from 'react';
import { Upload, ExternalLink, X, Loader2 } from 'lucide-react';
import { uploadFile, openFile, type Bucket } from '@/lib/storage';

/** Bouton d'upload : téléverse dans le bucket et renvoie la valeur à stocker. */
export function FileUpload({
  bucket, onUploaded, label = 'Téléverser',
}: { bucket: Bucket; onUploaded: (value: string, file?: File) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const { value, error } = await uploadFile(bucket, file);
    setBusy(false);
    if (e.target) e.target.value = '';
    if (error || !value) { alert(error ?? 'Échec du téléversement'); return; }
    onUploaded(value, file);
  };

  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? 'Envoi…' : label}
      </button>
      <input ref={ref} type="file" className="hidden" onChange={handle} />
    </>
  );
}

/** Lien d'ouverture d'un fichier stocké (gère public et URL signée privée). */
export function FileLink({
  bucket, value, onClear,
}: { bucket: Bucket; value: string | null; onClear?: () => void }) {
  if (!value) return <span className="text-xs text-slate-400">Aucun fichier</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={() => openFile(bucket, value)}
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
        <ExternalLink className="h-4 w-4" /> Ouvrir
      </button>
      {onClear && (
        <button type="button" onClick={onClear} className="rounded p-0.5 text-slate-300 hover:text-red-600" title="Retirer">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

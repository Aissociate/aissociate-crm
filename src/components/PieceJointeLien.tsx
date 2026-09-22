import { Paperclip } from 'lucide-react';
import { openFile, type Bucket } from '@/lib/storage';
import type { EmailAttachment } from '@/lib/database.types';

const CLASSES = 'inline-flex max-w-[14rem] items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-brand-600 dark:text-brand-400 hover:bg-surface';

/** Taille lisible : « 245 Ko », « 1,2 Mo ». */
const taille = (o?: number) => (!o ? '' : o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);

/**
 * Pièce jointe d'un message. Deux formes coexistent :
 *  - envoyée : URL complète (signée au moment de l'envoi) → lien direct ;
 *  - reçue : chemin dans un bucket privé (`bucket` renseigné) → URL signée
 *    générée au clic, donc toujours valide.
 */
export default function PieceJointeLien({ piece }: { piece: EmailAttachment }) {
  const contenu = (
    <>
      <Paperclip className="h-3 w-3 shrink-0" />
      <span className="truncate">{piece.filename}</span>
      {piece.taille ? <span className="shrink-0 text-muted">· {taille(piece.taille)}</span> : null}
    </>
  );
  if (piece.bucket) {
    return (
      <button type="button" onClick={() => void openFile(piece.bucket as Bucket, piece.url)} className={CLASSES} title="Ouvrir la pièce jointe">
        {contenu}
      </button>
    );
  }
  return <a href={piece.url} target="_blank" rel="noreferrer" className={CLASSES}>{contenu}</a>;
}

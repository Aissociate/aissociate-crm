// Boutons « Word » et « PDF » sous une réponse d'agent ou un contenu gardé.
import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { exporterPdf, exporterWord, type Source } from './exports';
import { cx } from './composants';

export default function BoutonsExport({ source, className }: { source: Source; className?: string }) {
  const [enCours, setEnCours] = useState<'' | 'word' | 'pdf'>('');
  const [erreur, setErreur] = useState('');

  const lancer = async (format: 'word' | 'pdf') => {
    setEnCours(format); setErreur('');
    try { await (format === 'word' ? exporterWord(source) : exporterPdf(source)); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Export impossible'); }
    finally { setEnCours(''); }
  };

  const bouton = (format: 'word' | 'pdf', libelle: string) => (
    <button type="button" onClick={() => void lancer(format)} disabled={Boolean(enCours)}
      title={format === 'word' ? 'Télécharger en Word (.docx), avec votre papier à en-tête' : 'Enregistrer en PDF, avec votre papier à en-tête'}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-60">
      {enCours === format ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} {libelle}
    </button>
  );

  return (
    <span className={cx('inline-flex items-center gap-0.5', className)}>
      {bouton('word', 'Word')}
      {bouton('pdf', 'PDF')}
      {erreur && <span className="text-xs text-red-600" role="alert">{erreur}</span>}
    </span>
  );
}

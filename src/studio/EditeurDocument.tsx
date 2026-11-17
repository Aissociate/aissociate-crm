// Panneau de droite : document HTML d'un agent, modifiable en WYSIWYG, exportable en PDF
// ou Word. Le document est affiché dans un cadre isolé SANS script (sandbox sans
// allow-scripts) passé en mode édition : un contenu malveillant ne peut rien exécuter.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Download, FileText, Heading1, Heading2, Italic, Link2, List, ListOrdered, Loader2, Redo2, RemoveFormatting, Save, Underline, Undo2, X } from 'lucide-react';
import { appel } from './api';
import { exporterDocumentHtml } from './exports';
import { separer } from './htmlSur';
import { cx } from './composants';

export type DocumentHtml = { id: string; titre: string; contenu: string; statut?: string };

const BASE = `<style>
html { background: #f5f5f4; }
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #1f2937; font-size: 15px; line-height: 1.55;
  background: #fff; max-width: 820px; margin: 24px auto; padding: 40px 48px; box-shadow: 0 1px 4px rgba(0,0,0,.08); min-height: 80vh; }
body:focus { outline: none; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; max-width: 100%; } th, td { border: 1px solid #d1d5db; padding: 4px 8px; vertical-align: top; }
</style>`;

export default function EditeurDocument({ doc, agent, nomEspace, onClose, onSaved, gerer }: {
  doc: DocumentHtml; agent: string; nomEspace: string;
  onClose: () => void; onSaved?: () => void; gerer: (e: unknown) => string;
}) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const [titre, setTitre] = useState(doc.titre);
  const [modifie, setModifie] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [export_, setExport] = useState<'' | 'pdf' | 'word'>('');
  const [message, setMessage] = useState('');
  const { styles, corps } = useMemo(() => separer(doc.contenu), [doc.contenu]);
  const srcDoc = useMemo(() => `<!doctype html><html lang="fr"><head><meta charset="utf-8">${BASE}${styles}</head><body>${corps}</body></html>`, [styles, corps]);

  useEffect(() => { setTitre(doc.titre); setModifie(false); }, [doc.id, doc.contenu, doc.titre]);

  // Fermer avec des modifications non enregistrées : on prévient.
  useEffect(() => {
    if (!modifie) return;
    const avant = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avant);
    return () => window.removeEventListener('beforeunload', avant);
  }, [modifie]);

  const docCadre = () => cadre.current?.contentDocument ?? null;
  const charge = () => {
    const d = docCadre();
    if (!d) return;
    d.designMode = 'on';
    d.addEventListener('input', () => setModifie(true));
  };
  const cmd = (c: string, v?: string) => {
    const d = docCadre();
    if (!d) return;
    d.execCommand(c, false, v);
    setModifie(true);
    cadre.current?.contentWindow?.focus();
  };
  const lien = () => {
    const url = prompt('Adresse du lien (https://…)');
    if (url && /^(https?:|mailto:)/i.test(url.trim())) cmd('createLink', url.trim());
  };
  const contenuActuel = () => `${styles}\n${docCadre()?.body.innerHTML ?? corps}`;

  const enregistrer = async () => {
    setEnvoi(true); setMessage('');
    try {
      await appel('livrable_modifier', { id: doc.id, champs: { titre: titre.trim() || doc.titre, contenu: contenuActuel() } });
      setModifie(false); setMessage('Enregistré. Le document repasse « à valider ».');
      onSaved?.();
    } catch (e) { setMessage(gerer(e)); } finally { setEnvoi(false); }
  };
  const exporter = async (f: 'pdf' | 'word') => {
    setExport(f); setMessage('');
    try { await exporterDocumentHtml(f, { titre: titre.trim() || doc.titre, html: contenuActuel(), agent, nomEspace }); }
    catch (e) { setMessage(gerer(e)); } finally { setExport(''); }
  };
  const fermer = () => { if (!modifie || confirm('Fermer sans enregistrer vos modifications ?')) onClose(); };

  const outil = (label: string, icone: React.ReactNode, action: () => void) => (
    <button type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={action}
      className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900">{icone}</button>
  );
  const i = 'h-4 w-4';
  const publie = doc.statut === 'publie';

  return (
    <>
      {/* Grand écran : la page se resserre à gauche pour garder la conversation visible. */}
      <style>{'@media (min-width: 1024px) { main { padding-right: min(50vw, 880px); } }'}</style>
      <aside className="fixed inset-0 z-40 flex flex-col border-l border-neutral-200 bg-white shadow-2xl lg:left-auto lg:w-[min(50vw,880px)]" aria-label="Document">
        <header className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
          <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
          <input value={titre} onChange={(e) => { setTitre(e.target.value); setModifie(true); }} disabled={publie} maxLength={200}
            className="min-w-0 flex-1 rounded-lg px-2 py-1 text-sm font-semibold outline-none hover:bg-neutral-50 focus:bg-neutral-50" aria-label="Titre du document" />
          {modifie && <span className="hidden text-xs text-amber-600 sm:inline">Non enregistré</span>}
          <button onClick={fermer} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Fermer le document"><X className="h-4 w-4" /></button>
        </header>
        {!publie && (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 px-3 py-1.5">
            {outil('Gras', <Bold className={i} />, () => cmd('bold'))}
            {outil('Italique', <Italic className={i} />, () => cmd('italic'))}
            {outil('Souligné', <Underline className={i} />, () => cmd('underline'))}
            <span className="mx-1 h-5 w-px bg-neutral-200" />
            {outil('Titre', <Heading1 className={i} />, () => cmd('formatBlock', '<h1>'))}
            {outil('Sous-titre', <Heading2 className={i} />, () => cmd('formatBlock', '<h2>'))}
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('formatBlock', '<p>')} className="rounded-lg px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100">Texte</button>
            {outil('Liste à puces', <List className={i} />, () => cmd('insertUnorderedList'))}
            {outil('Liste numérotée', <ListOrdered className={i} />, () => cmd('insertOrderedList'))}
            {outil('Lien', <Link2 className={i} />, lien)}
            {outil('Effacer la mise en forme', <RemoveFormatting className={i} />, () => cmd('removeFormat'))}
            <span className="mx-1 h-5 w-px bg-neutral-200" />
            {outil('Annuler', <Undo2 className={i} />, () => cmd('undo'))}
            {outil('Rétablir', <Redo2 className={i} />, () => cmd('redo'))}
          </div>
        )}
        <iframe ref={cadre} key={`${doc.id}:${doc.contenu.length}:${doc.contenu.slice(-40)}`} title={titre}
          sandbox="allow-same-origin" srcDoc={srcDoc} onLoad={charge} className="min-h-0 w-full flex-1 bg-stone-100" />
        <footer className="flex flex-wrap items-center gap-2 border-t border-neutral-200 px-4 py-3">
          {!publie && (
            <button onClick={enregistrer} disabled={envoi || !modifie}
              className={cx('flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium', modifie ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-400')}>
              {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
            </button>
          )}
          <button onClick={() => exporter('pdf')} disabled={Boolean(export_)} className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:border-neutral-900">
            {export_ === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
          </button>
          <button onClick={() => exporter('word')} disabled={Boolean(export_)} className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-sm hover:border-neutral-900">
            {export_ === 'word' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Word
          </button>
          {message && <p className="text-xs text-neutral-500">{message}</p>}
          {publie && <p className="text-xs text-neutral-500">Document publié : il ne se modifie plus.</p>}
        </footer>
      </aside>
    </>
  );
}

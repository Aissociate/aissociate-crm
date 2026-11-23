// Panneau de droite : document HTML d'un agent, modifiable en WYSIWYG, exportable en PDF
// ou Word. Le document est affiché dans un cadre isolé SANS script (sandbox sans
// allow-scripts) ; seule la zone du contenu est éditable : l'en-tête (logo, coordonnées)
// et le pied de page (SIRET, mentions) de « Mon entreprise » l'encadrent, comme à l'export.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Download, FileText, Heading1, Heading2, Italic, Link2, List, ListOrdered, Loader2, Redo2, RemoveFormatting, Save, Underline, Undo2, X } from 'lucide-react';
import { appel } from './api';
import { chargerEntete, exporterDocumentHtml } from './exports';
import { lignesEntete } from './exportDoc';
import { separer } from './htmlSur';
import { cx } from './composants';

/** `versions` : versions précédentes (la version courante est la suivante), pour le nom de fichier. */
export type DocumentHtml = { id: string; titre: string; contenu: string; statut?: string; versions?: unknown[] | null };

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BASE = `<style>
html { background: #f5f5f4; }
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #3a3129; font-size: 15px; line-height: 1.55; margin: 0; }
.feuille { background: #fff; max-width: 820px; margin: 24px auto; padding: 32px 48px 24px; box-shadow: 0 1px 4px rgba(0,0,0,.08); min-height: 80vh; display: flex; flex-direction: column; }
.papier { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #1b1713; padding-bottom: 10px; margin-bottom: 20px; user-select: none; }
.papier img { max-height: 60px; max-width: 200px; object-fit: contain; }
.papier .coord { text-align: right; font-size: 12px; color: #615850; } .papier .nom { font-size: 14px; font-weight: 700; color: #1b1713; }
#doc { flex: 1; outline: none; min-height: 40vh; }
.pied { margin-top: 24px; border-top: 1px solid #e6dcd2; padding-top: 8px; text-align: center; font-size: 11px; color: #a89c90; user-select: none; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; max-width: 100%; } th, td { border: 1px solid #d9cec3; padding: 4px 8px; vertical-align: top; }
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
  // Papier à en-tête de « Mon entreprise », affiché autour du contenu (non modifiable ici).
  const [papier, setPapier] = useState<{ haut: string; bas: string } | null>(null);
  useEffect(() => {
    chargerEntete().then((e) => {
      const l = lignesEntete(e.entete, nomEspace);
      setPapier({
        haut: `<header class="papier" contenteditable="false"><div>${e.logo_url ? `<img src="${echapper(e.logo_url)}" alt="">` : ''}</div>`
          + `<div class="coord"><div class="nom">${echapper(l.nom)}</div>${l.adresse ? `<div>${echapper(l.adresse)}</div>` : ''}${l.contacts ? `<div>${echapper(l.contacts)}</div>` : ''}</div></header>`,
        bas: l.pied ? `<footer class="pied" contenteditable="false">${echapper(l.pied)}</footer>` : '',
      });
    });
  }, [nomEspace]);
  const srcDoc = useMemo(() => `<!doctype html><html lang="fr"><head><meta charset="utf-8">${BASE}${styles}</head><body><div class="feuille">`
    + `${papier?.haut ?? ''}<div id="doc" contenteditable="${doc.statut === 'publie' ? 'false' : 'true'}">${corps}</div>${papier?.bas ?? ''}</div></body></html>`,
  [styles, corps, papier, doc.statut]);

  useEffect(() => { setTitre(doc.titre); setModifie(false); }, [doc.id, doc.contenu, doc.titre]);

  // Fermer avec des modifications non enregistrées : on prévient.
  useEffect(() => {
    if (!modifie) return;
    const avant = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avant);
    return () => window.removeEventListener('beforeunload', avant);
  }, [modifie]);

  const docCadre = () => cadre.current?.contentDocument ?? null;
  const zone = () => docCadre()?.getElementById('doc') ?? null;
  const charge = () => {
    const d = docCadre();
    if (!d) return;
    d.addEventListener('input', () => setModifie(true));
  };
  const cmd = (c: string, v?: string) => {
    const d = docCadre();
    if (!d) return;
    // Sélection hors de la zone éditable (ou aucune) : on place le curseur dans le contenu.
    const z = zone();
    if (z && !z.contains(d.getSelection()?.anchorNode ?? null)) z.focus();
    d.execCommand(c, false, v);
    setModifie(true);
    cadre.current?.contentWindow?.focus();
  };
  const lien = () => {
    const url = prompt('Adresse du lien (https://…)');
    if (url && /^(https?:|mailto:)/i.test(url.trim())) cmd('createLink', url.trim());
  };
  const contenuActuel = () => `${styles}\n${zone()?.innerHTML ?? corps}`;

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
    try { await exporterDocumentHtml(f, { titre: titre.trim() || doc.titre, html: contenuActuel(), agent, nomEspace, id: doc.id, version: (doc.versions?.length ?? 0) + 1 }); }
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
        <iframe ref={cadre} key={`${doc.id}:${doc.contenu.length}:${doc.contenu.slice(-40)}:${papier ? 1 : 0}`} title={titre}
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

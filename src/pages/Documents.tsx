import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Lock, Search, Folder, Bot, FileSearch, Loader as Loader2, HardDrive, Link2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import { isHebergeParApp, fileNameOf } from '@/lib/storage';
import { formatDate, fullName } from '@/lib/utils';
import { ensureDossierClient } from '@/lib/dossierClient';
import { isPdf, extractPdfTextFromFile, extractPdfTextFromUrl } from '@/lib/pdfText';
import type { Document, Contact, Formation } from '@/lib/database.types';

const CATEGORIES = ['general', 'procedure', 'qualiopi', 'modele', 'contractuel', 'reglementaire'];
const empty = (): Partial<Document> => ({
  titre: '', categorie: 'general', description: '', fichier_url: '', version: 1, statut: 'actif', tags: [],
  dossier: '', dossier_id: null, chat_direction: false, chat_conseiller: false,
});

export default function Documents() {
  const { isManager, isAdmin, session } = useAuth();
  const { data, loading, refresh } = useCollection<Document>('documents', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const formations = useCollection<Formation>('formations');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Document>>(empty());
  const [tagsText, setTagsText] = useState('');
  // Sélection transitoire servant à rattacher le document au dossier client.
  const [clientId, setClientId] = useState('');
  const [clientFormationId, setClientFormationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [cat, setCat] = useState('');
  const [fol, setFol] = useState('');
  const [q, setQ] = useState('');
  // Extraction du texte PDF (pour le contexte de l'assistant IA).
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const set = (k: keyof Document, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Téléverse le fichier puis, si c'est un PDF, en extrait le texte pour
  // alimenter l'assistant (champ contenu_texte). Tolérant aux erreurs.
  const onFileUploaded = async (value: string, file?: File) => {
    set('fichier_url', value);
    if (!file || !isPdf(file.name, file.type)) return;
    setExtracting(true);
    setExtractMsg(null);
    try {
      const text = await extractPdfTextFromFile(file);
      if (text) { set('contenu_texte', text); setExtractMsg(`Texte extrait du PDF (${text.length.toLocaleString('fr-FR')} caractères).`); }
      else setExtractMsg('PDF sans texte sélectionnable (scan/image ?) — saisie manuelle possible.');
    } catch (e) {
      setExtractMsg(`Extraction du texte impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExtracting(false);
    }
  };

  // Ré-extraction depuis le fichier déjà rattaché (documents existants).
  const reextract = async () => {
    if (!form.fichier_url || !isPdf(form.fichier_url)) return;
    setExtracting(true);
    setExtractMsg(null);
    try {
      const text = await extractPdfTextFromUrl(form.fichier_url);
      if (text) { set('contenu_texte', text); setExtractMsg(`Texte ré-extrait (${text.length.toLocaleString('fr-FR')} caractères). Enregistrez pour le sauvegarder.`); }
      else setExtractMsg('PDF sans texte sélectionnable (scan/image ?).');
    } catch (e) {
      setExtractMsg(`Extraction impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExtracting(false);
    }
  };
  const folders = [...new Set(data.map((d) => d.dossier).filter(Boolean) as string[])].sort();

  const openNew = () => { setForm(empty()); setTagsText(''); setClientId(''); setClientFormationId(''); setExtractMsg(null); setOpen(true); };
  const openEdit = (d: Document) => { setForm(d); setTagsText((d.tags ?? []).join(', ')); setClientId(''); setClientFormationId(''); setExtractMsg(null); setOpen(true); };

  const save = async () => {
    setSaving(true);
    // Rattachement automatique au dossier client si un prospect est sélectionné.
    let dossier_id = form.dossier_id ?? null;
    let dossierLabel = form.dossier ?? '';
    if (!dossier_id && clientId) {
      const contact = contacts.data.find((c) => c.id === clientId);
      const formation = formations.data.find((f) => f.id === clientFormationId);
      const dossier = await ensureDossierClient({
        contactId: clientId, contactName: fullName(contact?.prenom, contact?.nom),
        formationId: clientFormationId || null, formationName: formation?.intitule ?? null,
        entrepriseId: contact?.entreprise_id ?? null, ownerId: session?.user.id ?? null,
      });
      if (dossier) { dossier_id = dossier.id; dossierLabel = dossier.intitule; }
    }
    const payload = {
      ...form,
      dossier_id,
      dossier: dossierLabel,
      version: Number(form.version ?? 1),
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      owner_id: form.owner_id ?? session?.user.id,
    };
    const { error } = form.id
      ? await supabase.from('documents').update(payload).eq('id', form.id)
      : await supabase.from('documents').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  // Nouvelle version : duplique le document en incrementant la version (4.5)
  const newVersion = async (d: Document) => {
    const { error } = await supabase.from('documents').insert({
      titre: d.titre, categorie: d.categorie, description: d.description,
      fichier_url: d.fichier_url, version: d.version + 1, statut: 'actif',
      parent_id: d.parent_id ?? d.id, tags: d.tags, owner_id: session?.user.id,
      dossier: d.dossier, dossier_id: d.dossier_id, chat_direction: d.chat_direction, chat_conseiller: d.chat_conseiller, contenu_texte: d.contenu_texte,
    });
    if (error) { alert(error.message); return; }
    refresh();
  };

  const remove = async (d: Document) => {
    if (!confirm(`Supprimer « ${d.titre} » ?`)) return;
    const { error } = await supabase.from('documents').delete().eq('id', d.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const filtered = data.filter((d) =>
    (!cat || d.categorie === cat) && (!fol || d.dossier === fol) &&
    `${d.titre} ${(d.tags ?? []).join(' ')}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Espace documentaire"
        subtitle="Procédures, modèles et documents Qualiopi versionnés (4.5)"
        actions={isManager
          ? <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouveau document</Button>
          : <Badge className="bg-surface-2 text-muted"><Lock className="mr-1 h-3 w-3" /> Lecture seule</Badge>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input className="input pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input max-w-[200px]" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input max-w-[200px]" value={fol} onChange={(e) => setFol(e.target.value)}>
          <option value="">Tous les dossiers</option>
          {folders.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun document" />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3">Document</th>
            <th className="px-4 py-3">Catégorie</th>
            <th className="px-4 py-3">Version</th>
            <th className="px-4 py-3">Mis à jour</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {filtered.map((d) => (
            <tr key={d.id} className="hover:bg-surface-2">
              <td className="px-4 py-3">
                <span className="flex items-center gap-2 font-medium text-fg"><FileText className="h-4 w-4 text-brand-500" />{d.titre}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  {/* Provenance du fichier : repérage direct des vrais liens externes. */}
                  {d.fichier_url && (isHebergeParApp(d.fichier_url)
                    ? <Badge tone="success"><HardDrive className="mr-1 h-3 w-3" />Hébergé</Badge>
                    : <Badge tone="warning"><Link2 className="mr-1 h-3 w-3" />Lien externe</Badge>)}
                  {d.dossier && <Badge tone="warning"><Folder className="mr-1 h-3 w-3" />{d.dossier}</Badge>}
                  {d.chat_direction && <Badge tone="info"><Bot className="mr-1 h-3 w-3" />Direction</Badge>}
                  {d.chat_conseiller && <Badge tone="brand"><Bot className="mr-1 h-3 w-3" />Conseiller</Badge>}
                  {(d.tags ?? []).map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}
                </span>
              </td>
              <td className="px-4 py-3"><Badge tone="brand">{d.categorie}</Badge></td>
              <td className="px-4 py-3 text-muted">v{d.version}</td>
              <td className="px-4 py-3 text-muted">{formatDate(d.updated_at)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {d.fichier_url && <FileLink bucket="documents" value={d.fichier_url} />}
                  {isManager && <>
                    <button onClick={() => newVersion(d)} title="Nouvelle version" className="rounded px-1.5 text-xs font-medium text-muted hover:text-brand-600">+v</button>
                    <button onClick={() => openEdit(d)} className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(d)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={form.id ? 'Modifier le document' : 'Nouveau document'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.titre}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Titre" required><input className="input" value={form.titre ?? ''} onChange={(e) => set('titre', e.target.value)} /></Field></div>
          <Field label="Catégorie"><select className="input" value={form.categorie} onChange={(e) => set('categorie', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></Field>
          <Field label="Version"><input className="input" type="number" value={form.version ?? 1} onChange={(e) => set('version', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Description"><textarea className="input" rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field></div>
          <div className="col-span-2">
            <Field label="Fichier" hint="Téléversez un fichier depuis votre ordinateur, ou référencez un lien externe">
              <div className="flex flex-wrap items-center gap-3">
                <FileUpload bucket="documents" onUploaded={onFileUploaded} />
                {form.fichier_url && <FileLink bucket="documents" value={form.fichier_url} onClear={() => set('fichier_url', '')} />}
                {extracting && <span className="inline-flex items-center gap-1 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Extraction du texte…</span>}
              </div>

              {/* Provenance explicite : un fichier téléversé est stocké sur l'espace
                  AIssociate, même si son adresse ressemble à un lien externe. */}
              {form.fichier_url && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  {isHebergeParApp(form.fichier_url) ? (
                    <>
                      <HardDrive className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="min-w-0 text-sm">
                        <span className="font-medium text-fg">Fichier hébergé sur l'espace AIssociate</span>
                        <span className="block truncate text-xs text-muted">{fileNameOf(form.fichier_url)}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="min-w-0 text-sm">
                        <span className="font-medium text-fg">Lien externe</span>
                        <span className="block truncate text-xs text-muted">{form.fichier_url}</span>
                      </span>
                    </>
                  )}
                </div>
              )}

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted hover:text-fg">Adresse du fichier (avancé)</summary>
                <input className="input mt-2" placeholder="https://…" value={form.fichier_url ?? ''} onChange={(e) => set('fichier_url', e.target.value)} />
                <p className="mt-1 text-xs text-muted">
                  Un fichier téléversé reçoit une adresse de la forme <code>{'{votre projet}'}.supabase.co/storage/…</code> :
                  c'est le stockage de l'application, pas un site tiers. Ne modifiez ce champ que pour référencer un document
                  réellement hébergé ailleurs.
                </p>
              </details>

              {isPdf(form.fichier_url) && (
                <p className="mt-1 text-xs text-muted">Le texte du PDF est extrait automatiquement à l'upload pour l'assistant IA.</p>
              )}
            </Field>
          </div>
          <Field label="Dossier" hint="Rangement de l'espace documentaire (existant ou nouveau)">
            <input className="input" list="doc-dossiers" value={form.dossier ?? ''} onChange={(e) => set('dossier', e.target.value)} placeholder="ex. Qualiopi, Modèles…" />
            <datalist id="doc-dossiers">{folders.map((f) => <option key={f} value={f} />)}</datalist>
          </Field>
          <div className="col-span-2 rounded-lg border border-line bg-surface-2 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg"><Folder className="h-4 w-4 text-brand-600" /> Rattacher à un dossier client</p>
            <p className="mb-2 text-xs text-muted">Sélectionnez un prospect : le document est centralisé dans son dossier (créé automatiquement à son nom si nécessaire). Ignoré si un dossier est déjà rattaché.</p>
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={!!form.dossier_id}>
                <option value="">— Prospect (aucun) —</option>
                {contacts.data.map((c) => <option key={c.id} value={c.id}>{fullName(c.prenom, c.nom)}</option>)}
              </select>
              <select className="input" value={clientFormationId} onChange={(e) => setClientFormationId(e.target.value)} disabled={!!form.dossier_id || !clientId}>
                <option value="">— Formation (aucune) —</option>
                {formations.data.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
              </select>
            </div>
          </div>
          <div className="col-span-2"><Field label="Tags (séparés par des virgules)"><input className="input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} /></Field></div>
          {isAdmin && (
            <div className="col-span-2 rounded-lg border border-line bg-surface-2 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg"><Bot className="h-4 w-4 text-brand-600" /> Activation pour l'assistant IA</p>
              <p className="mb-2 text-xs text-muted">Cochez les chats autorisés à utiliser ce document comme source. Décoché partout = utilisé par aucun chat.</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-fg">
                  <input type="checkbox" checked={!!form.chat_direction} onChange={(e) => set('chat_direction', e.target.checked)} /> Chat Direction
                </label>
                <label className="flex items-center gap-2 text-sm text-fg">
                  <input type="checkbox" checked={!!form.chat_conseiller} onChange={(e) => set('chat_conseiller', e.target.checked)} /> Chat Conseiller
                </label>
              </div>
              {(form.chat_direction || form.chat_conseiller) && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">Contenu texte (lu par l'assistant)</span>
                    {isPdf(form.fichier_url) && (
                      <button type="button" onClick={reextract} disabled={extracting}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50">
                        {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
                        {extracting ? 'Extraction…' : 'Extraire le texte du PDF'}
                      </button>
                    )}
                  </div>
                  <textarea
                    className="input text-xs"
                    rows={6}
                    placeholder="Texte extrait automatiquement des PDF, ou à coller manuellement (Word, scans…). C'est ce contenu que l'assistant cite en source."
                    value={form.contenu_texte ?? ''}
                    onChange={(e) => set('contenu_texte', e.target.value)}
                  />
                  {extractMsg && <p className="mt-1 text-xs text-muted">{extractMsg}</p>}
                  {!((form.contenu_texte ?? '').trim()) && !extractMsg && (
                    <p className="mt-1 text-xs text-amber-600">Sans contenu texte, l'assistant ne connaît que le titre, la description et les tags du document.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Lock, Search, Folder, Bot } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import { formatDate } from '@/lib/utils';
import type { Document } from '@/lib/database.types';

const CATEGORIES = ['general', 'procedure', 'qualiopi', 'modele', 'contractuel', 'reglementaire'];
const empty = (): Partial<Document> => ({
  titre: '', categorie: 'general', description: '', fichier_url: '', version: 1, statut: 'actif', tags: [],
  dossier: '', chat_direction: false, chat_conseiller: false,
});

export default function Documents() {
  const { isManager, isAdmin, session } = useAuth();
  const { data, loading, refresh } = useCollection<Document>('documents', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Document>>(empty());
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [cat, setCat] = useState('');
  const [fol, setFol] = useState('');
  const [q, setQ] = useState('');
  const set = (k: keyof Document, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const folders = [...new Set(data.map((d) => d.dossier).filter(Boolean) as string[])].sort();

  const openNew = () => { setForm(empty()); setTagsText(''); setOpen(true); };
  const openEdit = (d: Document) => { setForm(d); setTagsText((d.tags ?? []).join(', ')); setOpen(true); };

  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
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
      dossier: d.dossier, chat_direction: d.chat_direction, chat_conseiller: d.chat_conseiller, contenu_texte: d.contenu_texte,
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
            <Field label="Fichier" hint="Téléversez un fichier ou collez une URL externe">
              <div className="flex items-center gap-3">
                <FileUpload bucket="documents" onUploaded={(v) => set('fichier_url', v)} />
                {form.fichier_url && <FileLink bucket="documents" value={form.fichier_url} onClear={() => set('fichier_url', '')} />}
              </div>
              <input className="input mt-2" placeholder="https://…" value={form.fichier_url ?? ''} onChange={(e) => set('fichier_url', e.target.value)} />
            </Field>
          </div>
          <Field label="Dossier" hint="Rangement de l'espace documentaire (existant ou nouveau)">
            <input className="input" list="doc-dossiers" value={form.dossier ?? ''} onChange={(e) => set('dossier', e.target.value)} placeholder="ex. Qualiopi, Modèles…" />
            <datalist id="doc-dossiers">{folders.map((f) => <option key={f} value={f} />)}</datalist>
          </Field>
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
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

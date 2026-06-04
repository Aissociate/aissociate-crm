import { useState } from 'react';
import { Plus, Pencil, Trash2, Sparkles, Eye, EyeOff, ExternalLink, Loader as Loader2, Tag } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge } from '@/components/ui';
import { FileUpload } from '@/components/FileUpload';
import { formatDate } from '@/lib/utils';
import type { BlogArticle, BlogCategory } from '@/lib/database.types';

const slugify = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const empty = (): Partial<BlogArticle> => ({ title: '', slug: '', excerpt: '', content: '', category_id: null, image_url: '', published: false });

export default function BlogAdmin() {
  const { isManager } = useAuth();
  const { data, loading, refresh } = useCollection<BlogArticle>('blog_articles', { orderBy: { column: 'created_at', ascending: false } });
  const categories = useCollection<BlogCategory>('blog_categories', { orderBy: { column: 'name' } });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<BlogArticle>>(empty());
  const [saving, setSaving] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [publishGen, setPublishGen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [preview, setPreview] = useState(false);

  const set = (k: keyof BlogArticle, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const addCat = async () => {
    const name = newCat.trim();
    if (!name) return;
    const { error } = await supabase.from('blog_categories').insert({ name, slug: slugify(name) });
    if (error) { alert(error.message); return; }
    setNewCat('');
    categories.refresh();
  };
  const removeCat = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ? Les articles liés seront détachés.')) return;
    const { error } = await supabase.from('blog_categories').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    categories.refresh(); refresh();
  };
  const catName = (id: string | null) => categories.data.find((c) => c.id === id)?.name ?? '—';

  const openNew = () => { setForm(empty()); setPreview(false); setOpen(true); };
  const openEdit = (a: BlogArticle) => { setForm(a); setPreview(false); setOpen(true); };

  const save = async () => {
    if (!form.title?.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: (form.slug?.trim() || slugify(form.title)).trim(),
      excerpt: form.excerpt ?? '',
      content: form.content ?? '',
      category_id: form.category_id || null,
      image_url: form.image_url || null,
      published: !!form.published,
      published_at: form.published ? (form.published_at ?? new Date().toISOString()) : null,
    };
    const { error } = form.id
      ? await supabase.from('blog_articles').update(payload).eq('id', form.id)
      : await supabase.from('blog_articles').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  const togglePublish = async (a: BlogArticle) => {
    const next = !a.published;
    const { error } = await supabase.from('blog_articles').update({ published: next, published_at: next ? new Date().toISOString() : null }).eq('id', a.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const remove = async (a: BlogArticle) => {
    if (!confirm(`Supprimer l'article « ${a.title} » ?`)) return;
    const { error } = await supabase.from('blog_articles').delete().eq('id', a.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('generate-article', { body: { subject: subject || undefined, publish: publishGen } });
      if (error) throw new Error((error as { message?: string }).message ?? 'Erreur');
      if ((res as { error?: string })?.error) throw new Error((res as { error?: string }).error);
      setGenOpen(false); setSubject(''); setPublishGen(false);
      categories.refresh(); refresh();
      alert(`Article généré : ${(res as { article?: { title?: string } })?.article?.title ?? 'OK'}`);
    } catch (err) {
      alert(`Génération indisponible : déployez l'Edge Function « generate-article » et configurez la clé OpenRouter (Paramètres › IA). ${err instanceof Error ? err.message : ''}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Blog"
        subtitle="Articles du site vitrine — rédaction manuelle ou génération IA (veille)"
        actions={isManager && (
          <>
            <Button variant="secondary" onClick={() => setCatOpen(true)}><Tag className="h-4 w-4" /> Catégories</Button>
            <Button variant="secondary" onClick={() => setGenOpen(true)}><Sparkles className="h-4 w-4" /> Générer par IA</Button>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouvel article</Button>
          </>
        )}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="Aucun article" message="Créez un article ou lancez une génération IA." />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3">Titre</th><th className="px-4 py-3">Catégorie</th>
            <th className="px-4 py-3">Statut</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {data.map((a) => (
            <tr key={a.id} className="hover:bg-surface-2">
              <td className="px-4 py-3">
                <span className="font-medium text-fg">{a.title}</span>
                {a.ai_model_used && <Badge className="ml-2" tone="info">IA</Badge>}
              </td>
              <td className="px-4 py-3 text-muted">{catName(a.category_id)}</td>
              <td className="px-4 py-3">
                <Badge tone={a.published ? 'success' : 'neutral'}>{a.published ? 'Publié' : 'Brouillon'}</Badge>
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(a.published_at ?? a.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <a href={`/blog/${a.slug}`} target="_blank" rel="noreferrer" title="Voir sur le site" className="rounded p-1.5 text-muted hover:text-brand-600"><ExternalLink className="h-4 w-4" /></a>
                  <button onClick={() => togglePublish(a)} title={a.published ? 'Dépublier' : 'Publier'} className="rounded p-1.5 text-muted hover:text-brand-600">{a.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <button onClick={() => openEdit(a)} className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(a)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Édition / création */}
      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={form.id ? 'Modifier l\'article' : 'Nouvel article'}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={save} disabled={saving || !form.title}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Titre" required><input className="input" value={form.title ?? ''} onChange={(e) => { set('title', e.target.value); if (!form.id) set('slug', slugify(e.target.value)); }} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Slug (URL)"><input className="input" value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value)} /></Field>
            <Field label="Catégorie">
              <select className="input" value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}>
                <option value="">—</option>
                {categories.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Image de couverture" hint="URL, téléversement, ou générée par l'IA à la création">
            <div className="flex items-center gap-3">
              <input className="input" value={form.image_url ?? ''} onChange={(e) => set('image_url', e.target.value)} placeholder="https://…" />
              <FileUpload bucket="blog" label="Téléverser" onUploaded={(v) => set('image_url', v)} />
            </div>
            {form.image_url && <img src={form.image_url} alt="" className="mt-2 h-32 w-full rounded-lg object-cover" />}
          </Field>
          <Field label="Extrait"><textarea className="input" rows={2} value={form.excerpt ?? ''} onChange={(e) => set('excerpt', e.target.value)} /></Field>
          <Field label="Contenu (HTML)">
            <div className="mb-1 flex justify-end">
              <button type="button" onClick={() => setPreview((p) => !p)} className="text-xs font-medium text-brand-600 hover:text-brand-700">{preview ? 'Éditer le HTML' : 'Aperçu'}</button>
            </div>
            {preview
              ? <div className="prose max-w-none rounded-lg border border-line bg-surface p-4 text-sm" dangerouslySetInnerHTML={{ __html: form.content ?? '' }} />
              : <textarea className="input font-mono text-sm" rows={12} value={form.content ?? ''} onChange={(e) => set('content', e.target.value)} />}
          </Field>
          <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={!!form.published} onChange={(e) => set('published', e.target.checked)} /> Publié (visible sur le site)</label>
        </div>
      </Modal>

      {/* Génération IA */}
      <Modal
        open={genOpen} onClose={() => setGenOpen(false)}
        title="Générer un article par IA"
        footer={<><Button variant="secondary" onClick={() => setGenOpen(false)}>Annuler</Button><Button onClick={generate} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer</Button></>}
      >
        <div className="space-y-4">
          <Field label="Thème (optionnel)" hint="Vide = thème de veille choisi automatiquement">
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="ex. L'IA générative pour les PME" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={publishGen} onChange={(e) => setPublishGen(e.target.checked)} /> Publier directement (sinon brouillon)</label>
          <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">Le prompt maître, les thèmes, les flux RSS de veille et les mots-clés SEO se configurent dans <strong>Paramètres › Blog (IA)</strong>. Un cron hebdomadaire génère aussi un article automatiquement.</p>
        </div>
      </Modal>

      {/* Catégories */}
      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="Catégories du blog" footer={<Button variant="secondary" onClick={() => setCatOpen(false)}>Fermer</Button>}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nouvelle catégorie" onKeyDown={(e) => { if (e.key === 'Enter') addCat(); }} />
            <Button onClick={addCat} disabled={!newCat.trim()}><Plus className="h-4 w-4" /> Ajouter</Button>
          </div>
          {categories.data.length === 0 ? (
            <p className="text-sm text-muted">Aucune catégorie.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {categories.data.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-fg">{c.name} <span className="text-xs text-muted">· {c.slug}</span></span>
                  <button onClick={() => removeCat(c.id)} className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}

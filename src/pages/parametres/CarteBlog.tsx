import { useState } from 'react';
import { Save, Newspaper } from 'lucide-react';
import { Card, Button, Field } from '@/components/ui';
import { KIE_RATIOS, type Blog, type Sauvegarde } from './types';

/** Blog IA — génération automatique et veille. Montée une fois les réglages chargés. */
export function CarteBlog({
  blog, setBlog, persist, saving, savedMsg,
}: {
  blog: Blog;
  setBlog: (v: Blog) => void;
} & Sauvegarde) {
  // Listes saisies une valeur par ligne ; transformées en tableaux à l'enregistrement.
  const [blogThemes, setBlogThemes] = useState(() => (blog.themes ?? []).join('\n'));
  const [blogRss, setBlogRss] = useState(() => (blog.rss_feeds ?? []).join('\n'));
  const [blogSeo, setBlogSeo] = useState(() => (blog.seo_keywords ?? []).join('\n'));

  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-fg">Blog IA — génération & veille</h2>
      </div>
      <Field label="Prompt maître" hint="Doit demander une réponse JSON {title, excerpt, content (HTML), category, seo_keywords}">
        <textarea className="input" rows={5} value={blog.prompt ?? ''} onChange={(e) => setBlog({ ...blog, prompt: e.target.value })} />
      </Field>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Field label="Thèmes de veille (un par ligne)" hint="Utilisé si aucun flux RSS n'a fourni d'actualité">
          <textarea className="input" rows={6} value={blogThemes} onChange={(e) => setBlogThemes(e.target.value)} />
        </Field>
        <Field label="Flux RSS de veille IA (une URL par ligne)" hint="L'actualité récente sert de base aux articles">
          <textarea className="input font-mono text-xs" rows={6} value={blogRss} onChange={(e) => setBlogRss(e.target.value)} placeholder="https://news.google.com/rss/search?q=intelligence+artificielle&hl=fr" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Mots-clés SEO (un par ligne)" hint="Intégrés naturellement dans les articles générés">
          <textarea className="input" rows={3} value={blogSeo} onChange={(e) => setBlogSeo(e.target.value)} />
        </Field>
      </div>

      {/* Génération des illustrations d'articles */}
      <div className="mt-4 rounded-lg border border-line bg-surface-2 p-4">
        <p className="mb-3 text-sm font-medium text-fg">Génération des illustrations</p>
        <Field label="Générateur d'images">
          <select className="input max-w-xs" value={blog.image_provider ?? 'openrouter'} onChange={(e) => setBlog({ ...blog, image_provider: e.target.value as 'openrouter' | 'kie' })}>
            <option value="openrouter">OpenRouter (modèle image)</option>
            <option value="kie">Kie.ai — Seedream 5.0 Lite</option>
          </select>
        </Field>

        {(blog.image_provider ?? 'openrouter') === 'kie' ? (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field label="Clé API Kie.ai" hint="Lue côté serveur uniquement (jamais exposée au navigateur)">
              <input className="input" type="password" value={blog.kie_api_key ?? ''} onChange={(e) => setBlog({ ...blog, kie_api_key: e.target.value })} autoComplete="new-password" placeholder="Bearer token Kie.ai" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Qualité">
                <select className="input" value={blog.kie_quality ?? 'basic'} onChange={(e) => setBlog({ ...blog, kie_quality: e.target.value as 'basic' | 'high' })}>
                  <option value="basic">Basic (2K)</option>
                  <option value="high">High (4K)</option>
                </select>
              </Field>
              <Field label="Format">
                <select className="input" value={blog.kie_aspect_ratio ?? '16:9'} onChange={(e) => setBlog({ ...blog, kie_aspect_ratio: e.target.value })}>
                  {KIE_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <p className="text-xs text-muted lg:col-span-2">Modèle <code>seedream/5-lite-text-to-image</code>. Génération asynchrone : l'image est récupérée puis ré-hébergée dans le bucket du blog. Repli Unsplash si indisponible.</p>
          </div>
        ) : (
          <Field label="Modèle d'image (OpenRouter)" hint="Génération auto de l'illustration. Gratuit par défaut ; repli Unsplash si indisponible">
            <input className="input" value={blog.image_model ?? ''} onChange={(e) => setBlog({ ...blog, image_model: e.target.value })} placeholder="google/gemini-2.5-flash-image-preview:free" />
          </Field>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={!!blog.auto_publish} onChange={(e) => setBlog({ ...blog, auto_publish: e.target.checked })} /> Publier automatiquement (sinon brouillon)</label>
        <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={blog.use_web !== false} onChange={(e) => setBlog({ ...blog, use_web: e.target.checked })} /> Recherche web (veille temps réel via modèle « :online »)</label>
      </div>
      <p className="mt-3 rounded-lg bg-surface-2 p-3 text-xs text-muted">Un <strong>cron hebdomadaire</strong> appelle l'Edge Function <code>generate-article</code> (lundi 8h). Génération manuelle possible depuis <strong>Blog › Générer par IA</strong>. Clé IA dans la section ci-dessus.</p>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => persist('blog', { ...blog, themes: blogThemes.split('\n').map((t) => t.trim()).filter(Boolean), rss_feeds: blogRss.split('\n').map((t) => t.trim()).filter(Boolean), seo_keywords: blogSeo.split('\n').map((t) => t.trim()).filter(Boolean) })} disabled={saving === 'blog'}>
          <Save className="h-4 w-4" /> {saving === 'blog' ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {savedMsg === 'blog' && <span className="text-sm text-emerald-600">Enregistré ✓</span>}
      </div>
    </Card>
  );
}

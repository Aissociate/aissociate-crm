// @ts-nocheck
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Calendar, Clock, ArrowLeft, User, BookOpen, Loader as Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { BlogArticle as BlogArticleType } from '../types/blog';
import SEO, { SITE_URL, DEFAULT_OG_IMAGE } from '../components/SEO';

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<BlogArticleType | null>(null);
  const [related, setRelated] = useState<BlogArticleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (slug) loadArticle(slug);
  }, [slug]);

  async function loadArticle(articleSlug: string) {
    setLoading(true);
    setNotFound(false);

    const { data, error } = await supabase
      .from('blog_articles')
      .select('*, blog_categories(*)')
      .eq('slug', articleSlug)
      .eq('published', true)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setArticle(data);

    supabase
      .from('blog_articles')
      .update({ views_count: (data.views_count || 0) + 1 })
      .eq('id', data.id)
      .then();

    const { data: relatedData } = await supabase
      .from('blog_articles')
      .select('*, blog_categories(*)')
      .eq('published', true)
      .neq('id', data.id)
      .order('published_at', { ascending: false })
      .limit(2);

    if (relatedData) setRelated(relatedData);
    setLoading(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex justify-center items-center py-40">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="text-center py-40 max-w-lg mx-auto px-4">
          <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Article introuvable</h1>
          <p className="text-slate-500 mb-8">Cet article n'existe pas ou n'est plus disponible.</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:from-orange-600 hover:to-amber-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au blog
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={(article.seo_title || `${article.title} | Blog Aissociate`)}
        description={article.seo_description || article.excerpt || ''}
        keywords={article.seo_keywords || ''}
        image={article.image_url || DEFAULT_OG_IMAGE}
        imageAlt={article.title}
        url={`${SITE_URL}/blog/${article.slug}`}
        type="article"
        author={article.author}
        publishedTime={article.published_at}
        modifiedTime={article.updated_at || article.published_at}
        breadcrumbs={[
          { name: 'Blog', url: `${SITE_URL}/blog` },
          { name: article.title, url: `${SITE_URL}/blog/${article.slug}` },
        ]}
        articleData={{
          headline: article.title,
          description: article.seo_description || article.excerpt || '',
          image: article.image_url || DEFAULT_OG_IMAGE,
          author: article.author,
          datePublished: article.published_at,
          dateModified: article.updated_at || article.published_at,
          keywords: article.seo_keywords || '',
        }}
      />
      <Header />

      <div className="bg-slate-50 border-b border-slate-200 py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/blog"
            className="flex items-center gap-2 text-slate-600 hover:text-orange-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au blog
          </Link>
        </div>
      </div>

      <article className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            {article.blog_categories && (
              <span className="inline-block bg-gradient-to-r from-orange-500 to-amber-600 text-white px-4 py-1 rounded-full text-sm font-semibold mb-4">
                {article.blog_categories.name}
              </span>
            )}

            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              {article.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-slate-600">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5" />
                <span>{article.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{formatDate(article.published_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{article.read_time} min de lecture</span>
              </div>
            </div>
          </div>

          {article.image_url && (
            <div className="mb-12">
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-96 object-cover rounded-2xl shadow-lg"
              />
            </div>
          )}

          <div
            className="blog-content text-slate-800"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          <div className="mt-12 pt-8 border-t border-slate-200">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 border border-orange-200">
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Cet article vous a ete utile ?
              </h3>
              <p className="text-slate-700 mb-6">
                Decouvrez nos formations pour maitriser l'IA dans votre activite professionnelle
              </p>
              <Link
                to="/formations"
                className="inline-block bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
              >
                Voir nos formations
              </Link>
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="py-12 bg-slate-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Articles similaires</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {related.map((rel) => (
                <Link
                  key={rel.id}
                  to={`/blog/${rel.slug}`}
                  className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow group"
                >
                  <div className="relative h-48 overflow-hidden">
                    {rel.image_url ? (
                      <img
                        src={rel.image_url}
                        alt={rel.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                        <BookOpen className="w-10 h-10 text-white/60" />
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-orange-600 transition-colors">
                      {rel.title}
                    </h3>
                    <p className="text-sm text-slate-600">{rel.read_time} min de lecture</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

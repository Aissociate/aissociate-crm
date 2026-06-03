// @ts-nocheck
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { BookOpen, Calendar, Clock, ArrowRight, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { BlogArticle, BlogCategory } from '../types/blog';

export default function Blog() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [articlesRes, categoriesRes] = await Promise.all([
      supabase
        .from('blog_articles')
        .select('*, blog_categories(*)')
        .eq('published', true)
        .order('published_at', { ascending: false }),
      supabase
        .from('blog_categories')
        .select('*')
        .order('name'),
    ]);
    if (articlesRes.data) setArticles(articlesRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    setLoading(false);
  }

  const filtered = activeCategory
    ? articles.filter(a => a.category_id === activeCategory)
    : articles;

  function categoryCount(catId: string) {
    return articles.filter(a => a.category_id === catId).length;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const categoryColors: Record<string, string> = {
    'formation': 'from-orange-500 to-amber-600',
    'intelligence-artificielle': 'from-blue-500 to-cyan-600',
    'business': 'from-emerald-500 to-teal-600',
    'marketing': 'from-rose-500 to-pink-600',
    'technologie': 'from-slate-600 to-slate-800',
  };

  function getCategoryColor(cat: BlogCategory | null | undefined): string {
    if (!cat) return 'from-orange-500 to-amber-600';
    return categoryColors[cat.slug] || 'from-orange-500 to-amber-600';
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl mb-6">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">Notre blog</h1>
            <p className="text-xl text-slate-300">
              Conseils, actualites et retours d'experience sur l'IA, la formation professionnelle et la transformation digitale
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-white via-slate-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3 justify-center mb-12">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                !activeCategory
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg'
                  : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-orange-300 hover:shadow-md'
              }`}
            >
              Tous ({articles.length})
            </button>
            {categories.map((cat) => {
              const count = categoryCount(cat.id);
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-6 py-2 rounded-full font-semibold transition-all ${
                    activeCategory === cat.id
                      ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg'
                      : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-orange-300 hover:shadow-md'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-xl text-slate-500">Aucun article pour le moment</p>
              <p className="text-slate-400 mt-2">Revenez bientot pour decouvrir nos prochains articles</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {filtered.map((article) => (
                <article
                  key={article.id}
                  className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow group"
                >
                  <div className="relative h-48 overflow-hidden">
                    {article.image_url ? (
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${getCategoryColor(article.blog_categories)} flex items-center justify-center`}>
                        <BookOpen className="w-12 h-12 text-white/60" />
                      </div>
                    )}
                    {article.blog_categories && (
                      <div className={`absolute top-4 left-4 bg-gradient-to-r ${getCategoryColor(article.blog_categories)} text-white px-3 py-1 rounded-full text-sm font-semibold`}>
                        {article.blog_categories.name}
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(article.published_at)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {article.read_time} min
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-orange-600 transition-colors line-clamp-2">
                      {article.title}
                    </h3>

                    <p className="text-slate-600 mb-4 line-clamp-3">
                      {article.excerpt}
                    </p>

                    <Link
                      to={`/blog/${article.slug}`}
                      className="inline-flex items-center gap-2 text-orange-600 font-semibold hover:gap-3 transition-all"
                    >
                      Lire l'article
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 sm:p-10 border border-orange-200 text-center">
            <TrendingUp className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Ne manquez aucun article
            </h2>
            <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
              Abonnez-vous a notre newsletter pour recevoir nos derniers articles, conseils et actualites directement dans votre boite mail
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
              <input
                type="email"
                placeholder="Votre adresse email"
                className="flex-1 px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-orange-400 focus:outline-none"
              />
              <button className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-3 rounded-lg font-bold transition-all whitespace-nowrap">
                S'abonner
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

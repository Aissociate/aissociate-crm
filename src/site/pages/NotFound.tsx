// @ts-nocheck
import { Link } from 'react-router-dom';
import { Home, GraduationCap, BookOpen } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

/**
 * Page 404 réelle : évite le « soft 404 » (redirection silencieuse vers
 * l'accueil avec un statut 200) que Google pénalise. La page est en noindex.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Page introuvable (404) | Aissociate"
        description="La page demandée n'existe pas ou a été déplacée."
        noindex
      />
      <Header />
      <main id="contenu" className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-xl text-center">
          <p className="text-7xl font-bold text-orange-600 mb-4" aria-hidden="true">404</p>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Page introuvable</h1>
          <p className="text-slate-700 leading-relaxed mb-8">
            La page que vous cherchez n'existe pas ou a été déplacée. Vérifiez l'adresse,
            ou repartez d'une de ces pages :
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-700 hover:to-amber-800 text-white px-6 py-3 rounded-lg font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
            >
              <Home className="w-4 h-4" aria-hidden="true" /> Accueil
            </Link>
            <Link
              to="/formations"
              className="inline-flex items-center gap-2 border border-slate-300 text-slate-800 hover:bg-slate-50 px-6 py-3 rounded-lg font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
            >
              <GraduationCap className="w-4 h-4" aria-hidden="true" /> Nos formations
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 border border-slate-300 text-slate-800 hover:bg-slate-50 px-6 py-3 rounded-lg font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" /> Le blog
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

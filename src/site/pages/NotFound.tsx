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
          <p className="text-7xl font-semibold text-orange-600 mb-4" aria-hidden="true">404</p>
          <h1 className="tracking-tight text-3xl font-semibold text-neutral-950 mb-4">Page introuvable</h1>
          <p className="text-neutral-700 leading-relaxed mb-8">
            La page que vous cherchez n'existe pas ou a été déplacée. Vérifiez l'adresse,
            ou repartez d'une de ces pages :
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
            >
              <Home className="w-4 h-4" aria-hidden="true" /> Accueil
            </Link>
            <Link
              to="/formations"
              className="inline-flex items-center gap-2 border border-neutral-300 text-neutral-800 hover:bg-neutral-50 px-6 py-3 rounded-xl font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
            >
              <GraduationCap className="w-4 h-4" aria-hidden="true" /> Nos formations
            </Link>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 border border-neutral-300 text-neutral-800 hover:bg-neutral-50 px-6 py-3 rounded-xl font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
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

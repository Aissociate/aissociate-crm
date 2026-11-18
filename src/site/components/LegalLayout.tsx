// @ts-nocheck
import Header from './Header';
import Footer from './Footer';
import SEO, { SITE_URL } from './SEO';

// Layout commun des pages légales / informatives du site (Header + hero + contenu + Footer).
export default function LegalLayout({ title, description, path, updated, children }) {
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={`${title} | Aissociate`}
        description={description}
        url={`${SITE_URL}${path}`}
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }, { name: title, url: `${SITE_URL}${path}` }]}
      />
      <Header />
      <main id="contenu">

      <section className="bg-neutral-950 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="tracking-tight text-3xl sm:text-4xl font-semibold">{title}</h1>
          {updated && <p className="mt-2 text-neutral-300 text-sm">Dernière mise à jour : {updated}</p>}
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}

// Helpers de mise en forme (typographie cohérente sans plugin prose).
export function H2({ children }) {
  return <h2 className="tracking-tight text-2xl font-semibold text-neutral-950 mt-10 mb-3">{children}</h2>;
}
export function P({ children }) {
  return <p className="text-neutral-600 mb-4 leading-relaxed">{children}</p>;
}
export function UL({ children }) {
  return <ul className="list-disc pl-6 space-y-2 text-neutral-600 mb-4">{children}</ul>;
}

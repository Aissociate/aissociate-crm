// @ts-nocheck
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { Clock, Users, CircleCheck as CheckCircle, Target, BookOpen, ArrowLeft, Euro } from 'lucide-react';
import SEO, { SITE_URL } from '../../components/SEO';

// Détail d'une formation issue du back-office CRM (id non présent dans le
// dictionnaire OF). Rendu simple et sûr, design cohérent avec le site.
export default function CrmFormationDetail({ f }) {
  const objectives = f.objectifs ? String(f.objectifs).split('\n').map((s) => s.trim()).filter(Boolean) : [];
  const program = Array.isArray(f.programme) ? f.programme.filter(Boolean) : [];
  // Canonical par slug (jamais l'UUID) : une seule URL indexable par formation.
  const canonicalUrl = `${SITE_URL}/formations/${f.slug || f.id}`;
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={`${f.intitule} — Formation IA | Aissociate`}
        description={`${f.intitule}.${f.duree_heures ? ` ${f.duree_heures}h,` : ''} formation certifiée Qualiopi, finançable OPCO${f.certifiante ? ' et CPF' : ''}. Présentiel à La Réunion ou distanciel.`}
        url={canonicalUrl}
        type="course"
        breadcrumbs={[
          { name: 'Formations', url: `${SITE_URL}/formations` },
          { name: f.intitule, url: canonicalUrl },
        ]}
        courseData={{
          name: f.intitule,
          description: objectives[0] || f.intitule,
          provider: 'Aissociate',
          duration: f.duree_heures ? `PT${f.duree_heures}H` : 'PT7H',
          price: Number(f.prix) > 0 ? String(Number(f.prix)) : '0',
          priceCurrency: 'EUR',
          educationalLevel: 'Tous niveaux',
          courseMode: ['blended', 'onsite', 'online'],
        }}
      />
      <Header />
      <main id="contenu">
      <section className="bg-neutral-950 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/formations" className="inline-flex items-center gap-2 text-neutral-300 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Retour aux formations</Link>
          <h1 className="tracking-tight text-4xl font-semibold mb-4">{f.intitule}</h1>
          <div className="flex flex-wrap gap-4 text-neutral-300">
            {f.duree_heures ? <span className="inline-flex items-center gap-2"><Clock className="w-5 h-5" /> {f.duree_heures}h</span> : null}
            {f.modalite ? <span className="inline-flex items-center gap-2"><Users className="w-5 h-5" /> {f.modalite}</span> : null}
            {f.prix ? <span className="inline-flex items-center gap-2"><Euro className="w-5 h-5" /> {Number(f.prix).toLocaleString('fr-FR')} €</span> : null}
          </div>
        </div>
      </section>
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {f.public_vise ? (<div><h2 className="tracking-tight text-2xl font-semibold text-neutral-950 mb-2 flex items-center gap-2"><Target className="w-6 h-6 text-orange-600" /> Public visé</h2><p className="text-neutral-600">{f.public_vise}</p></div>) : null}
          {f.prerequis ? (<div><h2 className="tracking-tight text-2xl font-semibold text-neutral-950 mb-2">Prérequis</h2><p className="text-neutral-600">{f.prerequis}</p></div>) : null}
          {objectives.length > 0 && (
            <div>
              <h2 className="tracking-tight text-2xl font-semibold text-neutral-950 mb-4 flex items-center gap-2"><CheckCircle className="w-6 h-6 text-orange-600" /> Objectifs</h2>
              <ul className="space-y-3">{objectives.map((o, i) => (<li key={i} className="flex items-start gap-3"><CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /><span className="text-neutral-700">{o}</span></li>))}</ul>
            </div>
          )}
          {program.length > 0 && (
            <div>
              <h2 className="tracking-tight text-2xl font-semibold text-neutral-950 mb-4 flex items-center gap-2"><BookOpen className="w-6 h-6 text-orange-600" /> Programme</h2>
              <ul className="space-y-3">{program.map((p, i) => (<li key={i} className="flex items-start gap-3"><span className="font-semibold text-orange-600">{i + 1}.</span><span className="text-neutral-700">{p}</span></li>))}</ul>
            </div>
          )}
          <div className="bg-orange-50 rounded-2xl p-8 border border-orange-200 text-center">
            <h2 className="tracking-tight text-2xl font-semibold text-neutral-950 mb-3">Intéressé par cette formation ?</h2>
            <p className="text-neutral-600 mb-6">Demandez un devis personnalisé, finançable (CPF / OPCO / AGEFICE).</p>
            <Link to={`/formulaire?formation=${encodeURIComponent(f.intitule)}`} className="inline-block bg-orange-500 hover:bg-orange-400 text-neutral-950 px-8 py-3 rounded-xl font-semibold transition-all shadow-lg">Demander un devis</Link>
            <p className="text-sm text-neutral-500 mt-3">Réponse sous 24 h ouvrées</p>
          </div>
        </div>
      </section>
      </main>
      <Footer />
    </div>
  );
}

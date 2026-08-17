// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Header from '../components/Header';
import SEO, { SITE_URL } from '../components/SEO';
import Hero from '../components/Hero';
import Target from '../components/Target';
import Objectives from '../components/Objectives';
import Program from '../components/Program';
import Modalities from '../components/Modalities';
import Pricing from '../components/Pricing';
import Benefits from '../components/Benefits';
import Team from '../components/Team';
import FAQ from '../components/FAQ';
import FinalCTA from '../components/FinalCTA';
import Footer from '../components/Footer';

export default function FormationDetail() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Formation Closer IA éligible CPF — Certifiante Qualiopi | Aissociate"
        description="Devenez Closer augmenté par l'IA : formation certifiante éligible CPF, certifiée Qualiopi. Maîtrisez la vente et la prospection commerciale assistées par l'intelligence artificielle."
        keywords="formation closer IA, closer CPF, formation vente IA, prospection commerciale IA, formation commerciale IA, CPF, Qualiopi"
        url={`${SITE_URL}/formations/closer-ia-cpf`}
        type="course"
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }, { name: 'Formations', url: `${SITE_URL}/formations` }, { name: 'Closer IA CPF', url: `${SITE_URL}/formations/closer-ia-cpf` }]}
      />
      <Header />
      <main id="contenu">

      <div className="bg-slate-50 border-b border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate('/formations')}
            className="flex items-center gap-2 text-slate-600 hover:text-orange-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux formations
          </button>
        </div>
      </div>

      <Hero />
      <Target />
      <Objectives />
      <Program />
      <Modalities />
      <Pricing />
      <Benefits />
      <Team />
      <FAQ />
      <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

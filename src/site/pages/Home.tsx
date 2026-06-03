// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield } from 'lucide-react';
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
import SEO from '../components/SEO';

export default function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <SEO
        courseData={{
          name: 'Création de contenus rédactionnels et visuels par l\'intelligence artificielle générative',
          description: 'Formation professionnelle certifiée Qualiopi pour maîtriser les outils d\'IA générative comme ChatGPT, DALL-E, Midjourney et créer des contenus de qualité en 3 jours.',
          provider: 'Formation IA Générative',
          duration: 'P3D',
          price: '1600',
          priceCurrency: 'EUR',
          educationalLevel: 'Tous niveaux',
          courseMode: ['présentiel', 'distanciel', 'hybride'],
        }}
        organizationData={{
          name: 'Formation IA Générative',
          description: 'Organisme de formation certifié Qualiopi spécialisé dans l\'intelligence artificielle générative et la création de contenus par IA.',
          url: 'https://votre-domaine.fr',
          logo: 'https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg',
        }}
      />
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end gap-3">
          {profile?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
          )}
          <button
            onClick={() => navigate(profile ? '/dashboard' : '/login')}
            className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-all"
          >
            {profile ? 'Mon Espace' : 'Connexion / Inscription'}
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
      <Footer />
    </div>
  );
}

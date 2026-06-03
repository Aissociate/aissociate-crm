// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { Target, Users, TrendingUp, Shield, CheckCircle2, XCircle } from 'lucide-react';
import AdminLogo from '../AdminLogo';

export default function RecruitmentLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center mb-8">
          <AdminLogo
            src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
            alt="Aissociate Logo"
            className="h-20 w-auto object-contain"
          />
        </div>

        <div className="text-center max-w-4xl mx-auto text-white mb-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Rejoignez un système commercial
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 mt-2">
              structuré, éthique et performant
            </span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-200 mb-8 leading-relaxed">
            Chez Aissociate, vous ne vendez pas seul. Vous exécutez un système qui fonctionne déjà.
          </p>
          <button
            onClick={() => navigate('/onboarding/candidature')}
            className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-10 py-5 rounded-lg font-semibold text-xl transition-all transform hover:scale-105 shadow-2xl"
          >
            Candidater pour rejoindre l'équipe
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[
            { icon: Target, title: 'Système existant', desc: 'Process éprouvé et optimisé' },
            { icon: Users, title: 'Leads qualifiés', desc: 'Prospects préparés pour vous' },
            { icon: Shield, title: 'Cadre juridique', desc: 'CPF & Qualiopi sécurisés' },
            { icon: TrendingUp, title: 'Process éprouvé', desc: 'Performance mesurée' }
          ].map((item, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <item.icon className="w-10 h-10 text-orange-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-gray-300 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8 text-center">
            Les deux rôles, un système
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-8 border-2 border-blue-200">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg inline-block mb-4">
                <h3 className="text-2xl font-bold">FIXER</h3>
              </div>
              <p className="text-lg font-semibold text-slate-700 mb-4">Vous ouvrez la porte.</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                  <span className="text-slate-700">Prospection et qualification</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                  <span className="text-slate-700">Prise de rendez-vous qualifiés</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                  <span className="text-slate-700">Aucun closing, aucune pression</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-8 border-2 border-orange-200">
              <div className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-4 py-2 rounded-lg inline-block mb-4">
                <h3 className="text-2xl font-bold">CLOSER</h3>
              </div>
              <p className="text-lg font-semibold text-slate-700 mb-4">Vous aidez à décider.</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
                  <span className="text-slate-700">Analyse du besoin réel</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
                  <span className="text-slate-700">Présentation de l'offre adaptée</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
                  <span className="text-slate-700">Décision éclairée, jamais forcée</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-lg text-slate-700 font-semibold">
              Le rôle est clair. La performance suit.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-900 to-red-800 rounded-2xl shadow-2xl p-8 sm:p-12 mb-16 text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-8 text-center">
            Ce que ce n'est PAS
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
              <XCircle className="w-8 h-8 text-red-300 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-xl mb-2">Pas de démarchage CPF agressif</h3>
                <p className="text-red-100">Respect total du cadre légal et éthique</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <XCircle className="w-8 h-8 text-red-300 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-xl mb-2">Pas de freestyle commercial</h3>
                <p className="text-red-100">Vous suivez le système établi</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <XCircle className="w-8 h-8 text-red-300 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-xl mb-2">Pas de promesses financières</h3>
                <p className="text-red-100">Construction sur le long terme</p>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xl font-semibold">Ici, on construit du long terme.</p>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate('/onboarding/candidature')}
            className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-12 py-6 rounded-lg font-semibold text-2xl transition-all transform hover:scale-105 shadow-2xl"
          >
            Candidater maintenant
          </button>
        </div>
      </div>
    </div>
  );
}

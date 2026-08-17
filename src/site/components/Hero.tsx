// @ts-nocheck
import { Clock, Monitor, Brain, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(251,146,60,0.08),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(245,158,11,0.08),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDEzNGg3djJ2LTJoLTd6bS0xNCAwaDd2MmgtN3YtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="flex justify-center mb-10">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <img
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Formation IA Générative - Organisme de formation certifié Qualiopi spécialisé en intelligence artificielle"
              className="h-20 sm:h-24 w-auto object-contain"
              loading="eager"
            />
          </div>
        </div>

        <div className="text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-orange-300">Formation certifiée Qualiopi</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-tight">
            Création de contenus rédactionnels et visuels
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500 mt-3">
              par l'intelligence artificielle générative
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 mb-6 leading-relaxed font-light">
            Maîtriser l'IA en 3 jours
          </p>

          <p className="text-base sm:text-lg text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Développez des compétences concrètes en intelligence artificielle et gagnez en efficacité professionnelle en seulement 3 jours.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <Link
              to="/formulaire"
              className="group bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-700 hover:to-amber-800 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl w-full sm:w-auto flex items-center justify-center gap-2"
            >
              Découvrir la formation
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/formulaire"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all border border-white/20 hover:border-white/30 w-full sm:w-auto"
            >
              Télécharger le programme
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mb-1 uppercase tracking-wide">Durée</p>
              <p className="font-bold text-lg sm:text-xl text-white">3 jours</p>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mb-1 uppercase tracking-wide">Format</p>
              <p className="font-bold text-lg sm:text-xl text-white">3 modalités</p>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mb-1 uppercase tracking-wide">Compétences</p>
              <p className="font-bold text-lg sm:text-xl text-white">Applicables</p>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-white" />
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mb-1 uppercase tracking-wide">Accompagnement</p>
              <p className="font-bold text-lg sm:text-xl text-white">Humain</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

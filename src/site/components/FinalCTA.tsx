// @ts-nocheck
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function FinalCTA() {
  return (
    <section className="py-20 bg-gradient-to-br from-orange-600 via-amber-600 to-orange-700 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2Mmgydi0yem0tMiAyaC0ydjJoMnYtMnptMCAyaC0ydjJoMnYtMnptMiAwaDJ2MmgtMnYtMnptMC0yaDJ2MmgtMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold">Prochaine session bientôt disponible</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-bold mb-6 leading-tight">
          Prêt(e) à passer à l'IA ?
        </h2>

        <p className="text-xl sm:text-2xl text-orange-100 mb-10 leading-relaxed">
          Rejoignez la prochaine session et développez des compétences concrètes et utiles dès maintenant.
        </p>

        <Link
          to="/formulaire"
          className="bg-white text-orange-600 px-10 py-5 rounded-lg font-bold text-xl hover:bg-orange-50 transition-all transform hover:scale-105 shadow-2xl inline-flex items-center gap-3 group"
        >
          Je m'inscris à la formation
          <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </Link>

        <p className="text-orange-100 mt-6">
          Une question ? Contactez-nous pour échanger sur votre projet
        </p>
      </div>
    </section>
  );
}

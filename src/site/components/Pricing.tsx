// @ts-nocheck
import { Euro, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Pricing() {
  return (
    <section className="py-24 bg-gradient-to-b from-white via-slate-50/50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-600 to-amber-700 rounded-2xl mb-6">
            <Euro className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Tarif de la formation
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-orange-600 to-amber-700 mx-auto rounded-full"></div>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-orange-600 to-amber-700 rounded-3xl p-10 sm:p-12 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -ml-24 -mb-24"></div>

            <div className="relative">
              <div className="flex items-center justify-center mb-8">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <Euro className="w-10 h-10" />
                </div>
              </div>

              <div className="text-center mb-10">
                <div className="text-7xl font-bold mb-3">1 600 €</div>
                <p className="text-orange-100 text-xl">Formation complète de 3 jours</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-10">
                <ul className="space-y-4">
                  <li className="flex items-center gap-3 text-lg">
                    <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                    <span>3 jours de formation intensive</span>
                  </li>
                  <li className="flex items-center gap-3 text-lg">
                    <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                    <span>Accès aux outils d'IA pendant la formation</span>
                  </li>
                  <li className="flex items-center gap-3 text-lg">
                    <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                    <span>Accompagnement pédagogique personnalisé</span>
                  </li>
                  <li className="flex items-center gap-3 text-lg">
                    <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                    <span>Support et ressources pédagogiques</span>
                  </li>
                </ul>
              </div>

              <Link
                to="/formulaire"
                className="block w-full bg-white text-orange-600 py-5 rounded-xl font-bold text-xl hover:bg-orange-50 transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl text-center"
              >
                S'inscrire à la formation
              </Link>

              <p className="text-center text-base text-orange-100 mt-6">
                Paiement possible selon les modalités définies avec l'organisme
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

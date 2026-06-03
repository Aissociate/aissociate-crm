// @ts-nocheck
import { User, Users } from 'lucide-react';

export default function Team() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Équipe pédagogique
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-2xl p-8 shadow-lg border border-blue-100 hover:shadow-xl transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Shanti Meralli Ballou</h3>
                <p className="text-blue-600 font-semibold">Fondateur & Formateur</p>
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed mb-4">
              Fondateur de Aissociate – Formateur en intelligence artificielle
            </p>
            <p className="text-slate-600 leading-relaxed">
              Dirigeant d'entreprise, expert en stratégie, innovation et outils numériques, spécialisé dans l'accompagnement des professionnels à l'usage concret de l'IA.
            </p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-slate-50 rounded-2xl p-8 shadow-lg border border-emerald-100 hover:shadow-xl transition-all">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Intervenants partenaires</h3>
                <p className="text-emerald-600 font-semibold">Experts en pédagogie</p>
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed">
              Formateurs experts en pédagogie professionnelle et transformation digitale.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

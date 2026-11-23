// @ts-nocheck
import { Users, Briefcase, Building2, Lightbulb, TrendingUp, UserCheck, Target as TargetIcon } from 'lucide-react';

export default function Target() {
  const profiles = [
    { icon: Briefcase, label: 'Salariés' },
    { icon: UserCheck, label: 'Indépendants' },
    { icon: Building2, label: 'Entrepreneurs' },
    { icon: Lightbulb, label: 'Porteurs de projet' },
    { icon: TrendingUp, label: 'Personnes en reconversion' },
    { icon: Users, label: 'Curieux de l\'IA' },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl mb-6">
            <TargetIcon className="w-7 h-7 text-white" />
          </div>
          <h2 className="tracking-tight text-3xl sm:text-4xl lg:text-5xl font-semibold text-neutral-950 mb-6">
            Cette formation est faite pour vous
          </h2>
          <div className="w-20 h-1 bg-orange-500 mx-auto rounded-full"></div>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="relative bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-neutral-200 mb-16 overflow-hidden">

            <div className="relative z-10">
              <p className="text-lg sm:text-xl text-neutral-700 mb-6 leading-relaxed">
                Cette formation s'adresse à toute personne souhaitant intégrer l'intelligence artificielle générative dans sa pratique professionnelle, quel que soit son niveau de départ.
              </p>
              <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed">
                Elle est particulièrement adaptée aux professionnels du tertiaire et aux profils ayant besoin de produire des contenus, structurer leurs idées, optimiser leur temps de travail et améliorer leur productivité.
              </p>
            </div>
          </div>

          <div className="mt-16">
            <h3 className="text-2xl sm:text-3xl font-semibold text-neutral-950 text-center mb-12">
              Profils concernés
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              {profiles.map((profile, index) => {
                const Icon = profile.icon;
                return (
                  <div
                    key={index}
                    className="group flex flex-col items-center p-6 sm:p-8 bg-white rounded-2xl shadow-md hover:shadow-sm transition-all duration-300 hover:-translate-y-2 border border-neutral-200 hover:border-orange-200"
                  >
                    <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-center font-semibold text-neutral-950 text-sm sm:text-base">{profile.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

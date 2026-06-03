// @ts-nocheck
import { Target, Wrench, Briefcase, Heart, Shield } from 'lucide-react';

export default function Benefits() {
  const benefits = [
    {
      icon: Target,
      title: 'Formation orientée pratique et résultats',
      description: 'Approche concrète centrée sur vos besoins professionnels réels'
    },
    {
      icon: Wrench,
      title: 'Outils immédiatement utilisables',
      description: 'Maîtrisez les outils d\'IA dès la fin de la formation'
    },
    {
      icon: Briefcase,
      title: 'Cas concrets du monde professionnel',
      description: 'Exercices basés sur des situations réelles d\'entreprise'
    },
    {
      icon: Heart,
      title: 'Accompagnement personnalisé',
      description: 'Suivi individuel et réponses adaptées à vos questions'
    },
    {
      icon: Shield,
      title: 'Approche responsable et éthique',
      description: 'Utilisation de l\'IA dans le respect des règles et de l\'éthique'
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Pourquoi choisir cette formation ?
          </h2>
          <p className="text-xl text-gray-200">
            Une formation pensée pour votre réussite professionnelle
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                <p className="text-gray-200 leading-relaxed">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

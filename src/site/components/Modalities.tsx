// @ts-nocheck
import { Monitor, Clock, CheckSquare, ClipboardCheck, Accessibility, Calendar, TrendingUp } from 'lucide-react';

export default function Modalities() {
  const modalities = [
    {
      icon: Monitor,
      title: 'Format',
      items: [
        '100% Présentiel : formation sur site',
        '100% Distanciel : formation en ligne',
        'Hybride : combinaison des deux modalités',
        'Alternance de théorie, démonstrations et exercices pratiques'
      ],
      color: 'from-blue-500 to-blue-600'
    },
    {
      icon: Clock,
      title: 'Durée',
      items: ['3 jours'],
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      icon: CheckSquare,
      title: 'Prérequis',
      items: [
        'Aucun prérequis technique',
        'Motivation à apprendre et à pratiquer'
      ],
      color: 'from-orange-500 to-orange-600'
    },
    {
      icon: ClipboardCheck,
      title: 'Évaluation des acquis',
      items: [
        'Exercices pratiques tout au long de la formation',
        'Auto-évaluations',
        'Questionnaire de satisfaction en fin de formation'
      ],
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: Accessibility,
      title: 'Accessibilité',
      items: [
        'Cette formation est accessible aux personnes en situation de handicap.',
        'Pour toute question ou besoin d\'adaptation, contactez notre référent handicap à l\'adresse suivante : 36 chemin de l\'État Major, 97417 Saint-Denis.'
      ],
      color: 'from-pink-500 to-pink-600'
    },
    {
      icon: Calendar,
      title: 'Modalités d\'accès',
      items: [
        'Les délais d\'accès sont de 4 mois à 2 semaines avant le début de la formation, sous réserve de places disponibles.',
        'Lieu de formation communiqué dans la convocation'
      ],
      color: 'from-slate-500 to-slate-600'
    },
    {
      icon: TrendingUp,
      title: 'Indicateurs de résultats',
      items: [
        'Taux de réussite pédagogique de 100%'
      ],
      color: 'from-teal-500 to-teal-600'
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Modalités pratiques
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modalities.map((modality, index) => {
            const Icon = modality.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all border border-slate-100"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${modality.color} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{modality.title}</h3>
                <ul className="space-y-2">
                  {modality.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="text-slate-700 leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

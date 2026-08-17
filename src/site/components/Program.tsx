// @ts-nocheck
import { Calendar, CheckCircle2, Users, BookOpen, Target, Clock, GraduationCap, Mail } from 'lucide-react';

export default function Program() {
  const days = [
    {
      day: 'Jour 1',
      title: 'Fondamentaux et stratégie IA',
      color: 'from-orange-600 to-amber-700',
      topics: [
        'Introduction à l\'intelligence artificielle générative',
        'Comprendre les opportunités et limites de l\'IA',
        'Analyse des besoins professionnels',
        'Présentation des outils (ChatGPT, Mistral AI, Midjourney, Copilot…)',
        'Bonnes pratiques d\'utilisation',
        'Exercices pratiques et cas concrets'
      ]
    },
    {
      day: 'Jour 2',
      title: 'Création de contenus avec l\'IA',
      color: 'from-amber-500 to-orange-600',
      topics: [
        'Prompt engineering : méthodes et techniques',
        'Rédaction de contenus professionnels assistée par l\'IA',
        'Création de visuels avec l\'IA',
        'Protection des données et confidentialité',
        'Accessibilité et qualité des contenus',
        'Ateliers pratiques et mises en situation'
      ]
    },
    {
      day: 'Jour 3',
      title: 'Cadre éthique et usages responsables',
      color: 'from-orange-600 to-amber-700',
      topics: [
        'Enjeux éthiques de l\'intelligence artificielle',
        'Responsabilité professionnelle',
        'Réglementation et bonnes pratiques (RGPD, usages responsables)',
        'Mise en place d\'une veille et d\'un cadre d\'utilisation durable',
        'Synthèse et plan d\'actions personnalisé'
      ]
    }
  ];

  const infos = [
    {
      icon: Users,
      title: 'Public visé',
      content: 'Cette formation s\'adresse aux salariés, indépendants, dirigeants et demandeurs d\'emploi souhaitant développer des compétences opérationnelles dans l\'usage professionnel et responsable de l\'intelligence artificielle générative.'
    },
    {
      icon: BookOpen,
      title: 'Prérequis',
      content: 'Maîtrise de base de l\'outil informatique et navigation internet.'
    },
    {
      icon: Target,
      title: 'Objectifs pédagogiques',
      content: 'À l\'issue de la formation, le participant sera capable de :',
      list: [
        'Analyser ses besoins professionnels en matière d\'IA générative',
        'Utiliser des outils d\'IA générative pour créer des contenus rédactionnels et visuels',
        'Appliquer les principes de confidentialité et de protection des données',
        'Produire des contenus conformes aux exigences éthiques et réglementaires',
        'Intégrer l\'IA générative de manière responsable dans ses pratiques professionnelles'
      ]
    },
    {
      icon: Clock,
      title: 'Modalités et délais d\'accès',
      content: 'L\'inscription à la formation s\'effectue après validation du dossier administratif et, le cas échéant, du financement. Les délais d\'accès sont de 4 mois à 2 semaines avant le début de la formation.'
    },
    {
      icon: GraduationCap,
      title: 'Modalités pédagogiques',
      content: 'La formation est proposée selon 3 modalités au choix : 100% présentiel (sur site), 100% distanciel (en ligne), ou en mode hybride (combinaison des deux).'
    },
    {
      icon: Mail,
      title: 'Contact / Réclamation',
      content: 'Pour toute question, information complémentaire ou réclamation, vous pouvez contacter AIssociate à l\'adresse : contact@aissociate.re.'
    }
  ];

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-30"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-600 to-amber-700 rounded-2xl mb-6">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Programme de formation
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-orange-600 to-amber-700 mx-auto rounded-full mb-6"></div>
          <p className="text-xl text-slate-600">3 jours intensifs pour maîtriser l'IA</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {infos.map((info, index) => {
            const Icon = info.icon;
            return (
              <div
                key={index}
                className="group bg-white rounded-2xl border border-slate-200 p-7 hover:shadow-2xl hover:border-orange-200 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 bg-gradient-to-br from-orange-600 to-amber-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{info.title}</h3>
                </div>
                <p className="text-slate-700 text-sm sm:text-base leading-relaxed">{info.content}</p>
                {info.list && (
                  <ul className="mt-5 space-y-2.5">
                    {info.list.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mb-16">
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Déroulé de la formation
          </h3>
          <div className="w-16 h-1 bg-gradient-to-r from-orange-600 to-amber-700 mx-auto rounded-full mb-4"></div>
          <p className="text-lg text-slate-600">Programme détaillé sur 3 jours</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {days.map((day, index) => (
            <div
              key={index}
              className="group bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-3"
            >
              <div className={`relative bg-gradient-to-r ${day.color} p-8 text-white overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar className="w-7 h-7" />
                    <span className="text-lg font-bold">{day.day}</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold leading-tight">{day.title}</h3>
                </div>
              </div>
              <div className="p-8">
                <ul className="space-y-4">
                  {day.topics.map((topic, topicIndex) => (
                    <li key={topicIndex} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm sm:text-base leading-relaxed">{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

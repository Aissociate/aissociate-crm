// @ts-nocheck
import { Target, Zap, FileText, MessageSquare, Timer, Shield, CheckCircle2 } from 'lucide-react';

export default function Objectives() {
  const objectives = [
    {
      icon: Target,
      text: 'Comprendre le fonctionnement et les usages de l\'IA générative',
      color: 'from-orange-600 to-amber-700'
    },
    {
      icon: Zap,
      text: 'Utiliser efficacement des outils d\'IA (texte et image) dans un cadre professionnel',
      color: 'from-amber-500 to-orange-600'
    },
    {
      icon: FileText,
      text: 'Créer des contenus rédactionnels et visuels pertinents avec l\'IA',
      color: 'from-orange-500 to-orange-600'
    },
    {
      icon: MessageSquare,
      text: 'Structurer des prompts efficaces et adaptés à leurs besoins',
      color: 'from-amber-500 to-amber-600'
    },
    {
      icon: Timer,
      text: 'Gagner du temps et améliorer leur productivité',
      color: 'from-orange-600 to-amber-700'
    },
    {
      icon: Shield,
      text: 'Identifier les enjeux éthiques, réglementaires et de confidentialité liés à l\'IA',
      color: 'from-neutral-600 to-neutral-700'
    },
  ];

  return (
    <section className="py-24 bg-[#F2ECE4] relative overflow-hidden">

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl mb-6">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <h2 className="tracking-tight text-3xl sm:text-4xl lg:text-5xl font-semibold text-neutral-950 mb-6">
            Objectifs de la formation
          </h2>
          <div className="w-20 h-1 bg-orange-500 mx-auto rounded-full mb-6"></div>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
            À l'issue de la formation, les participants seront capables de :
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {objectives.map((objective, index) => {
            const Icon = objective.icon;
            return (
              <div
                key={index}
                className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-sm transition-all duration-300 hover:-translate-y-2 border border-neutral-200 hover:border-orange-200"
              >
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 bg-neutral-700 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-neutral-400 font-semibold text-sm">#{index + 1}</span>
                    </div>
                    <p className="text-neutral-700 leading-relaxed text-base sm:text-lg">{objective.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-block bg-white rounded-2xl px-8 py-6 shadow-sm border border-neutral-200">
            <p className="text-neutral-700 text-lg">
              <span className="font-semibold text-orange-600">Formation certifiée</span> et conforme aux standards Qualiopi
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

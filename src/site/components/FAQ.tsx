// @ts-nocheck
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'À qui s\'adresse la formation ?',
      answer: 'Cette formation s\'adresse à toute personne souhaitant intégrer l\'IA dans sa pratique professionnelle : salariés, indépendants, entrepreneurs, porteurs de projet, ou personnes en reconversion. Aucun prérequis technique n\'est nécessaire.'
    },
    {
      question: 'Faut-il être débutant ou avancé ?',
      answer: 'La formation est accessible quel que soit votre niveau. Elle est conçue pour les débutants mais apporte aussi de la valeur aux profils ayant déjà une première expérience avec l\'IA grâce aux cas pratiques avancés.'
    },
    {
      question: 'Quels outils vais-je utiliser ?',
      answer: 'Vous découvrirez et pratiquerez avec les principaux outils d\'IA générative : ChatGPT, Midjourney, Mistral AI, Copilot, et d\'autres outils pertinents selon vos besoins professionnels.'
    },
    {
      question: 'Comment se déroule la formation ?',
      answer: 'La formation se déroule 100% en présentiel dans nos locaux. Vous alternez entre apports théoriques, démonstrations en direct, et exercices pratiques. L\'accompagnement est assuré en temps réel par les formateurs.'
    },
    {
      question: 'Comment m\'inscrire ?',
      answer: 'Pour vous inscrire, cliquez sur le bouton "S\'inscrire à la formation" et remplissez le formulaire. Nous vous recontacterons pour finaliser votre inscription et vous communiquer les dates des prochaines sessions.'
    },
    {
      question: 'Y a-t-il un accompagnement après la formation ?',
      answer: 'Oui, vous bénéficiez d\'un accès aux ressources pédagogiques après la formation et pouvez contacter l\'équipe pour des questions complémentaires.'
    }
  ];

  useEffect(() => {
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    let script = document.querySelector('script[data-faq-schema]') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.setAttribute('data-faq-schema', 'true');
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(faqSchema);

    return () => {
      const existingScript = document.querySelector('script[data-faq-schema]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return (
    <section className="py-20 bg-white" itemScope itemType="https://schema.org/FAQPage">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Questions fréquentes
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl border border-blue-100 overflow-hidden hover:shadow-lg transition-all"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/50 transition-all"
                aria-expanded={openIndex === index}
                aria-controls={`faq-reponse-${index}`}
              >
                <span className="font-bold text-slate-900 text-lg pr-4" itemProp="name">{faq.question}</span>
                {openIndex === index ? (
                  <ChevronUp className="w-6 h-6 text-blue-600 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-6 h-6 text-blue-600 flex-shrink-0" aria-hidden="true" />
                )}
              </button>
              {openIndex === index && (
                <div id={`faq-reponse-${index}`} className="px-6 pb-5" itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                  <p className="text-slate-700 leading-relaxed" itemProp="text">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

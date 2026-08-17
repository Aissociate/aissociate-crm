// @ts-nocheck
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL } from '../components/SEO';

const FAQ_ASSISTANCE = [
  { question: "Qu'est-ce qu'un assistant IA (chatbot) pour entreprise ?", answer: "Un assistant IA est un agent conversationnel qui répond à vos clients, qualifie les demandes et automatise les tâches courantes 24h/24, en s'appuyant sur vos contenus et vos données." },
  { question: "L'IA peut-elle gérer mon support client 24/7 ?", answer: "Oui. Un chatbot IA traite les questions fréquentes en continu, transmet les cas complexes à vos équipes et améliore la satisfaction tout en réduisant la charge." },
  { question: "Faut-il des compétences techniques pour déployer un assistant IA ?", answer: "Non. Nous vous accompagnons de la définition du besoin au déploiement, et nous formons vos équipes à l'usage — aucune compétence technique préalable n'est requise." },
  { question: "Intervenez-vous à La Réunion et à distance ?", answer: "Oui, nous accompagnons les entreprises réunionnaises sur place comme à distance, avec un organisme de formation certifié Qualiopi." },
];
import { Phone, Calendar, CheckCircle, MessageSquare, Sparkles, Target, TrendingUp, Users, ArrowRight } from 'lucide-react';

export default function Assistance() {
  const services = [
    {
      title: 'Audit IA',
      description: 'Analyse complète de vos processus et identification des opportunités d\'automatisation par l\'IA',
      icon: Target,
      color: 'from-orange-600 to-amber-700'
    },
    {
      title: 'Stratégie digitale',
      description: 'Définition d\'une roadmap IA sur mesure adaptée à vos objectifs business',
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-600'
    },
    {
      title: 'Accompagnement',
      description: 'Suivi personnalisé dans la mise en place de vos solutions IA',
      icon: Users,
      color: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Formation équipes',
      description: 'Montée en compétences de vos collaborateurs sur les outils IA',
      icon: Sparkles,
      color: 'from-purple-500 to-pink-600'
    }
  ];

  const processSteps = [
    {
      number: '01',
      title: 'Premier contact',
      description: 'Échange téléphonique ou visio pour comprendre vos besoins et enjeux'
    },
    {
      number: '02',
      title: 'Audit gratuit',
      description: 'Analyse de vos processus actuels et identification des axes d\'amélioration'
    },
    {
      number: '03',
      title: 'Proposition',
      description: 'Présentation d\'une stratégie IA personnalisée avec plan d\'action détaillé'
    },
    {
      number: '04',
      title: 'Accompagnement',
      description: 'Mise en place et suivi de votre projet avec notre équipe d\'experts'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Assistance & chatbots IA pour entreprises | Aissociate"
        description="Déployez des assistants IA pour votre entreprise à La Réunion : support client 24/7, chatbots, qualification de leads, FAQ automatisée. Accompagnement par un organisme certifié Qualiopi."
        keywords="assistant IA entreprise, chatbot IA, support client IA, qualification de leads IA, automatisation relation client, IA La Réunion"
        url={`${SITE_URL}/assistance`}
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }, { name: 'Assistance', url: `${SITE_URL}/assistance` }]}
        faqData={FAQ_ASSISTANCE}
      />
      <Header />
      <main id="contenu">

      <section className="relative bg-gradient-to-br from-slate-900 to-slate-800 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/60"></div>
        <div className="absolute inset-0 opacity-20">
          <img
            src="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1920"
            alt="Consultation professionnelle"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 px-4 py-2 rounded-full font-semibold text-sm mb-6">
                <Sparkles className="w-4 h-4" />
                Consultation gratuite
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
                Assistance &amp; assistants IA pour votre entreprise à La Réunion
              </h1>

              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                Chatbots, support client 24/7, qualification de leads et automatisation : bénéficiez d'un accompagnement personnalisé pour définir et déployer votre stratégie d'intelligence artificielle, par un organisme certifié Qualiopi.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  to="/formulaire"
                  className="bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-700 hover:to-amber-800 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
                >
                  <Calendar className="w-5 h-5" />
                  Prendre rendez-vous
                </Link>

                <a
                  href="tel:+262692246860"
                  className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all border-2 border-white/30 hover:border-white/50 flex items-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  Nous appeler
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                <h3 className="text-2xl font-bold mb-6">Premier rendez-vous offert</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Audit gratuit de vos processus</div>
                      <div className="text-sm text-slate-300">Analyse de vos besoins et opportunités</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Recommandations personnalisées</div>
                      <div className="text-sm text-slate-300">Solutions adaptées à votre contexte</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Estimation de ROI</div>
                      <div className="text-sm text-slate-300">Gains de temps et de productivité chiffrés</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Sans engagement</div>
                      <div className="text-sm text-slate-300">Aucune obligation d'achat ou de suivi</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Nos services d'assistance IA
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Un accompagnement complet pour réussir votre transformation digitale
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <div key={index} className="bg-white border-2 border-slate-200 hover:border-orange-300 rounded-2xl p-8 transition-all hover:shadow-xl group">
                  <div className={`w-16 h-16 bg-gradient-to-br ${service.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">{service.title}</h3>
                  <p className="text-slate-600">{service.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-slate-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Notre processus d'accompagnement
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Une méthodologie éprouvée pour garantir votre succès
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {processSteps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-2xl p-6 shadow-lg h-full">
                  <div className="text-5xl font-bold text-orange-200 mb-4">{step.number}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600">{step.description}</p>
                </div>
                {index < processSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-orange-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
                Pourquoi faire appel à notre assistance ?
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">Expertise reconnue</div>
                    <div className="text-slate-600">Plus de 3 ans d'expérience dans l'implémentation de solutions IA</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">Approche pragmatique</div>
                    <div className="text-slate-600">Solutions concrètes et applicables immédiatement dans votre contexte</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">ROI mesurable</div>
                    <div className="text-slate-600">Gains de productivité moyens de 40% sur les processus automatisés</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 mb-1">Support continu</div>
                    <div className="text-slate-600">Accompagnement avant, pendant et après la mise en place</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-600 to-amber-700 rounded-2xl p-8 sm:p-10 text-white">
              <div className="text-center mb-8">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-80" />
                <h3 className="text-2xl font-bold mb-2">Parlons de votre projet</h3>
                <p className="text-orange-100">Contactez-nous pour un premier échange gratuit et sans engagement</p>
              </div>

              <div className="space-y-4">
                <Link
                  to="/formulaire"
                  className="block w-full text-center bg-white text-orange-600 py-4 rounded-xl font-bold text-lg hover:bg-orange-50 transition-all"
                >
                  Prendre rendez-vous
                </Link>

                <a
                  href="tel:+262692246860"
                  className="block w-full text-center bg-white/20 backdrop-blur-sm text-white py-4 rounded-xl font-bold text-lg hover:bg-white/30 transition-all border-2 border-white/30"
                >
                  Appeler maintenant
                </a>

                <a
                  href="mailto:contact@aissociate.re"
                  className="block w-full text-center bg-white/20 backdrop-blur-sm text-white py-4 rounded-xl font-bold text-lg hover:bg-white/30 transition-all border-2 border-white/30"
                >
                  Envoyer un email
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8 text-center">Questions fréquentes</h2>
          <div className="space-y-4">
            {FAQ_ASSISTANCE.map((item, i) => (
              <details key={i} className="group bg-white border border-slate-200 rounded-xl p-6">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-slate-900 list-none">
                  {item.question}
                  <span className="shrink-0 text-2xl leading-none text-orange-500 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-slate-600 leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  );
}

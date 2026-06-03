// @ts-nocheck
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Code, Bot, Zap, Database, MessageSquare, FileText, BarChart, Workflow, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

export default function Development() {
  const solutions = [
    {
      title: 'Chatbots intelligents',
      description: 'Assistants conversationnels personnalisés pour automatiser votre support client et vos processus',
      icon: MessageSquare,
      features: ['Support client 24/7', 'Qualification de leads', 'Prise de rendez-vous', 'FAQ automatisée'],
      color: 'from-orange-500 to-amber-600'
    },
    {
      title: 'Automatisation documentaire',
      description: 'Extraction, analyse et traitement automatique de documents avec l\'IA',
      icon: FileText,
      features: ['OCR intelligent', 'Classification auto', 'Extraction de données', 'Génération de rapports'],
      color: 'from-emerald-500 to-teal-600'
    },
    {
      title: 'Analytics & BI IA',
      description: 'Tableaux de bord intelligents et analyses prédictives pour vos données',
      icon: BarChart,
      features: ['Prévisions automatiques', 'Détection d\'anomalies', 'Rapports personnalisés', 'KPIs en temps réel'],
      color: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Workflows intelligents',
      description: 'Automatisation complète de vos processus métier avec l\'Intelligence Artificielle',
      icon: Workflow,
      features: ['Routage intelligent', 'Décisions automatisées', 'Intégrations multiples', 'Orchestration IA'],
      color: 'from-purple-500 to-pink-600'
    }
  ];

  const technologies = [
    { name: 'OpenAI GPT', category: 'IA générative' },
    { name: 'Claude AI', category: 'IA conversationnelle' },
    { name: 'Python', category: 'Backend' },
    { name: 'React / Next.js', category: 'Frontend' },
    { name: 'Node.js', category: 'Backend' },
    { name: 'PostgreSQL', category: 'Base de données' },
    { name: 'AWS / Azure', category: 'Cloud' },
    { name: 'Supabase', category: 'Backend as a Service' }
  ];

  const processSteps = [
    {
      step: '1',
      title: 'Analyse des besoins',
      description: 'Compréhension approfondie de vos processus et objectifs'
    },
    {
      step: '2',
      title: 'Conception',
      description: 'Architecture technique et maquettes de la solution'
    },
    {
      step: '3',
      title: 'Développement',
      description: 'Création de votre application avec méthodologie agile'
    },
    {
      step: '4',
      title: 'Déploiement',
      description: 'Mise en production et formation de vos équipes'
    },
    {
      step: '5',
      title: 'Support',
      description: 'Maintenance et évolutions de votre solution'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-slate-900/70"></div>
        <div className="absolute inset-0 opacity-15">
          <img
            src="https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=1920"
            alt="Développement logiciel"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 px-4 py-2 rounded-full font-semibold text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              Solutions sur mesure
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Développement d'applications <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">intelligentes</span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Créez des applications sur mesure intégrant l'Intelligence Artificielle pour automatiser vos processus métier et gagner en productivité.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                to="/formulaire"
                className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
              >
                Discuter de votre projet
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            <div className="flex flex-wrap gap-8 justify-center mt-12 pt-8 border-t border-slate-700">
              <div>
                <div className="text-3xl font-bold">50+</div>
                <div className="text-sm text-slate-400">Projets réalisés</div>
              </div>
              <div>
                <div className="text-3xl font-bold">100%</div>
                <div className="text-sm text-slate-400">Satisfaction client</div>
              </div>
              <div>
                <div className="text-3xl font-bold">3 ans</div>
                <div className="text-sm text-slate-400">D'expertise IA</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Nos solutions IA sur mesure
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Des applications intelligentes adaptées à vos besoins spécifiques
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {solutions.map((solution, index) => {
              const Icon = solution.icon;
              return (
                <div key={index} className="bg-white border-2 border-slate-200 hover:border-orange-300 rounded-2xl p-8 transition-all hover:shadow-xl group">
                  <div className={`w-16 h-16 bg-gradient-to-br ${solution.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">{solution.title}</h3>
                  <p className="text-slate-600 mb-6">{solution.description}</p>

                  <div className="space-y-2">
                    {solution.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
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
              Notre processus de développement
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Une méthodologie agile pour garantir la qualité et la réussite de votre projet
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {processSteps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-xl p-6 text-center shadow-lg h-full">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
                    {step.step}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Technologies que nous utilisons
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Les meilleurs outils et frameworks pour créer des applications performantes
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {technologies.map((tech, index) => (
              <div key={index} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center hover:border-orange-300 hover:shadow-md transition-all">
                <div className="font-semibold text-slate-900 mb-1">{tech.name}</div>
                <div className="text-sm text-slate-600">{tech.category}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-400/30 text-orange-300 px-4 py-2 rounded-full font-semibold text-sm mb-6">
                <Zap className="w-4 h-4" />
                Pourquoi nous ?
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Votre partenaire technique de confiance
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Expertise IA avancée</div>
                    <div className="text-slate-300">Maîtrise des dernières technologies d'Intelligence Artificielle</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Développement rapide</div>
                    <div className="text-slate-300">Livrables en 4 à 8 semaines selon la complexité</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Code className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Code de qualité</div>
                    <div className="text-slate-300">Standards professionnels, tests et documentation complète</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Database className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-semibold mb-1">Infrastructure solide</div>
                    <div className="text-slate-300">Solutions scalables et sécurisées hébergées sur le cloud</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
              <h3 className="text-2xl font-bold mb-6 text-center">Démarrons votre projet</h3>

              <div className="space-y-4">
                <Link
                  to="/formulaire"
                  className="block w-full text-center bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white py-4 rounded-xl font-bold text-lg transition-all"
                >
                  Demander un devis
                </Link>

                <p className="text-center text-sm text-slate-300">
                  Réponse sous 24h • Devis gratuit • Sans engagement
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-white/20">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-orange-400 mb-1">4-8</div>
                    <div className="text-xs text-slate-300">Semaines</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400 mb-1">100%</div>
                    <div className="text-xs text-slate-300">Sur mesure</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-400 mb-1">24/7</div>
                    <div className="text-xs text-slate-300">Support</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

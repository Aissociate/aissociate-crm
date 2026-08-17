// @ts-nocheck
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO, { SITE_URL, DEFAULT_OG_IMAGE } from '../components/SEO';
import { GraduationCap, TrendingUp, Users, ArrowRight, Phone, Sparkles, Target, Clock, CheckCircle, FileText, Mail, Truck, Building2 } from 'lucide-react';

// FAQ : sert à la fois au rendu visible et au JSON-LD FAQPage (rich snippet SEO).
const FAQ = [
  {
    question: "Vos formations en intelligence artificielle sont-elles éligibles au CPF ?",
    answer: "Oui. Plusieurs de nos formations IA sont certifiantes et éligibles au CPF (Compte Personnel de Formation). Les autres sont finançables via votre OPCO, France Travail ou le plan de développement des compétences de votre entreprise.",
  },
  {
    question: "AIssociate est-il un organisme de formation certifié Qualiopi ?",
    answer: "Oui, AIssociate est un organisme de formation certifié Qualiopi — un gage de qualité reconnu par l'État et la condition d'accès aux financements (CPF, OPCO, France Travail).",
  },
  {
    question: "Proposez-vous des formations IA à La Réunion et à distance ?",
    answer: "Oui. Nos formations en intelligence artificielle se déroulent à La Réunion en présentiel, ou en classe virtuelle à distance, selon votre organisation.",
  },
  {
    question: "Faut-il des prérequis techniques pour se former à l'IA ?",
    answer: "Non. Nos formations s'adressent aux dirigeants, équipes et PME sans compétence technique : la maîtrise des outils informatiques de base suffit pour débuter avec l'IA générative.",
  },
  {
    question: "Combien de temps dure une formation en intelligence artificielle ?",
    answer: "De 7 h (1 jour) pour les formations d'initiation à 21 h (3 jours) pour les parcours certifiants. Le format s'adapte à vos objectifs et à votre disponibilité.",
  },
  {
    question: "Quels outils d'IA apprend-on (ChatGPT, prompt engineering…) ?",
    answer: "Vous apprenez à utiliser les principaux outils d'IA générative (ChatGPT, génération d'images, assistants) et le prompt engineering, à travers des cas pratiques directement applicables à votre métier.",
  },
];

export default function OrganismHome() {
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title="Formation IA à La Réunion — Qualiopi, CPF & OPCO | Aissociate"
        description="Organisme de formation certifié Qualiopi à La Réunion. Formez vos équipes à l'IA générative : ChatGPT, prompt engineering, automatisation des process. Finançable CPF, OPCO, France Travail — présentiel ou distanciel."
        keywords="formation IA La Réunion, formation intelligence artificielle Réunion, formation IA 974, formation IA Qualiopi, formation IA CPF, OPCO intelligence artificielle, ChatGPT entreprise, IA générative PME, automatisation IA, prompt engineering"
        url={SITE_URL}
        breadcrumbs={[{ name: 'Accueil', url: SITE_URL }]}
        organizationData={{
          name: 'Aissociate',
          description: "Organisme de formation certifié Qualiopi spécialisé en intelligence artificielle générative à La Réunion. Formations finançables CPF, OPCO et France Travail.",
          url: SITE_URL,
          logo: DEFAULT_OG_IMAGE,
          email: 'contact@aissociate.re',
          telephone: '+262692246860',
          address: {
            streetAddress: "36 chemin de l'État Major",
            addressLocality: 'Saint-Denis',
            postalCode: '97417',
            addressCountry: 'RE',
          },
        }}
        faqData={FAQ}
      />
      <Header />

      <main id="contenu">
      <section className="relative bg-gradient-to-br from-slate-50 via-white to-orange-50 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-semibold text-sm mb-6">
                <Sparkles className="w-4 h-4" />
                Organisme de formation certifié Qualiopi
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                Formation en <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-700">intelligence artificielle</span> à La Réunion
              </h1>

              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Organisme de formation certifié Qualiopi, AIssociate forme dirigeants, équipes et PME réunionnaises à l'IA générative
                (ChatGPT, prompt engineering, automatisation des process). Des formations finançables <strong>CPF, OPCO et France Travail</strong>,
                en présentiel à La Réunion ou à distance.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  to="/formations"
                  className="bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-700 hover:to-amber-800 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
                >
                  Découvrir nos formations
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <Link
                  to="/formulaire"
                  className="bg-white hover:bg-slate-50 text-slate-900 px-8 py-4 rounded-xl font-bold text-lg transition-all border-2 border-slate-200 hover:border-orange-300 flex items-center gap-2"
                >
                  Nous contacter
                  <Phone className="w-5 h-5" />
                </Link>
              </div>

              <div className="flex flex-wrap gap-8 mt-12 pt-8 border-t border-slate-200">
                <div>
                  <div className="text-3xl font-bold text-slate-900">8+</div>
                  <div className="text-sm text-slate-600">Formations spécialisées</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">100%</div>
                  <div className="text-sm text-slate-600">Pratique & Opérationnel</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-slate-900">Certifié</div>
                  <div className="text-sm text-slate-600">Qualiopi & Éligible CPF</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                <img
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop&q=80"
                  alt="Formation professionnelle en Intelligence Artificielle"
                  className="w-full h-96 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-transparent"></div>

              <div className="relative bg-white rounded-t-2xl -mt-8 p-8 border border-slate-200">
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-amber-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Formations certifiées</div>
                      <div className="text-sm text-slate-600">Éligibles CPF et financement</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Approche pratique</div>
                      <div className="text-sm text-slate-600">Cas réels et mise en situation</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Accompagnement personnalisé</div>
                      <div className="text-sm text-slate-600">Suivi individuel par nos experts</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Format flexible</div>
                      <div className="text-sm text-slate-600">Présentiel, distanciel ou mixte</div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Exemples concrets pour libérer du temps et gagner en compétitivité
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              L'IA s'adapte à tous les secteurs d'activité
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Gestion administrative</h3>
              <p className="text-slate-700 text-sm">
                Automatisation des rapports, factures et paiements. Réduction des délais et amélioration de la fiabilité.
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Commerce & vente</h3>
              <p className="text-slate-700 text-sm">
                Analyse des tendances, optimisation des stocks et prévisions de vente pour réduire les coûts.
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Relation client</h3>
              <p className="text-slate-700 text-sm">
                Chatbots 24/7, analyse des interactions et personnalisation des offres pour améliorer la satisfaction.
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Marketing</h3>
              <p className="text-slate-700 text-sm">
                Automatisation des emails et posts, ajustement du contenu selon les cibles et optimisation des budgets.
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center mb-4">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Transport & logistique</h3>
              <p className="text-slate-700 text-sm">
                Planification des itinéraires optimisés et maintenance prédictive pour limiter les pannes.
              </p>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-6">
              <div className="w-12 h-12 bg-teal-500 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Collectivités locales</h3>
              <p className="text-slate-700 text-sm">
                Automatisation des marchés publics, détection de fraudes et priorisation des interventions citoyennes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-slate-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Nos domaines d'expertise
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Des formations adaptées à vos besoins et aux exigences du marché
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Link
              to="/formations"
              className="group bg-white border-2 border-slate-200 hover:border-orange-300 rounded-2xl overflow-hidden transition-all hover:shadow-xl"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop&q=80"
                  alt="Formations débutantes en IA"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-amber-700 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform -mt-16 relative">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Formations débutantes</h3>
              <p className="text-slate-600 mb-4">
                Découvrez l'IA générative et créez vos premiers contenus professionnels conformes au RGPD.
              </p>
              <ul className="text-sm text-slate-600 space-y-1 mb-4">
                <li>• Génération de contenus rédactionnels</li>
                <li>• Création d'images et visuels</li>
                <li>• Usage responsable et éthique</li>
              </ul>
              <div className="flex items-center gap-2 text-orange-600 font-semibold group-hover:gap-3 transition-all">
                Découvrir
                <ArrowRight className="w-4 h-4" />
              </div>
              </div>
            </Link>

            <Link
              to="/formations"
              className="group bg-white border-2 border-slate-200 hover:border-emerald-300 rounded-2xl overflow-hidden transition-all hover:shadow-xl"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop&q=80"
                  alt="Formations intermédiaires en automatisation IA"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform -mt-16 relative">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Formations intermédiaires</h3>
              <p className="text-slate-600 mb-4">
                Intégrez l'IA dans votre workflow, automatisez vos process et créez des agents IA spécialisés pour votre PME.
              </p>
              <ul className="text-sm text-slate-600 space-y-1 mb-4">
                <li>• Automatisation des tâches répétitives</li>
                <li>• Création d'agents IA métiers</li>
              </ul>
              <div className="flex items-center gap-2 text-emerald-600 font-semibold group-hover:gap-3 transition-all">
                Découvrir
                <ArrowRight className="w-4 h-4" />
              </div>
              </div>
            </Link>

            <Link
              to="/formations"
              className="group bg-white border-2 border-slate-200 hover:border-blue-300 rounded-2xl overflow-hidden transition-all hover:shadow-xl"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&h=400&fit=crop&q=80"
                  alt="Formations métiers avancées en IA"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform -mt-16 relative">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Formations métiers avancées</h3>
              <p className="text-slate-600 mb-4">
                Optimisez vos fonctions métiers : RH, marketing, commerce, relation client avec l'IA.
              </p>
              <ul className="text-sm text-slate-600 space-y-1 mb-4">
                <li>• Recrutement intelligent et gestion RH</li>
                <li>• Marketing et communication augmentés</li>
                <li>• Prospection commerciale optimisée</li>
              </ul>
              <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
                Nos formations
                <ArrowRight className="w-4 h-4" />
              </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-slate-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Les bénéfices concrets de nos formations IA
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Des résultats mesurables pour votre entreprise
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Gagner du temps</h3>
              <p className="text-slate-600">
                L'IA devient un assistant opérationnel : moins de tâches chronophages, plus de temps pour la stratégie
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Améliorer la performance</h3>
              <p className="text-slate-600">
                Chaque métier identifie et active des cas d'usage IA directement applicables
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Meilleures décisions</h3>
              <p className="text-slate-600">
                L'IA renforce votre capacité décisionnelle avec une exploitation intelligente de l'information
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Adoption maîtrisée</h3>
              <p className="text-slate-600">
                Méthode, feuille de route et règles claires pour structurer l'usage de l'IA
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
            Prêt à démarrer votre formation ?
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Contactez-nous dès aujourd'hui pour échanger sur vos besoins et trouver la formation adaptée
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/formations"
              className="bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-700 hover:to-amber-800 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
            >
              Voir nos formations
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/formulaire"
              className="bg-white hover:bg-slate-50 text-slate-900 px-8 py-4 rounded-xl font-bold text-lg transition-all border-2 border-slate-200 hover:border-orange-300 flex items-center gap-2"
            >
              Prendre rendez-vous
              <Phone className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ — données structurées FAQPage (rich snippet) */}
      <section id="faq" className="py-20 bg-gradient-to-b from-white to-slate-50 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Questions fréquentes sur nos formations IA
            </h2>
            <p className="text-lg text-slate-600">
              CPF, OPCO, Qualiopi, formats à La Réunion ou à distance… tout ce qu'il faut savoir.
            </p>
          </div>
          <div className="space-y-4">
            {FAQ.map((item, i) => (
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

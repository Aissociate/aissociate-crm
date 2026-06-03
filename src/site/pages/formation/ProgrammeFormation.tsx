// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Clock, GraduationCap, Target, Award, Users, Zap, Star, MapPin, Euro, Mail, CheckCircle } from 'lucide-react';
import AdminLogo from '../../components/AdminLogo';

export default function ProgrammeFormation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/formation')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <AdminLogo />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Le Programme de Formation</h1>
            <p className="text-sm text-slate-600">Module commun obligatoire</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Intelligence Artificielle : Maîtrisez l'Avenir avec AIssociate</h2>
              <p className="text-slate-600 mt-2">Une Formation pour Booster votre Carrière</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-600 p-6 rounded-r-lg mb-8">
            <p className="text-slate-800 leading-relaxed">
              La formation <strong>"Création de contenus rédactionnels et visuels par l'usage responsable de l'intelligence artificielle générative"</strong> est conçue pour transformer votre manière de travailler. Chez AIssociate, nous croyons que l'IA n'est pas seulement un outil, mais un partenaire stratégique pour votre efficacité quotidienne.
            </p>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Star className="w-6 h-6 text-amber-500" />
                Pourquoi choisir cette formation ?
              </h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-slate-900">Expertise Reconnue</h4>
                  </div>
                  <p className="text-slate-700 text-sm">
                    Formation animée par des experts du domaine, dont Shanti Meralli Ballou.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <h4 className="font-bold text-slate-900">Accompagnement Personnalisé</h4>
                  </div>
                  <p className="text-slate-700 text-sm">
                    Groupes restreints pour un suivi sur-mesure.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <h4 className="font-bold text-slate-900">Format Intensif</h4>
                  </div>
                  <p className="text-slate-700 text-sm">
                    21 heures pour acquérir des compétences immédiatement actionnables.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-5 h-5 text-cyan-600" />
                    <h4 className="font-bold text-slate-900">Ressources Exclusives</h4>
                  </div>
                  <p className="text-slate-700 text-sm">
                    Accès à un espace de ressources partagées (Padlet) en ligne.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 md:col-span-2">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h4 className="font-bold text-slate-900">Inclusion</h4>
                  </div>
                  <p className="text-slate-700 text-sm">
                    Accueil pédagogique confortable et accessible aux personnes en situation de handicap.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" />
                Notre Méthode : L'Apprentissage par l'Action
              </h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                Nous appliquons une méthode active des apprentissages centrée sur vos besoins réels :
              </p>

              <div className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-r-lg">
                  <h4 className="font-bold text-blue-900 mb-2">Formation en mode-projet</h4>
                  <p className="text-blue-800 text-sm">
                    Vous travaillez directement sur vos propres cas d'usage pour créer votre offre digitalisée.
                  </p>
                </div>

                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-5 rounded-r-lg">
                  <h4 className="font-bold text-emerald-900 mb-2">Théorie synthétisée</h4>
                  <p className="text-emerald-800 text-sm">
                    L'essentiel des concepts théoriques pour laisser un maximum de place à la mise en pratique.
                  </p>
                </div>

                <div className="bg-orange-50 border-l-4 border-orange-500 p-5 rounded-r-lg">
                  <h4 className="font-bold text-orange-900 mb-2">Interaction & Co-construction</h4>
                  <p className="text-orange-800 text-sm">
                    L'exploration et la recherche collective sont au cœur de notre pédagogie.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-emerald-600" />
                Programme de la Formation
              </h3>

              <div className="bg-slate-50 rounded-lg p-6 mb-6">
                <h4 className="font-bold text-slate-900 mb-4">Public visé</h4>
                <p className="text-slate-700 text-sm mb-4">
                  Cette formation s'adresse aux <strong>salariés, indépendants, dirigeants et demandeurs d'emploi</strong> souhaitant développer des compétences opérationnelles dans l'usage professionnel et responsable de l'intelligence artificielle générative.
                </p>
                <h4 className="font-bold text-slate-900 mb-2">Prérequis</h4>
                <p className="text-slate-700 text-sm">
                  Maîtrise de base de l'outil informatique et navigation internet.
                </p>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">1</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-blue-900 text-lg mb-2">
                        Module 1 : Mise en œuvre de la stratégie d'implémentation de l'IA générative
                      </h4>
                      <ul className="text-blue-800 text-sm space-y-2 mb-3">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>Analyse du contexte et identification des besoins</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>Configuration des outils d'IA Générative</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>Élaboration d'un plan d'actions pour l'implémentation</span>
                        </li>
                      </ul>
                      <p className="text-sm text-blue-700 italic">Étude de cas | Mise en pratique | QCM d'évaluation</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border border-emerald-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">2</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-emerald-900 text-lg mb-2">
                        Module 2 : Création de contenus rédactionnels et visuels
                      </h4>
                      <ul className="text-emerald-800 text-sm space-y-2 mb-3">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>Les techniques de Prompt Engineering</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>Créer des contenus rédactionnels et visuels avec l'IA Générative</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>Garantir la confidentialité des données professionnelles</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>La création de contenus inclusifs & accessibles</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>Les techniques d'optimisation des contenus</span>
                        </li>
                      </ul>
                      <p className="text-sm text-emerald-700 italic">Étude de cas | Mise en pratique | QCM d'évaluation</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">3</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-orange-900 text-lg mb-2">
                        Module 3 : Conformité éthique et réglementaire
                      </h4>
                      <ul className="text-orange-800 text-sm space-y-2 mb-3">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                          <span>Le cadre réglementaire Européen : les directives de l'IA Act</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                          <span>La protection des données personnelles : le RGPD</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                          <span>La mise en place d'une veille réglementaire</span>
                        </li>
                      </ul>
                      <p className="text-sm text-orange-700 italic">Étude de cas | Mise en pratique | QCM d'évaluation</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" />
                Objectifs Pédagogiques
              </h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                À l'issue de la formation, le participant sera capable de :
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">Analyser ses besoins professionnels en matière d'IA générative</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">Utiliser des outils d'IA générative pour créer des contenus rédactionnels et visuels</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">Appliquer les principes de confidentialité et de protection des données</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">Produire des contenus conformes aux exigences éthiques et réglementaires</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">Intégrer l'IA générative de manière responsable dans ses pratiques professionnelles</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-emerald-600" />
                Modalités et délais d'accès
              </h3>

              <div className="space-y-4">
                <div className="bg-slate-50 border-l-4 border-slate-600 p-5 rounded-r-lg">
                  <h4 className="font-bold text-slate-900 mb-2">Modalités d'accès</h4>
                  <p className="text-slate-700 text-sm">
                    L'inscription à la formation s'effectue après validation du dossier administratif et, le cas échéant, du financement. Les délais d'accès sont généralement de <strong>14 jours minimum</strong> avant le démarrage de la formation.
                  </p>
                </div>

                <div className="bg-slate-50 border-l-4 border-slate-600 p-5 rounded-r-lg">
                  <h4 className="font-bold text-slate-900 mb-2">Modalités pédagogiques</h4>
                  <p className="text-slate-700 text-sm">
                    La formation est dispensée en <strong>présentiel, à distance ou selon des modalités mixtes</strong>, en fonction des sessions proposées. Les modalités exactes sont précisées avant l'entrée en formation.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                Votre Formateur
              </h3>

              <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 text-xl mb-2">Shanti MERALLI BALLOU</h4>
                    <p className="text-blue-700 font-semibold mb-3">Dirigeant d'Entreprise Innovante & Expert IA</p>
                    <p className="text-slate-700 text-sm mb-4">
                      Fort d'une expérience de plus de 10 ans dans la direction opérationnelle et le développement de start-ups (Silicon-Village, Soukéo), Shanti accompagne aujourd'hui les entreprises dans leur transition vers l'IA.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Award className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700 text-sm">MBA Dirigeant d'Entreprise (CPA / Harvard Business School methodology)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Award className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700 text-sm">Certifié OpenAI & ChatGPT (Modélisation, Fine-tuning, Prompts complexes)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Award className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700 text-sm">Expertise Multimodale : IA, Blockchain et Stratégie Marketing Digitale</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Informations Pratiques</h3>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">Lieu de la formation</h4>
                      <p className="text-slate-700 text-sm">
                        36 Chemin de l'État Major, La Montagne, 97417 Saint-Denis, La Réunion
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <Euro className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 mb-3">Financement</h4>
                      <p className="text-slate-700 text-sm mb-3">Votre formation peut être prise en charge par :</p>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="text-slate-700 text-sm">CPF (Compte Personnel de Formation)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="text-slate-700 text-sm">OPCO (Opérateurs de Compétences)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="text-slate-700 text-sm">FAF (Fonds d'Assurance Formation)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="text-slate-700 text-sm">France Travail</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="text-slate-700 text-sm">AGEFIPH (Personnes en situation de handicap)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <Euro className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">Tarifs</h4>
                      <div className="space-y-1">
                        <p className="text-slate-700 text-sm">
                          <strong>Inter-entreprise :</strong> 1600 € / participant
                        </p>
                        <p className="text-slate-700 text-sm">
                          <strong>Intra-entreprise :</strong> Sur devis
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">Contact / Réclamation</h4>
                      <p className="text-slate-700 text-sm mb-2">
                        Pour toute question, information complémentaire ou réclamation :
                      </p>
                      <div className="space-y-1">
                        <p className="text-slate-700 text-sm">
                          <strong>Email :</strong> contact@aissociate.re
                        </p>
                        <p className="text-slate-700 text-sm">
                          <strong>Téléphone :</strong> 0692 24 68 60
                        </p>
                        <p className="text-slate-700 text-sm">
                          <strong>Site web :</strong> www.aissociate.re
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-8 text-white">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center mx-auto mb-4">
                    <Award className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Organisme de Formation Certifié</h3>
                  <div className="space-y-1 text-blue-100 text-sm">
                    <p>NDA 04973754797 DEETS La Réunion</p>
                    <p>RCS St-Denis 995 220 407 - APE 8559</p>
                    <p>SARL au Capital Social de 100 €</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200">
            <button
              onClick={() => navigate('/formation')}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Retour à la formation
            </button>
          </div>
        </article>
      </main>
    </div>
  );
}

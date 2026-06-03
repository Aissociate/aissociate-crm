// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Target, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import AdminLogo from '../../components/AdminLogo';

export default function VisionFunnel() {
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
            <h1 className="text-xl font-bold text-slate-900">Vision & Funnel Aissociate</h1>
            <p className="text-sm text-slate-600">Module commun obligatoire</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Target className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Vision & Funnel Aissociate</h2>
              <p className="text-slate-600 mt-2">Comprendre notre mission et notre processus commercial</p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl overflow-hidden mb-8 aspect-video flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-blue-700 transition-colors">
                <Play className="w-10 h-10 text-white ml-1" />
              </div>
              <p className="text-white text-lg">Vidéo de présentation - 15 minutes</p>
              <p className="text-slate-400 text-sm mt-2">Cliquez pour lancer la vidéo</p>
            </div>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" />
                La vision Aissociate
              </h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Aissociate a pour mission de démocratiser l'accès à la formation professionnelle de qualité. Nous croyons que chaque personne, quel que soit son parcours, mérite l'opportunité de développer ses compétences et d'évoluer professionnellement.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg mb-6">
                <p className="font-semibold text-blue-900 mb-2">Notre engagement :</p>
                <p className="text-blue-800">
                  Offrir des formations certifiantes et qualifiantes qui répondent aux besoins réels du marché du travail, avec un accompagnement personnalisé pour maximiser les chances de réussite de chaque apprenant.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
                Le funnel commercial Aissociate
              </h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                Notre processus commercial est structuré en plusieurs étapes, chacune ayant un rôle précis dans l'accompagnement du prospect vers sa formation.
              </p>

              <div className="space-y-6">
                <div className="relative pl-8 pb-8 border-l-2 border-blue-300">
                  <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h4 className="font-bold text-blue-900 text-lg mb-2">Génération de leads</h4>
                    <p className="text-blue-800 mb-3">
                      Identification et qualification initiale des prospects potentiels via différents canaux (publicité digitale, partenariats, événements).
                    </p>
                    <div className="text-sm text-blue-700">
                      <strong>Objectif :</strong> Attirer des personnes intéressées par la formation professionnelle
                    </div>
                  </div>
                </div>

                <div className="relative pl-8 pb-8 border-l-2 border-orange-300">
                  <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-6">
                    <h4 className="font-bold text-orange-900 text-lg mb-2">Phase Fixer</h4>
                    <p className="text-orange-800 mb-3">
                      Premier contact avec le prospect. Le Fixer qualifie le besoin, évalue l'éligibilité CPF, et prend rendez-vous pour un entretien approfondi avec un Closer.
                    </p>
                    <div className="text-sm text-orange-700 space-y-1">
                      <div><strong>Rôle du Fixer :</strong></div>
                      <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>Qualifier rapidement le prospect</li>
                        <li>Vérifier l'éligibilité CPF</li>
                        <li>Identifier le besoin en formation</li>
                        <li>Planifier le RDV avec le Closer</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="relative pl-8 pb-8 border-l-2 border-emerald-300">
                  <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-6">
                    <h4 className="font-bold text-emerald-900 text-lg mb-2">Phase Closer</h4>
                    <p className="text-emerald-800 mb-3">
                      Entretien approfondi avec le prospect. Le Closer analyse le projet professionnel, présente les formations adaptées, et accompagne la décision éclairée du prospect.
                    </p>
                    <div className="text-sm text-emerald-700 space-y-1">
                      <div><strong>Rôle du Closer :</strong></div>
                      <ul className="list-disc list-inside ml-2 space-y-1">
                        <li>Analyser le projet professionnel en détail</li>
                        <li>Présenter les formations pertinentes</li>
                        <li>Expliquer le processus CPF et le financement</li>
                        <li>Accompagner vers une décision éclairée</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="relative pl-8 pb-8 border-l-2 border-purple-300">
                  <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">4</span>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-6">
                    <h4 className="font-bold text-purple-900 text-lg mb-2">Inscription et démarrage</h4>
                    <p className="text-purple-800 mb-3">
                      Le prospect devient apprenant. Inscription sur Mon Compte Formation, validation par l'organisme, et début de la formation après le délai de rétractation.
                    </p>
                    <div className="text-sm text-purple-700">
                      <strong>Délai moyen :</strong> 2-3 semaines entre la décision et le début de la formation
                    </div>
                  </div>
                </div>

                <div className="relative pl-8">
                  <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-green-50 rounded-lg p-6">
                    <h4 className="font-bold text-green-900 text-lg mb-2">Suivi et accompagnement</h4>
                    <p className="text-green-800 mb-3">
                      Tout au long de la formation, l'apprenant bénéficie d'un suivi pédagogique et d'un accompagnement pour maximiser ses chances de réussite et d'obtention de la certification.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                La complémentarité Fixer / Closer
              </h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                Le modèle Aissociate repose sur une collaboration étroite entre Fixers et Closers. Chacun a un rôle spécifique et complémentaire.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <h4 className="font-bold text-orange-900 mb-3 text-lg">Le Fixer</h4>
                  <ul className="space-y-2 text-orange-800 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>Volume : gère un grand nombre de contacts</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>Rapidité : qualification en 5-10 minutes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>Efficacité : filtre les prospects non qualifiés</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>Organisation : planifie les RDV Closer</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                  <h4 className="font-bold text-emerald-900 mb-3 text-lg">Le Closer</h4>
                  <ul className="space-y-2 text-emerald-800 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>Qualité : entretiens approfondis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>Expertise : conseil personnalisé</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>Conversion : accompagne la décision</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>Relation : construit la confiance</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Les indicateurs de performance</h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                Pour mesurer l'efficacité de notre funnel, nous suivons plusieurs KPIs à chaque étape :
              </p>
              <div className="bg-slate-50 rounded-lg p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <span className="font-semibold text-slate-900">Taux de qualification Fixer</span>
                    <span className="text-slate-700">Objectif : 40-50%</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <span className="font-semibold text-slate-900">Taux de présence RDV Closer</span>
                    <span className="text-slate-700">Objectif : 60-70%</span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <span className="font-semibold text-slate-900">Taux de conversion Closer</span>
                    <span className="text-slate-700">Objectif : 25-35%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-900">Taux de rétractation</span>
                    <span className="text-slate-700">Objectif : moins de 5%</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Points clés à retenir</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-slate-700">Notre mission est de faciliter l'accès à la formation professionnelle de qualité</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-slate-700">Le funnel est structuré pour accompagner chaque prospect de manière personnalisée</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-slate-700">La collaboration Fixer/Closer est essentielle à notre réussite</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-slate-700">Chaque étape du processus a des objectifs précis et mesurables</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <p className="text-slate-700">La qualité prime toujours sur la quantité : un prospect bien conseillé devient un ambassadeur</p>
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

// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, Scale, Shield } from 'lucide-react';
import AdminLogo from '../../components/AdminLogo';

export default function CadreLegalQualiopi() {
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
            <h1 className="text-xl font-bold text-slate-900">Cadre légal & Qualiopi</h1>
            <p className="text-sm text-slate-600">Module commun obligatoire</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Scale className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Cadre légal & Certification Qualiopi</h2>
              <p className="text-slate-600 mt-2">Comprendre le cadre réglementaire de la formation professionnelle</p>
            </div>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Qu'est-ce que la certification Qualiopi ?
              </h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Qualiopi est une certification qualité obligatoire pour tous les organismes de formation qui souhaitent accéder aux fonds publics et mutualisés (CPF, OPCO, etc.). Elle garantit la qualité des processus mis en œuvre par les prestataires d'actions de formation.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg mb-6">
                <p className="font-semibold text-blue-900 mb-2">Pourquoi Qualiopi est important pour vous ?</p>
                <p className="text-blue-800">
                  En tant que commercial chez Aissociate, vous représentez un organisme certifié Qualiopi. Cette certification est un gage de confiance et de qualité que vous devez mettre en avant auprès de vos prospects.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Les 7 critères de la certification Qualiopi</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-slate-900">1. Conditions d'information du public</h4>
                  <p className="text-slate-700">L'organisme doit fournir une information claire et accessible sur ses formations.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-slate-900">2. Identification précise des objectifs</h4>
                  <p className="text-slate-700">Les objectifs de formation doivent être clairement définis et adaptés aux besoins.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-slate-900">3. Adaptation aux bénéficiaires</h4>
                  <p className="text-slate-700">Les dispositifs d'accueil, d'accompagnement et de formation doivent être adaptés.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-slate-900">4. Qualité des moyens pédagogiques</h4>
                  <p className="text-slate-700">Les moyens pédagogiques, techniques et d'encadrement doivent être adéquats.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-slate-900">5. Qualification des formateurs</h4>
                  <p className="text-slate-700">Les compétences des formateurs doivent être maintenues et développées.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-slate-900">6. Investissement dans l'environnement professionnel</h4>
                  <p className="text-slate-700">L'organisme doit s'inscrire dans son environnement socio-économique.</p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-bold text-slate-900">7. Recueil et prise en compte des appréciations</h4>
                  <p className="text-slate-700">Les retours des bénéficiaires doivent être collectés et exploités.</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                Obligations légales du commercial
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-4">
                <h4 className="font-bold text-amber-900 mb-3">Ce que vous DEVEZ faire :</h4>
                <ul className="space-y-2 text-amber-900">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Fournir une information claire et transparente sur la formation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Mentionner la certification Qualiopi de l'organisme</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Respecter le délai de rétractation de 14 jours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Vérifier l'éligibilité CPF du prospect</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Présenter le programme de formation de manière fidèle</span>
                  </li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h4 className="font-bold text-red-900 mb-3">Ce que vous NE DEVEZ PAS faire :</h4>
                <ul className="space-y-2 text-red-900">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Faire de fausses promesses sur les résultats de la formation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Harceler le prospect pour qu'il s'inscrive rapidement</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Cacher ou minimiser des informations importantes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Présenter la formation comme obligatoire ou urgente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Négliger de vérifier que la formation correspond aux besoins du prospect</span>
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Le cadre légal de la vente de formation CPF</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                La vente de formations financées par le CPF est strictement encadrée par la loi. Le non-respect de ces règles peut entraîner des sanctions pénales pour l'organisme et potentiellement pour le commercial.
              </p>
              <div className="bg-slate-100 rounded-lg p-6">
                <h4 className="font-bold text-slate-900 mb-3">Points de vigilance :</h4>
                <ul className="space-y-2 text-slate-700">
                  <li>• Le démarchage téléphonique non sollicité pour les formations CPF est INTERDIT</li>
                  <li>• Le prospect doit avoir initié le contact ou donné son accord préalable</li>
                  <li>• La publicité mensongère est sévèrement sanctionnée</li>
                  <li>• Le consentement du bénéficiaire doit être libre et éclairé</li>
                  <li>• Toute pression commerciale excessive est prohibée</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Quiz de validation</h3>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-6">
                  <p className="font-semibold text-slate-900 mb-2">Question 1 : Qu'est-ce que la certification Qualiopi garantit ?</p>
                  <p className="text-slate-700">La qualité des processus de formation de l'organisme</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-6">
                  <p className="font-semibold text-slate-900 mb-2">Question 2 : Combien de jours de rétractation le bénéficiaire a-t-il ?</p>
                  <p className="text-slate-700">14 jours à compter de la signature du contrat</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-6">
                  <p className="font-semibold text-slate-900 mb-2">Question 3 : Le démarchage téléphonique non sollicité pour le CPF est-il autorisé ?</p>
                  <p className="text-slate-700">Non, il est strictement interdit par la loi</p>
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

// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Euro, Clock, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import AdminLogo from '../../components/AdminLogo';

export default function CadreCPF() {
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
            <h1 className="text-xl font-bold text-slate-900">Cadre CPF</h1>
            <p className="text-sm text-slate-600">Module Closer obligatoire</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Le Compte Personnel de Formation (CPF)</h2>
              <p className="text-slate-600 mt-2">Tout ce que vous devez savoir sur le financement CPF</p>
            </div>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Qu'est-ce que le CPF ?</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Le Compte Personnel de Formation (CPF) est un dispositif de financement public de la formation continue. Chaque personne dispose, dès son entrée sur le marché du travail et jusqu'à sa retraite, d'un compte crédité en euros pour financer des formations qualifiantes ou certifiantes.
              </p>
              <div className="bg-emerald-50 border-l-4 border-emerald-600 p-6 rounded-r-lg mb-6">
                <p className="font-semibold text-emerald-900 mb-2">À retenir :</p>
                <p className="text-emerald-800">
                  Le CPF est un droit universel d'évolution professionnelle attaché à la personne tout au long de sa vie active jusqu'à la retraite. Il est universel, individuel et portable.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Euro className="w-7 h-7 text-emerald-600" />
                Comment est alimenté le CPF ?
              </h3>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-6">
                  <h4 className="font-bold text-slate-900 mb-2">Pour les salariés :</h4>
                  <ul className="space-y-2 text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>500 € par an pour un temps plein (au prorata pour un temps partiel)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Plafond de 5 000 €</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>800 € par an pour les salariés non qualifiés (plafond de 8 000 €)</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-lg p-6">
                  <h4 className="font-bold text-slate-900 mb-2">Pour les travailleurs indépendants :</h4>
                  <ul className="space-y-2 text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>500 € par an (sous condition d'activité)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Plafond de 5 000 €</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Quelles formations sont éligibles au CPF ?</h3>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-slate-900">1. Formations certifiantes</h4>
                  <p className="text-slate-700">Inscrites au Répertoire National des Certifications Professionnelles (RNCP)</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-slate-900">2. Attestations de validation de blocs de compétences</h4>
                  <p className="text-slate-700">Parties identifiées de certifications professionnelles</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-slate-900">3. Certifications et habilitations</h4>
                  <p className="text-slate-700">Inscrites au Répertoire Spécifique (ex : CACES, habilitations électriques, etc.)</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-slate-900">4. Actions de validation des acquis de l'expérience (VAE)</h4>
                  <p className="text-slate-700">Permettant d'obtenir une certification professionnelle</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-slate-900">5. Bilans de compétences</h4>
                  <p className="text-slate-700">Pour faire le point sur ses compétences et son projet professionnel</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-bold text-slate-900">6. Préparation aux épreuves du permis de conduire</h4>
                  <p className="text-slate-700">Permis B et permis poids lourds</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-7 h-7 text-blue-600" />
                Le processus d'inscription à une formation CPF
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-blue-600">1</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Connexion sur Mon Compte Formation</h4>
                    <p className="text-slate-700">Le bénéficiaire se connecte à son espace personnel sur moncompteformation.gouv.fr</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-blue-600">2</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Recherche de la formation</h4>
                    <p className="text-slate-700">Recherche par mots-clés, localisation ou organisme de formation</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-blue-600">3</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Inscription à la formation</h4>
                    <p className="text-slate-700">Sélection des dates et envoi de la demande d'inscription</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-blue-600">4</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Validation par l'organisme</h4>
                    <p className="text-slate-700">L'organisme de formation dispose de 2 jours ouvrés pour accepter ou refuser</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-blue-600">5</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Délai de rétractation</h4>
                    <p className="text-slate-700">14 jours de délai de rétractation après l'acceptation</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-blue-600">6</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Début de la formation</h4>
                    <p className="text-slate-700">La formation peut commencer après le délai de rétractation</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
                Points d'attention pour le Closer
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-4">
                <h4 className="font-bold text-amber-900 mb-3">Vérifications obligatoires :</h4>
                <ul className="space-y-2 text-amber-900">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Vérifier que le prospect dispose de droits CPF suffisants</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>S'assurer que la formation correspond aux besoins et au projet professionnel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Expliquer clairement le délai de rétractation de 14 jours</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Informer sur les modalités de formation (durée, rythme, prérequis)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Présenter la certification visée et sa valeur sur le marché du travail</span>
                  </li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h4 className="font-bold text-red-900 mb-3">Interdictions absolues :</h4>
                <ul className="space-y-2 text-red-900">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Créer un compte Mon Compte Formation à la place du prospect</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Demander les identifiants de connexion du prospect</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Inscrire le prospect à sa place sur la plateforme CPF</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Présenter le CPF comme une opportunité limitée dans le temps</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Garantir un emploi ou une augmentation de salaire après la formation</span>
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Info className="w-7 h-7 text-blue-600" />
                Le rôle du Closer dans l'accompagnement CPF
              </h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Votre rôle en tant que Closer est d'accompagner le prospect dans sa réflexion et de l'aider à prendre une décision éclairée. Vous n'êtes pas là pour "vendre" une formation, mais pour conseiller et guider.
              </p>
              <div className="bg-blue-50 rounded-lg p-6">
                <h4 className="font-bold text-blue-900 mb-3">Votre posture idéale :</h4>
                <ul className="space-y-2 text-blue-800">
                  <li>• Être un conseiller plutôt qu'un vendeur</li>
                  <li>• Poser des questions pour comprendre les besoins réels</li>
                  <li>• Présenter les bénéfices de manière honnête et réaliste</li>
                  <li>• Respecter le temps de réflexion du prospect</li>
                  <li>• Être transparent sur tous les aspects de la formation</li>
                  <li>• Documenter tous les échanges pour la traçabilité</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Abondements et compléments de financement</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Si le montant de la formation dépasse le solde CPF du bénéficiaire, plusieurs solutions existent :
              </p>
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900">1. Abondement employeur</h4>
                  <p className="text-slate-700 text-sm">L'employeur peut compléter le financement</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900">2. Abondement Pôle Emploi</h4>
                  <p className="text-slate-700 text-sm">Pour les demandeurs d'emploi</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900">3. Abondement régional</h4>
                  <p className="text-slate-700 text-sm">Selon les dispositifs régionaux</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900">4. Paiement personnel</h4>
                  <p className="text-slate-700 text-sm">Le bénéficiaire peut compléter de sa poche</p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200">
            <button
              onClick={() => navigate('/formation')}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Retour à la formation
            </button>
          </div>
        </article>
      </main>
    </div>
  );
}

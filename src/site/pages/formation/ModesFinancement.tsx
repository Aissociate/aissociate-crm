// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Euro, Building2, Users, Briefcase, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import AdminLogo from '../../components/AdminLogo';

export default function ModesFinancement() {
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
            <h1 className="text-xl font-bold text-slate-900">Les différents modes de financement</h1>
            <p className="text-sm text-slate-600">Module Closer obligatoire</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <Euro className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Les différents modes de financement</h2>
              <p className="text-slate-600 mt-2">Comprendre toutes les options de financement pour mieux conseiller</p>
            </div>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <div className="bg-emerald-50 border-l-4 border-emerald-600 p-6 rounded-r-lg mb-6">
                <p className="font-semibold text-emerald-900 mb-2">Pourquoi connaître tous les modes de financement ?</p>
                <p className="text-emerald-800">
                  En tant que Closer, vous devez être capable de présenter toutes les options de financement disponibles pour permettre à chaque prospect de trouver la solution adaptée à sa situation. Une bonne connaissance du financement est la clé pour lever les freins financiers.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Vue d'ensemble des modes de financement</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <Euro className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-blue-900">CPF</h4>
                  </div>
                  <p className="text-blue-800 text-sm">Le financement principal pour la majorité des formations</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-orange-900">OPCO</h4>
                  </div>
                  <p className="text-orange-800 text-sm">Pour les salariés et les TPE/PME</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-purple-900">Pôle Emploi</h4>
                  </div>
                  <p className="text-purple-800 text-sm">Pour les demandeurs d'emploi</p>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-600 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-bold text-cyan-900">Employeur</h4>
                  </div>
                  <p className="text-cyan-800 text-sm">Via le plan de développement des compétences</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Euro className="w-7 h-7 text-blue-600" />
                1. Le Compte Personnel de Formation (CPF)
              </h3>
              <div className="bg-blue-50 rounded-lg p-6 mb-4">
                <h4 className="font-bold text-blue-900 mb-3">Caractéristiques principales</h4>
                <ul className="space-y-2 text-blue-800">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Public :</strong> Tous les actifs, salariés et indépendants</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Alimentation :</strong> 500€ par an (800€ pour les non qualifiés)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Plafond :</strong> 5 000€ (8 000€ pour les non qualifiés)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Mobilisation :</strong> À l'initiative du bénéficiaire</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white border border-blue-200 rounded-lg p-6">
                <h4 className="font-bold text-slate-900 mb-3">Abondements possibles du CPF</h4>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-slate-900">Abondement employeur</p>
                    <p className="text-slate-700 text-sm">L'employeur peut compléter si les droits CPF sont insuffisants</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Abondement Pôle Emploi (AIF)</p>
                    <p className="text-slate-700 text-sm">Pour les demandeurs d'emploi dont le CPF ne suffit pas</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Abondements correctifs</p>
                    <p className="text-slate-700 text-sm">En cas de discrimination ou d'accident du travail</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Financement personnel</p>
                    <p className="text-slate-700 text-sm">Le bénéficiaire peut compléter de sa poche</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Building2 className="w-7 h-7 text-orange-600" />
                2. Les OPCO (Opérateurs de Compétences)
              </h3>
              <div className="bg-orange-50 rounded-lg p-6 mb-4">
                <h4 className="font-bold text-orange-900 mb-3">Qu'est-ce qu'un OPCO ?</h4>
                <p className="text-orange-800 mb-4">
                  Les OPCO sont des organismes paritaires agréés par l'État qui accompagnent la formation professionnelle. Chaque entreprise cotise à un OPCO selon son secteur d'activité.
                </p>
                <h4 className="font-bold text-orange-900 mb-3">Les 11 OPCO en France :</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-orange-800">
                  <div>• OPCO 2i (Interindustriel)</div>
                  <div>• AFDAS (Culture, médias)</div>
                  <div>• AKTO (Services)</div>
                  <div>• ATLAS (Assurance)</div>
                  <div>• Constructys (BTP)</div>
                  <div>• OCAPIAT (Agriculture)</div>
                  <div>• OPCO EP (Entreprises de proximité)</div>
                  <div>• OPCO Mobilités (Transport)</div>
                  <div>• OPCO Santé</div>
                  <div>• Uniformation (Cohésion sociale)</div>
                  <div>• L'Opcommerce (Commerce)</div>
                </div>
              </div>
              <div className="bg-white border border-orange-200 rounded-lg p-6">
                <h4 className="font-bold text-slate-900 mb-3">Financement OPCO : plusieurs dispositifs</h4>
                <div className="space-y-4">
                  <div className="border-l-4 border-orange-400 pl-4">
                    <h5 className="font-semibold text-slate-900">Plan de développement des compétences</h5>
                    <p className="text-slate-700 text-sm">Pour les TPE/PME de moins de 50 salariés, l'OPCO peut prendre en charge tout ou partie du coût de la formation</p>
                  </div>
                  <div className="border-l-4 border-orange-400 pl-4">
                    <h5 className="font-semibold text-slate-900">Pro-A (Reconversion ou promotion par alternance)</h5>
                    <p className="text-slate-700 text-sm">Pour les salariés en CDI avec un niveau de qualification inférieur à la licence</p>
                  </div>
                  <div className="border-l-4 border-orange-400 pl-4">
                    <h5 className="font-semibold text-slate-900">Contrats d'apprentissage et de professionnalisation</h5>
                    <p className="text-slate-700 text-sm">Financement de la formation pour les alternants</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-7 h-7 text-purple-600" />
                3. Pôle Emploi
              </h3>
              <div className="bg-purple-50 rounded-lg p-6 mb-4">
                <h4 className="font-bold text-purple-900 mb-3">Dispositifs Pôle Emploi</h4>
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4">
                    <h5 className="font-semibold text-purple-900 mb-2">AIF (Aide Individuelle à la Formation)</h5>
                    <p className="text-purple-800 text-sm mb-2">
                      Complément de financement quand le CPF ne suffit pas, ou financement total si pas de droits CPF
                    </p>
                    <div className="text-purple-700 text-xs space-y-1">
                      <p>• Public : Demandeurs d'emploi inscrits</p>
                      <p>• Montant : Variable selon le projet et les droits CPF</p>
                      <p>• Procédure : Demande via le conseiller Pôle Emploi</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <h5 className="font-semibold text-purple-900 mb-2">AFPR / POEI</h5>
                    <p className="text-purple-800 text-sm mb-2">
                      Action de Formation Préalable au Recrutement / Préparation Opérationnelle à l'Emploi Individuelle
                    </p>
                    <div className="text-purple-700 text-xs space-y-1">
                      <p>• Public : Demandeurs d'emploi avec une promesse d'embauche</p>
                      <p>• Objectif : Acquérir les compétences manquantes pour le poste</p>
                      <p>• Financement : Pris en charge par Pôle Emploi</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <h5 className="font-semibold text-purple-900 mb-2">Formations conventionnées</h5>
                    <p className="text-purple-800 text-sm mb-2">
                      Formations achetées par Pôle Emploi et proposées aux demandeurs d'emploi
                    </p>
                    <div className="text-purple-700 text-xs">
                      <p>• Gratuites pour le bénéficiaire</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-7 h-7 text-cyan-600" />
                4. Financement par l'employeur
              </h3>
              <div className="bg-cyan-50 rounded-lg p-6 mb-4">
                <h4 className="font-bold text-cyan-900 mb-3">Plan de développement des compétences</h4>
                <p className="text-cyan-800 mb-4">
                  Anciennement "plan de formation", il regroupe toutes les formations mises en place par l'employeur pour ses salariés. L'entreprise finance directement ou via son OPCO.
                </p>
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-4">
                    <h5 className="font-semibold text-cyan-900 mb-2">Formations obligatoires</h5>
                    <p className="text-cyan-800 text-sm">
                      Formations nécessaires pour le poste (sécurité, habilitations) - pendant le temps de travail avec maintien de salaire
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <h5 className="font-semibold text-cyan-900 mb-2">Formations non obligatoires</h5>
                    <p className="text-cyan-800 text-sm">
                      Développement des compétences - généralement pendant le temps de travail mais possibilité hors temps de travail avec accord
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                <p className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Point important pour le Closer
                </p>
                <p className="text-amber-800 text-sm">
                  Si le prospect est salarié et que son employeur est favorable, orienter vers une demande de financement employeur + OPCO peut être plus avantageux que le CPF seul.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Autres dispositifs de financement</h3>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-6">
                  <h4 className="font-bold text-slate-900 mb-2">Financement Région</h4>
                  <p className="text-slate-700 text-sm mb-2">
                    Les régions peuvent financer des formations dans le cadre de leur politique de formation professionnelle, notamment pour les demandeurs d'emploi.
                  </p>
                  <p className="text-slate-600 text-xs italic">Variable selon les régions et les formations prioritaires</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-6">
                  <h4 className="font-bold text-slate-900 mb-2">Agefiph (Travailleurs handicapés)</h4>
                  <p className="text-slate-700 text-sm mb-2">
                    Aide au financement de formation pour les personnes en situation de handicap.
                  </p>
                  <p className="text-slate-600 text-xs italic">Complément possible au CPF</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-6">
                  <h4 className="font-bold text-slate-900 mb-2">Transitions Pro (CPF de transition)</h4>
                  <p className="text-slate-700 text-sm mb-2">
                    Pour les projets de reconversion nécessitant une formation longue et certifiante.
                  </p>
                  <p className="text-slate-600 text-xs italic">Nécessite un projet de reconversion solide et une formation qualifiante</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
                Quelle solution pour quel profil ?
              </h3>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-r-lg">
                  <h4 className="font-bold text-blue-900 mb-2">Salarié en CDI/CDD</h4>
                  <p className="text-blue-800 text-sm mb-2">Solutions prioritaires :</p>
                  <ul className="text-blue-700 text-sm space-y-1">
                    <li>1. CPF (avec éventuel abondement employeur)</li>
                    <li>2. Plan de développement des compétences de l'employeur</li>
                    <li>3. Pro-A si reconversion interne</li>
                  </ul>
                </div>
                <div className="border-l-4 border-purple-500 bg-purple-50 p-4 rounded-r-lg">
                  <h4 className="font-bold text-purple-900 mb-2">Demandeur d'emploi</h4>
                  <p className="text-purple-800 text-sm mb-2">Solutions prioritaires :</p>
                  <ul className="text-purple-700 text-sm space-y-1">
                    <li>1. CPF + AIF Pôle Emploi (si droits CPF insuffisants)</li>
                    <li>2. Formations conventionnées Pôle Emploi</li>
                    <li>3. Aide Région si éligible</li>
                  </ul>
                </div>
                <div className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-lg">
                  <h4 className="font-bold text-orange-900 mb-2">Indépendant / Freelance</h4>
                  <p className="text-orange-800 text-sm mb-2">Solutions prioritaires :</p>
                  <ul className="text-orange-700 text-sm space-y-1">
                    <li>1. CPF (si droits disponibles)</li>
                    <li>2. FAF (Fonds d'Assurance Formation) selon l'activité</li>
                    <li>3. Financement personnel</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Conseils pour accompagner le financement</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <ul className="space-y-3 text-green-900">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Identifier d'abord la situation du prospect :</strong> Salarié, demandeur d'emploi, indépendant, secteur d'activité
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Vérifier le solde CPF en priorité :</strong> C'est le financement le plus simple et rapide
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Proposer des solutions de complément :</strong> Si le CPF ne suffit pas, présenter les abondements possibles
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Orienter vers les bons interlocuteurs :</strong> Conseiller Pôle Emploi, service RH, OPCO selon le cas
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">
                      <strong>Ne pas hésiter à consulter votre manager :</strong> Pour les cas complexes ou les cumuls de financement
                    </span>
                  </li>
                </ul>
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

// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Database, FileText, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import AdminLogo from '../../components/AdminLogo';

export default function FonctionnementCRM() {
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
            <h1 className="text-xl font-bold text-slate-900">Fonctionnement du CRM</h1>
            <p className="text-sm text-slate-600">Module commun obligatoire</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <article className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Database className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Fonctionnement du CRM</h2>
              <p className="text-slate-600 mt-2">Maîtriser l'outil au cœur de notre activité</p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl overflow-hidden mb-8 aspect-video flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-blue-700 transition-colors">
                <Play className="w-10 h-10 text-white ml-1" />
              </div>
              <p className="text-white text-lg">Tutoriel vidéo CRM - 25 minutes</p>
              <p className="text-slate-400 text-sm mt-2">Cliquez pour lancer la vidéo</p>
            </div>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Database className="w-6 h-6 text-blue-600" />
                Qu'est-ce que le CRM Aissociate ?
              </h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Le CRM (Customer Relationship Management) est l'outil central de notre activité commerciale. Il nous permet de gérer l'ensemble du parcours prospect, de la première prise de contact jusqu'au suivi post-formation.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-r-lg mb-6">
                <p className="font-semibold text-blue-900 mb-2">Pourquoi le CRM est essentiel :</p>
                <ul className="space-y-2 text-blue-800">
                  <li>• Centralise toutes les informations prospects/clients</li>
                  <li>• Assure la traçabilité de tous les échanges</li>
                  <li>• Permet le suivi des KPIs individuels et collectifs</li>
                  <li>• Garantit la conformité légale (RGPD, CPF)</li>
                  <li>• Facilite la collaboration entre Fixers et Closers</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-6 h-6 text-emerald-600" />
                Les dossiers dans le CRM
              </h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                Chaque prospect est représenté par un <strong>dossier</strong> dans le CRM. Ce dossier suit l'évolution du prospect tout au long du funnel commercial.
              </p>

              <div className="space-y-6">
                <div className="bg-slate-50 rounded-lg p-6">
                  <h4 className="font-bold text-slate-900 mb-3 text-lg">Structure d'un dossier</h4>
                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="font-semibold text-slate-900">Informations de contact</h5>
                      <p className="text-slate-700 text-sm">Nom, prénom, téléphone, email, localisation</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="font-semibold text-slate-900">Statut du dossier</h5>
                      <p className="text-slate-700 text-sm">À qualifier, Qualifié, RDV planifié, Gagné, Perdu, etc.</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="font-semibold text-slate-900">Historique des interactions</h5>
                      <p className="text-slate-700 text-sm">Tous les appels, emails, SMS échangés avec horodatage</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="font-semibold text-slate-900">Notes et commentaires</h5>
                      <p className="text-slate-700 text-sm">Informations importantes sur le projet, les besoins, les objections</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="font-semibold text-slate-900">Documents associés</h5>
                      <p className="text-slate-700 text-sm">Contrats, devis, justificatifs, enregistrements d'appels</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                  <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Règle d'or : UN dossier = UN prospect
                  </h4>
                  <p className="text-amber-800">
                    Ne jamais créer de doublon. Avant de créer un nouveau dossier, toujours vérifier qu'il n'existe pas déjà dans le système. Les doublons nuisent aux statistiques et peuvent créer des problèmes de conformité.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Cycle de vie d'un dossier</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-slate-700">1</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">Nouveau lead</h4>
                    <p className="text-slate-700 text-sm">Le dossier est créé avec les informations de base</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-semibold">Statut : Nouveau</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-orange-700">2</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">Qualification Fixer</h4>
                    <p className="text-slate-700 text-sm">Le Fixer contacte le prospect, qualifie le besoin, et met à jour le dossier</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-orange-200 text-orange-700 rounded-full text-xs font-semibold">Statut : En qualification</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-blue-700">3</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">RDV Closer planifié</h4>
                    <p className="text-slate-700 text-sm">Un rendez-vous est programmé avec un Closer, le dossier lui est assigné</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-blue-200 text-blue-700 rounded-full text-xs font-semibold">Statut : RDV planifié</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-emerald-700">4</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">Entretien Closer</h4>
                    <p className="text-slate-700 text-sm">Le Closer mène l'entretien et met à jour le dossier avec les détails</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-emerald-200 text-emerald-700 rounded-full text-xs font-semibold">Statut : En négociation</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-700" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">Inscription validée</h4>
                    <p className="text-slate-700 text-sm">Le prospect s'inscrit sur Mon Compte Formation</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-green-200 text-green-700 rounded-full text-xs font-semibold">Statut : Gagné</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-600" />
                Utilisation du CRM selon le rôle
              </h3>

              <div className="space-y-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <h4 className="font-bold text-orange-900 mb-3 text-lg">Pour les Fixers</h4>
                  <ul className="space-y-2 text-orange-800">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Créer les dossiers</strong> pour les nouveaux leads</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Noter toutes les interactions</strong> (appels, SMS, emails)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Qualifier le prospect</strong> (éligibilité CPF, besoin, motivation)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Planifier les RDV Closer</strong> et assigner le dossier</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Mettre à jour les statuts</strong> en temps réel</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                  <h4 className="font-bold text-emerald-900 mb-3 text-lg">Pour les Closers</h4>
                  <ul className="space-y-2 text-emerald-800">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Consulter les dossiers assignés</strong> avant chaque RDV</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Compléter les informations</strong> après l'entretien</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Joindre les documents</strong> (devis, programme de formation)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Suivre le pipeline</strong> de ses dossiers en cours</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span><strong>Actualiser le statut</strong> (Gagné, Perdu, À recontacter)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Conformité et traçabilité</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Le CRM joue un rôle crucial dans la conformité légale de notre activité. Chaque action doit être documentée.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h4 className="font-bold text-red-900 mb-3">Obligations légales :</h4>
                <ul className="space-y-2 text-red-800">
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Tracer tous les contacts avec le prospect (date, heure, canal, contenu)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Conserver les preuves de consentement (accord RGPD, acceptation des CGV)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Documenter les informations fournies au prospect</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <span>Archiver les enregistrements d'appels (avec accord du prospect)</span>
                  </li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Bonnes pratiques CRM</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 border-l-4 border-green-500 p-4">
                  <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    À FAIRE
                  </h4>
                  <ul className="space-y-1 text-green-800 text-sm">
                    <li>• Mettre à jour en temps réel</li>
                    <li>• Être précis et factuel</li>
                    <li>• Utiliser les champs standardisés</li>
                    <li>• Vérifier les coordonnées</li>
                    <li>• Consulter l'historique avant contact</li>
                  </ul>
                </div>
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                  <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    À NE PAS FAIRE
                  </h4>
                  <ul className="space-y-1 text-red-800 text-sm">
                    <li>• Créer des doublons</li>
                    <li>• Laisser des champs vides</li>
                    <li>• Utiliser des abréviations</li>
                    <li>• Oublier de noter un appel</li>
                    <li>• Copier/coller des notes génériques</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Suivi des performances</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                Le CRM permet de suivre vos performances en temps réel. Consultez régulièrement votre tableau de bord pour :
              </p>
              <div className="bg-slate-50 rounded-lg p-6">
                <ul className="space-y-2 text-slate-700">
                  <li>• Voir le nombre de dossiers traités</li>
                  <li>• Suivre votre taux de conversion</li>
                  <li>• Identifier les prospects à relancer</li>
                  <li>• Comprendre vos points forts et axes d'amélioration</li>
                  <li>• Comparer vos résultats avec les objectifs</li>
                </ul>
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

// @ts-nocheck
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { GraduationCap, Clock, Users, Euro, Award, CheckCircle, TrendingUp } from 'lucide-react';

export default function FormationsList() {
  const formations = [
    {
      id: 'creation-contenus-ia',
      title: 'Création de contenus rédactionnels et visuels par l\'IA générative',
      subtitle: 'Usage responsable de l\'intelligence artificielle',
      description: 'Formation certifiante pour maîtriser la création de contenus avec l\'IA générative tout en respectant les principes de confidentialité et protection des données.',
      duration: '21h (3 jours)',
      participants: 'Grand public',
      price: '1 600 €',
      level: 'Débutant',
      certifications: ['CPF', 'RS 7667', 'Certifiant'],
      objectives: [
        'Analyser ses besoins professionnels en matière d\'IA générative',
        'Utiliser des outils d\'IA pour créer des contenus rédactionnels et visuels',
        'Appliquer les principes de confidentialité et protection des données (RGPD)',
        'Produire des contenus conformes aux exigences éthiques et réglementaires'
      ],
      color: 'from-orange-500 to-amber-600'
    },
    {
      id: 'introduction-ia-pme',
      title: 'Introduction aux IA pour les PME',
      subtitle: 'Exploiter le potentiel des IA',
      description: 'Formation pratique pour découvrir comment intégrer l\'IA dans votre workflow d\'entreprise et créer vos propres agents IA.',
      duration: '7h (1 jour)',
      participants: 'Collaborateurs et dirigeants',
      price: '595 €',
      level: 'Débutant',
      certifications: ['Financement OPCO'],
      objectives: [
        'Créer des agents IA GPT adaptés aux besoins métiers',
        'Maîtriser les stratégies IA avancées',
        'Introduire les IA dans le workflow de l\'entreprise',
        'Automatiser des tâches répétitives'
      ],
      color: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'automatisation-process-pme',
      title: 'Automatisation des process des PME',
      subtitle: 'Intégration des agents IA dans le workflow',
      description: 'Formation avancée pour automatiser vos processus métier avec des agents IA spécialisés et des stratégies d\'implémentation concrètes.',
      duration: '14h (2 jours)',
      participants: 'Professionnels avec connaissance IA',
      price: '1 190 €',
      level: 'Intermédiaire',
      certifications: ['Financement OPCO'],
      objectives: [
        'Créer des agents IA spécialisés pour des tâches spécifiques',
        'Intégrer des agents IA dans le workflow d\'entreprise',
        'Maîtriser les techniques de prompting stratégique',
        'Optimiser les processus métier avec l\'IA'
      ],
      color: 'from-blue-500 to-cyan-600'
    },
    {
      id: 'ia-relation-client',
      title: 'L\'IA pour optimiser la relation client',
      subtitle: 'Personnalisation et engagement client',
      description: 'Découvrez comment l\'IA peut transformer vos interactions clients, améliorer l\'engagement et automatiser le support.',
      duration: '7h (1 jour)',
      participants: 'Professionnels relation client',
      price: '595 €',
      level: 'Intermédiaire',
      certifications: ['Financement OPCO'],
      objectives: [
        'Identifier les apports de l\'IA à la relation client',
        'Maîtriser les outils d\'IA pour la personnalisation et fidélisation',
        'Développer le selfcare avec des chatbots intelligents',
        'Définir une stratégie d\'automatisation'
      ],
      color: 'from-purple-500 to-pink-600'
    },
    {
      id: 'ia-marketing-communication',
      title: 'L\'IA pour optimiser le marketing et la communication',
      subtitle: 'Communication augmentée par l\'IA',
      description: 'Formation complète pour intégrer l\'IA dans toutes vos activités de communication et marketing, de la stratégie aux réseaux sociaux.',
      duration: '14h (2 jours)',
      participants: 'Responsables communication',
      price: '1 190 €',
      level: 'Avancé',
      certifications: ['Financement OPCO'],
      objectives: [
        'Identifier les applications de l\'IA en communication',
        'Rédiger des prompts efficaces pour générer des contenus',
        'Optimiser la stratégie de contenus avec l\'IA',
        'Gérer les relations médias et la communication de crise'
      ],
      color: 'from-orange-500 to-amber-600'
    },
    {
      id: 'ia-prospection-commerciale',
      title: 'L\'IA pour optimiser la prospection commerciale',
      subtitle: 'Booster votre performance commerciale',
      description: 'Apprenez à qualifier vos leads, personnaliser vos messages et automatiser vos communications pour gagner en efficacité commerciale.',
      duration: '7h (1 jour)',
      participants: 'Commerciaux et managers',
      price: '595 €',
      level: 'Intermédiaire',
      certifications: ['Financement OPCO'],
      objectives: [
        'Identifier le potentiel de l\'IA pour la prospection',
        'Qualifier et scorer les leads automatiquement',
        'Personnaliser les messages pour améliorer l\'engagement',
        'Construire son plan d\'utilisation de l\'IA'
      ],
      color: 'from-emerald-500 to-teal-600'
    },
    {
      id: 'ia-ressources-humaines',
      title: 'L\'IA pour optimiser les ressources humaines',
      subtitle: 'Transformer la fonction RH avec l\'IA',
      description: 'Formation complète pour découvrir comment l\'IA peut révolutionner le recrutement, la gestion des talents et l\'engagement des collaborateurs.',
      duration: '14h (2 jours)',
      participants: 'DRH et professionnels RH',
      price: '1 190 €',
      level: 'Intermédiaire',
      certifications: ['Financement OPCO'],
      objectives: [
        'Exploiter les données RH de manière stratégique',
        'Attirer, recruter et fidéliser avec l\'IA',
        'Automatiser les processus administratifs RH',
        'Renforcer l\'engagement et la QVT'
      ],
      color: 'from-blue-500 to-cyan-600'
    },
    {
      id: 'ia-manager',
      title: 'L\'IA au service du manager',
      subtitle: 'Management augmenté par l\'IA',
      description: 'Découvrez comment utiliser l\'IA pour améliorer le management d\'équipe, la prise de décision et l\'organisation du travail.',
      duration: '7h (1 jour)',
      participants: 'Managers d\'équipe',
      price: '595 €',
      level: 'Intermédiaire',
      certifications: ['Financement OPCO'],
      objectives: [
        'Identifier les bénéfices de l\'IA pour le management',
        'Utiliser des outils d\'IA pour la prise de décision',
        'Améliorer la productivité et l\'organisation des tâches',
        'Accompagner son équipe dans la transformation IA'
      ],
      color: 'from-purple-500 to-pink-600'
    },
    {
      id: 'marches-publics-btp-ia',
      title: 'Réponse aux Marchés Publics BTP : Dominez avec l\'IA',
      subtitle: 'Réduisez par 3 le temps de préparation de vos réponses',
      description: 'Formation intensive d\'une journée pour maîtriser la commande publique BTP et exploiter l\'IA pour rédiger des mémoires techniques percutants, auditer vos BPU et automatiser vos réponses.',
      duration: '7h (1 jour)',
      participants: 'TPE/PME du BTP',
      price: '590 € / jour',
      level: 'Intermédiaire',
      certifications: ['Financement OPCO', 'Intra-entreprise'],
      objectives: [
        'Décrypter un DCE et identifier les critères gagnants',
        'Rédiger un mémoire technique assisté par IA 5x plus vite',
        'Créer un chatbot expert DCE pour interroger les specs instantanément',
        'Auditer la cohérence des BPU avec l\'IA'
      ],
      color: 'from-amber-600 to-orange-700'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl mb-6">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">Nos formations</h1>
            <p className="text-xl text-slate-300">
              Découvrez notre catalogue de formations certifiées pour développer vos compétences dans l'IA et le digital
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-white via-slate-50/50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8 mb-12">
            <div className="bg-white border-2 border-slate-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <div className="font-bold text-slate-900 mb-1">Formation certifiante</div>
              <div className="text-sm text-slate-600">RS 7667 éligible CPF</div>
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="font-bold text-slate-900 mb-1">Groupes restreints</div>
              <div className="text-sm text-slate-600">Pour un apprentissage optimal</div>
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div className="font-bold text-slate-900 mb-1">Résultats garantis</div>
              <div className="text-sm text-slate-600">95% de taux de satisfaction</div>
            </div>
          </div>

          <div className="space-y-8">
            {formations.map((formation, index) => {
              const formationImages = [
                'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&h=400&fit=crop&q=80',
                'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=400&fit=crop&q=80'
              ];

              return (
              <div key={formation.id} className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden hover:shadow-2xl transition-shadow">
                <div className={`h-2 bg-gradient-to-r ${formation.color}`}></div>

                <div className="relative h-64 overflow-hidden">
                  <img
                    src={formationImages[index % formationImages.length]}
                    alt={formation.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent"></div>
                </div>

                <div className="p-8 sm:p-10">
                  <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {formation.certifications.length > 0 && formation.certifications.map((cert) => (
                          <span
                            key={cert}
                            className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-semibold"
                          >
                            {cert}
                          </span>
                        ))}
                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-semibold">
                          {formation.level}
                        </span>
                      </div>

                      <h2 className="text-3xl font-bold text-slate-900 mb-2">{formation.title}</h2>
                      <p className="text-lg text-orange-600 font-semibold mb-4">{formation.subtitle}</p>
                      <p className="text-slate-600 mb-6 leading-relaxed">{formation.description}</p>

                      <div className="bg-slate-50 rounded-xl p-6 mb-6">
                        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-orange-600" />
                          Objectifs de la formation
                        </h3>
                        <ul className="space-y-3">
                          {formation.objectives.map((objective, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <span className="text-slate-700">{objective}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Link
                        to={`/formations/${formation.id}`}
                        className="inline-block bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
                      >
                        Découvrir la formation
                      </Link>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-slate-50 to-orange-50 rounded-xl p-6 border border-slate-200">
                        <div className="text-center mb-6">
                          <div className="text-4xl font-bold text-slate-900 mb-1">{formation.price}</div>
                          <div className="text-sm text-slate-600">Par participant</div>
                        </div>

                        <div className="space-y-4 mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                              <Clock className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <div className="text-sm text-slate-600">Durée</div>
                              <div className="font-semibold text-slate-900">{formation.duration}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                              <Users className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <div className="text-sm text-slate-600">Participants</div>
                              <div className="font-semibold text-slate-900">{formation.participants}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                              <Euro className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <div className="text-sm text-slate-600">Financement</div>
                              <div className="font-semibold text-slate-900">
                                {formation.certifications.includes('CPF') ? 'CPF disponible' : 'OPCO / AGEFICE'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <Link
                          to="/formulaire"
                          className="block w-full text-center bg-white hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-lg font-bold transition-all border-2 border-slate-200 hover:border-orange-300"
                        >
                          Demander un devis
                        </Link>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <Award className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-emerald-800">
                            <strong>Formation certifiée :</strong> Attestation de formation remise en fin de parcours
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>

          <div className="mt-16 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 sm:p-10 border border-orange-200">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Vous ne trouvez pas la formation qui vous convient ?
              </h2>
              <p className="text-slate-600 mb-6">
                Nous pouvons créer des formations sur mesure adaptées à vos besoins spécifiques
              </p>
              <Link
                to="/formulaire"
                className="inline-block bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 shadow-lg"
              >
                Contactez-nous
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

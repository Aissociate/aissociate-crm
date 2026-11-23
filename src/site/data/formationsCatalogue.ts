// Fiches détaillées des formations du site (contenu éditorial figé). La page
// `FormationDetailPage` les enrichit avec les valeurs à jour du CRM quand la formation y existe.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const formationsData: Record<string, any> = {
  'creation-contenus-ia': {
    id: 'creation-contenus-ia',
    ref: 'INTROIA1',
    rs: 'RS 6776',
    title: 'Création de contenus rédactionnels et visuels par l\'usage responsable de l\'intelligence artificielle générative',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=600&fit=crop&q=80',
    // Parcours de 21h : le présentiel varie selon le format (collectif 2 j. /
    // individuel 1 j.), le e-learning complète jusqu'à 21h. `durationLabel`
    // prime sur la durée heures→jours calculée depuis le CRM (21h ≠ 3 jours ici).
    duration: '21h (présentiel + e-learning)',
    durationLabel: '21h (présentiel + e-learning)',
    price: '1 489 €',
    priceNote: 'Format collectif — individuel : 1 650 €',
    priceInter: '1 489 €',
    priceIntra: '1 650 €',
    participants: 'Grand public',
    level: 'Débutant',
    format: 'Présentiel à La Réunion ou classe à distance + e-learning',
    isCertifying: true,
    isEligibleCPF: true,
    formats: [
      {
        name: 'Format collectif',
        price: '1 489 €',
        duration: '2 jours en présentiel (14h) + 7h de e-learning',
        details: [
          'Session en groupe restreint, en présentiel à La Réunion ou en classe à distance',
          'Plateforme e-learning accessible avant et après le présentiel',
          '21h de parcours au total, passage de la certification RS 6776 inclus',
        ],
        cpfUrl: 'https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-distaciel/93454251500010_1489_stemarie',
      },
      {
        name: 'Format individuel',
        price: '1 650 €',
        duration: '1 journée en présentiel (7h) + 14h de e-learning',
        details: [
          'Accompagnement individuel : rythme et cas d\'usage adaptés à votre métier',
          'Plateforme e-learning accessible avant et après la journée en présentiel',
          '21h de parcours au total, passage de la certification RS 6776 inclus',
        ],
        cpfUrl: 'https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche/93454251500010_RS6776-collectif/93454251500010_1800lareunion',
      },
    ],
    prerequisites: 'Maîtrise de base de l\'outil informatique et navigation internet',
    objectives: [
      'Analyser ses besoins professionnels en matière d\'IA générative',
      'Utiliser des outils d\'IA générative pour créer des contenus rédactionnels et visuels',
      'Appliquer les principes de confidentialité et de protection des données',
      'Produire des contenus conformes aux exigences éthiques et réglementaires',
      'Intégrer l\'IA générative de manière responsable dans ses pratiques professionnelles'
    ],
    program: [
      {
        title: 'Module 1 : Mise en œuvre de la stratégie d\'implémentation de l\'IA générative',
        content: [
          'Analyse du contexte et identification des besoins',
          'Configuration des outils d\'IA Générative',
          'Élaboration d\'un plan d\'actions pour l\'implémentation',
          'Étude de cas | Mise en pratique',
          'QCM couvrant les points vus en module 1'
        ]
      },
      {
        title: 'Module 2 : La création de contenus rédactionnels et visuels',
        content: [
          'Les techniques de Prompt Engineering',
          'Créer des contenus rédactionnels et visuels avec l\'IA Générative',
          'Garantir la confidentialité des données professionnelles',
          'La création de contenus inclusifs & accessibles',
          'Les techniques d\'optimisation des contenus',
          'Étude de cas | Mise en pratique',
          'QCM couvrant les points vus en module 2'
        ]
      },
      {
        title: 'Module 3 : La conformité éthique et règlementaire',
        content: [
          'Le cadre règlementaire Européen : les directives de l\'IA Act',
          'La protection des données personnelles : RGPD',
          'La mise en place d\'une veille règlementaire',
          'Étude de cas | Mise en pratique',
          'QCM couvrant les points vus en module 3'
        ]
      }
    ],
    strengths: [
      'Formation pratique et outillée de nombreux exemples inspirants',
      'Ateliers pratiques pour s\'initier concrètement aux usages des IA',
      'Maitrise suffisante pour résoudre des problèmes simples',
      'Actualisation régulière des cas d\'usage et solutions',
      'Formation certifiante éligible au financement CPF'
    ]
  },
  'introduction-ia-pme': {
    id: 'introduction-ia-pme',
    ref: 'INTROIA2',
    title: 'Introduction aux IA pour les PME - Exploiter le potentiel des IA',
    image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=600&fit=crop&q=80',
    duration: '7h',
    price: '595€',
    priceInter: '595€',
    priceIntra: '495€',
    participants: 'Tous collaborateurs et métiers de l\'entreprise (dirigeants et cadres)',
    level: 'Débutant',
    format: 'Présentiel ou en classe à distance',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: 'Connaissance basique des outils d\'IA',
    objectives: [
      'Création d\'Agents IA GPT',
      'Stratégies IA avancées',
      'Introduire les IA dans le workflow de l\'entreprise'
    ],
    program: [
      {
        title: 'Création et Gestion d\'Agents Multi-IA',
        content: [
          'Introduction aux Agents IA pour répondre aux besoins métiers du marketing, finance, RH, comptabilité, administratif, service client'
        ]
      },
      {
        title: 'Stratégies Avancées d\'instructions aux IA',
        content: [
          'Apprentissage des fondamentaux concernant les instructions IA avancées',
          'Obtenir des résultats plus approfondis et analytiques'
        ]
      },
      {
        title: 'Atelier : Résolution de Tâches Automatisables',
        content: [
          'Application pratique des compétences acquises',
          'Automatiser des tâches identifiées',
          'Travail en groupe pour résoudre des cas réels',
          'Optimisation des workflows'
        ]
      }
    ],
    strengths: [
      'Formation pratique orientée vers l\'amélioration de votre productivité',
      'Cas d\'usages concrets pour implémenter l\'IA dans votre business',
      'Actualisation régulière des cas d\'usage et solutions'
    ]
  },
  'automatisation-process-pme': {
    id: 'automatisation-process-pme',
    ref: 'INTROIA3',
    title: 'Automatisation des process des PME et intégration des Agents IA dans le workflow',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=600&fit=crop&q=80',
    duration: '14h',
    price: '1 190€',
    priceInter: '1 190€',
    priceIntra: '1 090€',
    participants: 'Professionnels avec bonne compréhension des concepts d\'IA',
    level: 'Intermédiaire',
    format: 'Présentiel ou en classe à distance',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: 'Audit et Analyse des Processus, maitrise avancée des IA',
    objectives: [
      'Création d\'agents IA spécialiste',
      'Intégration d\'agents IA dans le workflow',
      'Stratégies avancées'
    ],
    program: [
      {
        title: 'Création d\'Agents IA Avancés',
        content: [
          'Développement d\'agents spécialisés pour des tâches spécifiques',
          'Techniques de déploiement multi-agents',
          'Maîtrise de la configuration d\'agents adaptés aux workflows interconnectés'
        ]
      },
      {
        title: 'Techniques de Prompting Stratégique',
        content: [
          'Personnalisation avancée des prompts selon les besoins',
          'Structuration d\'interactions en plusieurs étapes',
          'Créer des prompts avancés et optimiser les interactions'
        ]
      },
      {
        title: 'Atelier : Intégration et Optimisation des Agents',
        content: [
          'Automatisation de tâches métier spécifiques',
          'Travail collaboratif en groupes',
          'Analyse des résultats et ajustement des workflows',
          'Configuration d\'un système multi-agents'
        ]
      }
    ],
    strengths: [
      'Formation avancée qui intègre vos process internes',
      'Cas d\'usages concrets d\'automatisation complexe',
      'Actualisation régulière des cas d\'usage et solutions'
    ]
  },
  'marches-publics-btp': {
    id: 'marches-publics-btp',
    ref: 'MPBTP1',
    title: 'Réponse aux Marchés Publics BTP : Dominez avec l\'IA',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&h=600&fit=crop&q=80',
    duration: '7h (1 journée)',
    price: '590€ / jour',
    priceInter: '590€',
    priceIntra: '590€ / jour',
    participants: 'Responsables d\'études, Chargés d\'affaires BTP, Assistants administratifs de TPE/PME du BTP',
    level: 'Intermédiaire',
    format: 'Intra-entreprise (présentiel ou classe à distance)',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: 'Connaissance de base des dossiers de chantier',
    objectives: [
      'Comprendre le découpage des lots et les critères de notation des collectivités',
      'Décrypter un DCE et identifier les critères éliminatoires et opportunités cachées',
      'Rédiger un mémoire technique assisté par l\'IA en divisant le temps de préparation par 3',
      'Utiliser un chatbot expert pour interroger les specs techniques instantanément',
      'Auditer la cohérence d\'un BPU avec l\'IA et éviter les anomalies de calcul',
      'Débugger une réponse pour identifier les erreurs de conformité avant le dépôt'
    ],
    program: [
      {
        title: 'Module 1 : Le cadre législatif et économique (1h)',
        content: [
          'Comprendre le découpage des lots et la notation des collectivités',
          'Le "pourquoi" avant le "comment" : analyse de la commande publique BTP',
          'Critères de notation : valeur technique vs prix'
        ]
      },
      {
        title: 'Module 2 : Décryptage du DCE (1h30)',
        content: [
          'Dossier de Consultation des Entreprises : identification des critères éliminatoires',
          'Repérer les opportunités cachées dans les documents obligatoires',
          'Les "pièges" techniques du Mémoire technique'
        ]
      },
      {
        title: 'Module 3 : La méthodologie gagnante + Etude de cas (1h30)',
        content: [
          'Pourquoi les entreprises perdent leurs marchés pour des erreurs de détail',
          'Analyse comparative d\'un AAPC réel (Critères techniques vs Prix)',
          'Atelier en groupe : décortiquer un avis d\'appel public à la concurrence'
        ]
      },
      {
        title: 'Module 4 : Rédaction Assistée du Mémoire Technique par l\'IA (1h)',
        content: [
          'Utiliser l\'IA pour structurer une réponse sur-mesure (Planning, moyens humains, sécurité)',
          'Transformer vos retours d\'expérience passés en "prompts de référence"',
          'Générer des mémoires techniques 5x plus vite grâce à l\'IA'
        ]
      },
      {
        title: 'Module 5 : La suite logicielle "Expert BTP" (1h30)',
        content: [
          'Chatbot Expert : Création d\'un assistant "Spécialiste DCE" pour interroger les specs techniques instantanément',
          'BPU (Bordereau des Prix Unitaires) : Utilisation de l\'IA pour auditer la cohérence des prix et éviter les anomalies de calcul',
          'Gestion des bugs : Débugger une réponse et identifier les erreurs de conformité réglementaire avant le dépôt'
        ]
      },
      {
        title: 'Module 6 : Validation Qualiopi - Atelier + QCM (30 min)',
        content: [
          'Atelier "Crash Test" : exercice final sur un document réel',
          'QCM d\'évaluation des acquis : vérification de la mémorisation des réflexes de conformité',
          'Vérification de l\'usage des outils IA dans un contexte marchés publics'
        ]
      }
    ],
    strengths: [
      'Programme dense et immédiatement productif pour le BTP',
      'Réduction par 3 du temps de préparation de réponse',
      'Outils IA concrets : chatbot expert, BPU automatisé, mémoire technique assisté',
      'Méthode : 30% théorie, 70% mise en pratique réelle',
      'Suivi Qualiopi : questionnaire de satisfaction J+0 et transfert de compétences J+30'
    ]
  },
  'marches-publics-btp-ia': {
    id: 'marches-publics-btp-ia',
    ref: 'MPBTP1',
    title: 'Réponse aux Marchés Publics BTP : Dominez avec l\'IA',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&h=600&fit=crop&q=80',
    duration: '7h (1 journée)',
    price: '590€ / jour',
    priceIntra: '590€ / jour',
    participants: 'Responsables d\'études, Chargés d\'affaires BTP, Assistants administratifs de TPE/PME du BTP',
    level: 'Intermédiaire',
    format: 'Intra-entreprise (présentiel)',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: 'Connaissance de base des dossiers de chantier',
    objectives: [
      'Réduire le temps de préparation de réponse par 3 tout en augmentant la pertinence technique des offres',
      'Décrypter un DCE et identifier les critères éliminatoires et opportunités cachées',
      'Rédiger un mémoire technique assisté par IA en un temps record',
      'Créer un chatbot expert DCE pour interroger les spécifications techniques instantanément',
      'Auditer la cohérence des BPU (Bordereau des Prix Unitaires) avec l\'IA',
      'Débugger une réponse avant dépôt pour éliminer les erreurs de conformité'
    ],
    program: [
      {
        title: 'MATINEE - Module 1 : Le cadre législatif et économique (1h)',
        content: [
          'Comprendre le découpage des lots et la notation des collectivités',
          'Le "pourquoi" avant le "comment" : cadre réglementaire de la commande publique BTP',
          'Analyse des critères de notation (valeur technique vs prix)'
        ]
      },
      {
        title: 'MATINEE - Module 2 : Décryptage du DCE (1h30)',
        content: [
          'Identification des critères éliminatoires et des opportunités cachées',
          'Les documents obligatoires : Mémoire technique, DPGF, BPU',
          'Les "pièges" techniques dans les dossiers de consultation'
        ]
      },
      {
        title: 'MATINEE - La méthodologie gagnante (45min)',
        content: [
          'Pourquoi les entreprises BTP perdent leurs marchés pour des erreurs de détail',
          'Les erreurs les plus fréquentes dans les réponses',
          'Construire une réponse structurée et percutante'
        ]
      },
      {
        title: 'MATINEE - Etude de cas (45min)',
        content: [
          'Analyse comparative d\'un AAPC réel (Avis d\'Appel Public à la Concurrence)',
          'Décryptage en groupe des critères techniques vs prix',
          'Identification des leviers de différenciation'
        ]
      },
      {
        title: 'APRES-MIDI - Module 3 : Rédaction assistée du Mémoire Technique par IA (1h)',
        content: [
          'Utiliser l\'IA pour structurer une réponse sur-mesure (Planning, moyens humains, sécurité)',
          'Transformer vos retours d\'expérience passés en "prompts de référence"',
          'Générer des mémoires techniques 5x plus vite avec l\'IA',
          'Personnaliser et affiner les réponses générées'
        ]
      },
      {
        title: 'APRES-MIDI - Module 4 : La suite logicielle "Expert BTP" (1h30)',
        content: [
          'Chatbot Expert : Création d\'un assistant "Spécialiste DCE" pour interroger les specs techniques instantanément',
          'BPU (Bordereau des Prix Unitaires) : Utilisation de l\'IA pour auditer la cohérence des prix et éviter les anomalies de calcul',
          'Gestion des bugs : Débugger une réponse et identifier les erreurs de conformité réglementaire avant le dépôt'
        ]
      },
      {
        title: 'APRES-MIDI - Module 5 : Validation Qualiopi (30min)',
        content: [
          'Atelier "Crash Test" : Exercice final sur un document réel de marché public BTP',
          'Evaluation des acquis (QCM) : Vérification de la mémorisation des réflexes de conformité et de l\'usage des outils IA',
          'Questionnaire de satisfaction à chaud (J+0)',
          'Présentation du questionnaire de transfert de compétences (J+30)'
        ]
      }
    ],
    strengths: [
      'Formation 100% orientée BTP avec des cas réels de marchés publics',
      'Approche hybride : stratégie + outils IA opérationnels immédiatement',
      'Réduction mesurable du temps de réponse aux appels d\'offres',
      'Création d\'outils IA réutilisables après la formation (chatbot, prompts)',
      'Format intra-entreprise pour un accompagnement personnalisé',
      'Conformité Qualiopi : QCM d\'évaluation + suivi à J+30'
    ]
  },
  'ia-relation-client': {
    id: 'ia-relation-client',
    ref: 'IAREL1',
    title: "L'IA pour optimiser la relation client",
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=600&fit=crop&q=80',
    duration: '7h (1 jour)',
    price: '595 €',
    priceInter: '595 €',
    priceIntra: 'Sur devis',
    participants: 'Professionnels de la relation client',
    level: 'Intermédiaire',
    format: 'Présentiel ou en classe à distance',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: "Maîtrise de base de l'outil informatique. Aucune compétence technique en IA requise.",
    objectives: [
      "Identifier les apports de l'IA à la relation client",
      "Maîtriser les outils d'IA pour la personnalisation et la fidélisation",
      'Développer le selfcare avec des chatbots intelligents',
      "Définir une stratégie d'automatisation de la relation client"
    ],
    program: [
      { title: "Module 1 : L'IA au service de l'expérience client", content: [
        "Panorama des usages de l'IA en relation client",
        'Personnalisation et recommandation à grande échelle',
        'Analyse des sentiments et des verbatims clients',
        'Étude de cas | Mise en pratique'
      ] },
      { title: 'Module 2 : Automatisation et selfcare', content: [
        "Concevoir un chatbot / assistant intelligent",
        'Automatiser les réponses et le routage des demandes',
        "Définir une stratégie d'automatisation et mesurer le ROI",
        "Atelier : votre plan d'action relation client augmentée"
      ] }
    ],
    strengths: [
      'Cas pratiques directement applicables à votre activité',
      'Outils IA opérationnels dès la fin de la formation',
      'Formation finançable OPCO / AGEFICE',
      'Formateur expert IA & relation client'
    ]
  },
  'ia-marketing-communication': {
    id: 'ia-marketing-communication',
    ref: 'IAMKT1',
    title: "L'IA pour optimiser le marketing et la communication",
    image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=600&fit=crop&q=80',
    duration: '14h (2 jours)',
    price: '1 190 €',
    priceInter: '1 190 €',
    priceIntra: 'Sur devis',
    participants: 'Responsables marketing et communication',
    level: 'Avancé',
    format: 'Présentiel ou en classe à distance',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: "Pratique régulière des outils de communication / marketing. Notions de base en IA appréciées.",
    objectives: [
      "Identifier les applications de l'IA en communication",
      'Rédiger des prompts efficaces pour générer des contenus',
      "Optimiser la stratégie de contenus avec l'IA",
      'Gérer les relations médias et la communication de crise'
    ],
    program: [
      { title: "Module 1 : Production de contenus assistée par l'IA", content: [
        'Techniques de prompt engineering pour le marketing',
        'Génération de contenus rédactionnels et visuels',
        'Calendrier éditorial et déclinaison multicanale',
        'Étude de cas | Mise en pratique'
      ] },
      { title: 'Module 2 : Stratégie, médias et pilotage', content: [
        "Optimiser sa stratégie de contenus avec l'IA",
        'Relations médias et e-réputation augmentées',
        'Gérer une communication de crise avec l\'IA',
        'Mesurer la performance et itérer'
      ] }
    ],
    strengths: [
      'Ateliers concrets sur vos propres campagnes',
      'Bibliothèque de prompts marketing réutilisables',
      'Formation finançable OPCO / AGEFICE',
      'Formateur expert IA & communication'
    ]
  },
  'ia-prospection-commerciale': {
    id: 'ia-prospection-commerciale',
    ref: 'IAPROSP1',
    title: "L'IA pour optimiser la prospection commerciale",
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=600&fit=crop&q=80',
    duration: '7h (1 jour)',
    price: '595 €',
    priceInter: '595 €',
    priceIntra: 'Sur devis',
    participants: 'Commerciaux et managers commerciaux',
    level: 'Intermédiaire',
    format: 'Présentiel ou en classe à distance',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: "Pratique de la prospection commerciale. Aucune compétence technique en IA requise.",
    objectives: [
      "Identifier le potentiel de l'IA pour la prospection",
      'Qualifier et scorer les leads automatiquement',
      "Personnaliser les messages pour améliorer l'engagement",
      "Construire son plan d'utilisation de l'IA"
    ],
    program: [
      { title: 'Module 1 : Cibler et qualifier avec l\'IA', content: [
        "Identifier les cas d'usage de l'IA en prospection",
        'Qualification et scoring automatique des leads',
        'Enrichissement et priorisation des prospects',
        'Étude de cas | Mise en pratique'
      ] },
      { title: 'Module 2 : Engager et convertir', content: [
        'Personnalisation des messages à grande échelle',
        'Séquences de prospection automatisées',
        "Construire son plan d'action IA prospection",
        'Atelier pratique sur vos cibles réelles'
      ] }
    ],
    strengths: [
      'Méthode directement applicable à votre pipeline',
      'Outils et prompts de prospection prêts à l\'emploi',
      'Formation finançable OPCO / AGEFICE',
      'Formateur expert IA & développement commercial'
    ]
  },
  'ia-ressources-humaines': {
    id: 'ia-ressources-humaines',
    ref: 'IARH1',
    title: "L'IA pour optimiser les ressources humaines",
    image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=600&fit=crop&q=80',
    duration: '14h (2 jours)',
    price: '1 190 €',
    priceInter: '1 190 €',
    priceIntra: 'Sur devis',
    participants: 'DRH et professionnels RH',
    level: 'Intermédiaire',
    format: 'Présentiel ou en classe à distance',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: "Exercer une fonction RH. Aucune compétence technique en IA requise.",
    objectives: [
      'Exploiter les données RH de manière stratégique',
      "Attirer, recruter et fidéliser avec l'IA",
      'Automatiser les processus administratifs RH',
      "Renforcer l'engagement et la QVT"
    ],
    program: [
      { title: 'Module 1 : Recrutement et talents augmentés', content: [
        "Sourcing et présélection assistés par l'IA",
        'Rédaction d\'offres et de fiches de poste',
        'Analyse des données RH (people analytics)',
        'Étude de cas | Mise en pratique'
      ] },
      { title: 'Module 2 : Automatisation RH et engagement', content: [
        'Automatiser les tâches administratives RH',
        "Onboarding et formation augmentés par l'IA",
        'Mesurer et renforcer l\'engagement / la QVT',
        'Cadre éthique et RGPD des données RH'
      ] }
    ],
    strengths: [
      'Cas pratiques sur l\'ensemble du cycle RH',
      'Conformité RGPD et usage éthique des données',
      'Formation finançable OPCO / AGEFICE',
      'Formateur expert IA & ressources humaines'
    ]
  },
  'ia-manager': {
    id: 'ia-manager',
    ref: 'IAMNG1',
    title: "L'IA au service du manager",
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=600&fit=crop&q=80',
    duration: '7h (1 jour)',
    price: '595 €',
    priceInter: '595 €',
    priceIntra: 'Sur devis',
    participants: "Managers et responsables d'équipe",
    level: 'Intermédiaire',
    format: 'Présentiel ou en classe à distance',
    isCertifying: false,
    isEligibleCPF: false,
    isEligibleOPCO: true,
    prerequisites: "Exercer une fonction d'encadrement. Aucune compétence technique en IA requise.",
    objectives: [
      "Identifier les bénéfices de l'IA pour le management",
      "Utiliser des outils d'IA pour la prise de décision",
      "Améliorer la productivité et l'organisation des tâches",
      'Accompagner son équipe dans la transformation IA'
    ],
    program: [
      { title: "Module 1 : Manager avec l'appui de l'IA", content: [
        "Cas d'usage de l'IA pour le management d'équipe",
        "Aide à la décision et synthèse d'informations",
        'Organisation, priorisation et reporting augmentés',
        'Étude de cas | Mise en pratique'
      ] },
      { title: "Module 2 : Conduire la transformation IA de l'équipe", content: [
        "Acculturer et embarquer son équipe sur l'IA",
        'Définir des règles d\'usage responsables',
        "Construire un plan d'intégration de l'IA",
        'Atelier : votre feuille de route managériale'
      ] }
    ],
    strengths: [
      'Outils concrets pour le quotidien du manager',
      'Approche conduite du changement',
      'Formation finançable OPCO / AGEFICE',
      'Formateur expert IA & management'
    ]
  }
};

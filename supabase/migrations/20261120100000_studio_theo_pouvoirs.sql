/*
  Studio IA — Théo : deux super-pouvoirs de plus.
  - note_frais : enregistre une dépense dans la note de frais du mois (ressource
    « Notes de frais — AAAA-MM », dossier Comptabilité/Notes de frais).
  - point_hebdo : point comptable de la semaine, enregistré en note. La version
    automatique est le modèle de tâche « Point comptable hebdomadaire » (taches.ts).
  Rejouable : chaque pouvoir n'est ajouté que s'il manque.
*/

update public.studio_agents set super_pouvoirs = super_pouvoirs || $j$[
 {"id":"note_frais","titre":"Enregistrer une note de frais","description":"La dépense calculée, classée et ajoutée à la note du mois.",
  "champs":[{"nom":"date","label":"Date de la dépense (JJ/MM/AAAA)","type":"texte","requis":true},
            {"nom":"categorie","label":"Catégorie","type":"choix","options":["Repas","Carburant","Péage et parking","Transport (avion, train, taxi)","Hébergement","Fournitures et petit matériel","Téléphone et internet","Autre"],"requis":true},
            {"nom":"montant","label":"Montant TTC payé","type":"texte","requis":true},
            {"nom":"tva","label":"TVA sur le justificatif","type":"choix","options":["8,5 % (La Réunion, taux normal)","2,1 % (La Réunion, taux réduit)","20 % (métropole)","10 % (métropole, restauration)","Pas de TVA / je ne sais pas"],"requis":true},
            {"nom":"motif","label":"Motif professionnel (qui, pourquoi, où)","type":"long","requis":true},
            {"nom":"payeur","label":"Avancée par (salarié ou dirigeant)","type":"texte","requis":true},
            {"nom":"paiement","label":"Moyen de paiement","type":"choix","options":["Carte personnelle","Espèces","Carte de l'entreprise"],"requis":true}]
  ,"gabarit":"Enregistre cette dépense en note de frais.\nDate : {{date}}\nCatégorie : {{categorie}}\nMontant TTC : {{montant}}\nTVA : {{tva}}\nMotif : {{motif}}\nAvancée par : {{payeur}}\nPaiement : {{paiement}}\nSi une photo ou un PDF du justificatif est joint, vérifie que date, montant et TVA concordent et signale tout écart.\n1. Calcule HT, TVA et TTC (détail du calcul). TVA récupérable seulement avec une facture ou un ticket qui la fait apparaître et une dépense engagée pour l'entreprise ; non récupérable sur l'hébergement du dirigeant et du personnel ; carburant : récupération partielle ou totale selon le véhicule et le carburant. Précise ta réserve et renvoie les cas douteux à l'expert-comptable.\n2. Propose le compte du plan comptable général (ex. 6256 missions et réceptions, 6251 voyages et déplacements, 6064 fournitures administratives, 606 achats non stockés, 626 frais postaux et télécommunications).\n3. Note de frais du mois de la dépense : titre exact « Notes de frais — AAAA-MM ». Si cette ressource figure dans l'index, lis-la d'abord avec ressource_lire ; puis enregistre avec note_enregistrer, dossier « Comptabilité/Notes de frais », le tableau complet (lignes existantes + la nouvelle) : date, salarié, catégorie, motif, HT, TVA, TTC, compte, moyen de paiement, justificatif (oui/non), puis les totaux par salarié et le total à rembourser (hors carte de l'entreprise). Ne supprime jamais une ligne existante.\n4. Termine par un récapitulatif de 3 lignes et, s'il manque le justificatif, rappelle qu'il faut le conserver (photo jointe ici ou original)."},
 {"id":"point_hebdo","titre":"Point comptable de la semaine","description":"Dépenses, factures, relances et échéances en une page.",
  "champs":[{"nom":"periode","label":"Semaine concernée","type":"choix","options":["Semaine écoulée","Semaine en cours"],"requis":true},
            {"nom":"complements","label":"Éléments à ajouter (factures émises ou reçues, encaissements, solde bancaire…)","type":"long"}]
  ,"gabarit":"Fais le point comptable de la {{periode}}.\nÉléments donnés : {{complements}}\nAppuie-toi sur ce que tu peux consulter : les notes « Notes de frais — AAAA-MM » et le dernier « Point comptable » (ressource_lire), la messagerie si elle est connectée (mail_rechercher : factures reçues ou envoyées, relances, avis d'échéance, URSSAF, impôts), l'agenda. N'invente aucun montant : écris « à compléter » quand une donnée manque.\nRédige le point avec ces parties : 1) Dépenses et notes de frais de la semaine (total, justificatifs manquants) ; 2) Factures émises et encaissements, factures en retard à relancer ; 3) Factures fournisseurs reçues et à payer ; 4) Échéances des 30 prochains jours (TVA, URSSAF, impôts, loyers, emprunts) ; 5) Trésorerie : solde connu et point d'attention ; 6) 3 actions prioritaires pour la semaine, et ce qu'il faut transmettre à l'expert-comptable.\nEnregistre le point avec note_enregistrer, titre « Point comptable — semaine du JJ/MM/AAAA » (lundi de la semaine), dossier « Comptabilité/Points hebdomadaires ». Pour chaque relance utile, prépare un e-mail avec mail_proposer_envoi si la messagerie est connectée (il attendra la validation). Rappelle en une ligne que ce point peut tourner seul chaque lundi via Tâches planifiées › Point comptable hebdomadaire."}
]$j$::jsonb
where id = 'theo' and not super_pouvoirs @> '[{"id":"note_frais"}]'::jsonb;

notify pgrst, 'reload schema';

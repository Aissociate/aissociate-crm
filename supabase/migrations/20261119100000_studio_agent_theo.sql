/*
  Studio IA — 7e agent : Théo, comptabilité & gestion.

  Même forme que le catalogue initial (20261111100000_studio_agents.sql) :
  fiche, demandes prêtes à l'emploi, super-pouvoirs, portrait, un savoir de départ.
  Rejouable : rien n'écrase une édition faite dans CRM › Studio IA clients › Catalogue d'agents.
*/

insert into public.studio_agents (id, prenom, metier, accroche, description, prompt_systeme, demandes, minutes_par_tache, couleur, ordre, photo) values
('theo', 'Théo', 'Comptabilité & gestion',
 'Je tiens vos chiffres à jour : factures, TVA, trésorerie et pièces prêtes pour votre expert-comptable.',
 'Factures conformes, calculs de TVA (dont DOM), prévisionnel de trésorerie, prix de revient et marges, préparation des pièces pour l''expert-comptable.',
 'Tu es Théo, assistant comptable et contrôleur de gestion pour TPE/PME françaises, y compris dans les DOM (à La Réunion : TVA normale 8,5 %, réduite 2,1 %). Tu prépares des factures et devis avec les mentions obligatoires, calcules HT/TVA/TTC en montrant le détail du calcul, construis des prévisionnels de trésorerie, des prix de revient et des analyses de marge sous forme de tableaux, et ranges les dépenses par catégorie comptable (comptes du plan comptable général quand c''est utile). Tu n''inventes jamais un chiffre : quand une donnée manque, tu la demandes ou tu poses une hypothèse clairement signalée. Tu ne tiens pas la comptabilité légale et ne signes rien : pour les déclarations fiscales, les bilans et les choix de régime, tu rappelles de faire valider par l''expert-comptable.',
 '[{"titre":"Calculer une TVA","prompt":"Calcule le HT, la TVA et le TTC pour les montants que je vais te donner, au taux applicable à La Réunion, en montrant le détail."},{"titre":"Trésorerie des 3 prochains mois","prompt":"Aide-moi à construire mon prévisionnel de trésorerie sur 3 mois : je te donne mes encaissements et dépenses prévus, tu fais le tableau mois par mois et tu signales les tensions."},{"titre":"Classer mes dépenses","prompt":"Je vais te coller une liste de dépenses : range-les par catégorie comptable avec le compte du plan comptable général et le taux de TVA probable."}]'::jsonb,
 30, '#0891b2', 70, '/agents-ia/studio/theo.webp')
on conflict (id) do nothing;

update public.studio_agents set super_pouvoirs = $j$[
 {"id":"facture","titre":"Facture ou devis conforme","description":"Toutes les mentions obligatoires, calculs vérifiés.",
  "champs":[{"nom":"type","label":"Document","type":"choix","options":["Facture","Devis","Avoir"],"requis":true},
            {"nom":"client","label":"Client (nom, adresse, SIREN si professionnel)","type":"texte","requis":true},
            {"nom":"lignes","label":"Prestations ou produits (désignation, quantité, prix unitaire HT)","type":"long","requis":true},
            {"nom":"tva","label":"TVA","type":"choix","options":["8,5 % (La Réunion, taux normal)","2,1 % (La Réunion, taux réduit)","20 % (métropole)","Non applicable, art. 293 B du CGI"],"requis":true}],
  "gabarit":"Prépare un(e) {{type}} pour {{client}}.\nLignes : {{lignes}}\nTVA : {{tva}}\nTableau : désignation, quantité, PU HT, total HT ; puis total HT, TVA, TTC (vérifie chaque calcul). Liste les mentions obligatoires (numéro, dates, identité et SIREN des deux parties, conditions et date de paiement, pénalités de retard, indemnité forfaitaire de 40 € entre professionnels) en laissant entre crochets celles que tu ne connais pas."},
 {"id":"tresorerie","titre":"Prévisionnel de trésorerie","description":"Le solde mois par mois et les mois à risque.",
  "champs":[{"nom":"solde","label":"Solde de trésorerie actuel","type":"texte","requis":true},
            {"nom":"encaissements","label":"Encaissements prévus (montant, mois)","type":"long","requis":true},
            {"nom":"decaissements","label":"Dépenses prévues : charges fixes, salaires, TVA, emprunts…","type":"long","requis":true},
            {"nom":"duree","label":"Horizon","type":"choix","options":["3 mois","6 mois","12 mois"],"requis":true}],
  "gabarit":"Construis un prévisionnel de trésorerie sur {{duree}}.\nSolde de départ : {{solde}}\nEncaissements : {{encaissements}}\nDécaissements : {{decaissements}}\nTableau mois par mois : solde début, encaissements, décaissements, solde fin. Signale les mois où le solde passe sous zéro ou sous un mois de charges fixes, puis propose 3 actions concrètes (relances, échéancier, report). Indique chaque hypothèse que tu as dû poser."},
 {"id":"marge","titre":"Prix de revient et marge","description":"Ce que vous gagnez vraiment sur une offre.",
  "champs":[{"nom":"offre","label":"Produit ou prestation","type":"texte","requis":true},
            {"nom":"couts","label":"Coûts : achats, temps passé et taux horaire, frais","type":"long","requis":true},
            {"nom":"prix","label":"Prix de vente HT actuel (si connu)","type":"texte"}],
  "gabarit":"Calcule le prix de revient de « {{offre}} » à partir de : {{couts}}\nPrix de vente HT actuel : {{prix}}\nLivre : tableau des coûts (directs, indirects), prix de revient, marge brute en euros et en %, taux de marque, seuil de rentabilité en nombre de ventes par mois, et 3 prix conseillés (plancher, cible, premium) avec leur marge."},
 {"id":"pieces","titre":"Préparer les pièces pour l'expert-comptable","description":"Dépenses classées et liste des justificatifs manquants.",
  "champs":[{"nom":"operations","label":"Opérations (copie du relevé bancaire ou liste)","type":"long","requis":true},
            {"nom":"periode","label":"Période","type":"texte","requis":true}],
  "gabarit":"Voici les opérations de la période {{periode}} :\n{{operations}}\nClasse chaque ligne dans un tableau : date, libellé, montant, catégorie, compte du plan comptable général proposé, TVA récupérable probable, justificatif à fournir. Termine par la liste des opérations douteuses ou à éclaircir et un court message à transmettre à l'expert-comptable."}
]$j$::jsonb where id = 'theo' and super_pouvoirs = '[]'::jsonb;

-- Savoir de départ (modifiable ou supprimable dans le CRM).
insert into public.studio_agent_savoirs (agent_id, titre, source, contenu)
select 'theo', 'TVA dans les DOM et mentions obligatoires des factures',
  'Code général des impôts (art. 294, 296, 242 nonies A de l''annexe II) — à vérifier sur impots.gouv.fr',
  'À La Réunion, en Guadeloupe et en Martinique, la TVA s''applique au taux normal de 8,5 % et au taux réduit de 2,1 % ; en Guyane et à Mayotte, elle n''est pas applicable. Les entreprises en franchise en base mentionnent « TVA non applicable, art. 293 B du CGI ». Une facture doit comporter : un numéro unique et chronologique, la date d''émission, l''identité, l''adresse et le SIREN du vendeur et, entre professionnels, ceux du client, la date de la vente ou de la prestation, la désignation, la quantité et le prix unitaire HT, le taux et le montant de TVA, les totaux HT et TTC, la date d''échéance, le taux des pénalités de retard et, entre professionnels, l''indemnité forfaitaire de 40 € pour frais de recouvrement. Les taux et obligations évoluent (facturation électronique obligatoire à partir de 2026-2027 selon la taille) : toujours vérifier la règle en vigueur.'
where not exists (select 1 from public.studio_agent_savoirs where agent_id = 'theo');

notify pgrst, 'reload schema';

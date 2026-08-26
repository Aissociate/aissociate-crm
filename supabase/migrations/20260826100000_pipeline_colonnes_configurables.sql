-- Colonnes du pipeline personnalisables.
-- L'étape d'une opportunité devient du texte libre : la liste des colonnes
-- (clé + libellé, ordonnée) vit dans parametres (cle 'pipeline') et s'édite
-- depuis la page Pipeline. Le trigger set_opp_cloture compare des littéraux
-- texte ('gagne'/'perdu') : il reste valide après conversion.
alter table opportunites alter column stage drop default;
alter table opportunites alter column stage type text using stage::text;
alter table opportunites alter column stage set default 'nouveau';
-- L'épinglage manuel doit accepter les colonnes personnalisées : la liste
-- blanche figée n'a plus de sens (la cohérence est garantie par l'UI).
alter table opportunites drop constraint if exists opportunites_colonne_manuelle_check;
drop type if exists opportunite_stage;

-- Config initiale : les 6 colonnes historiques. nouveau/gagne/perdu sont
-- marquées systeme (non supprimables : défaut des nouvelles opportunités,
-- clôture automatique, statistiques).
insert into parametres (cle, valeur) values ('pipeline', jsonb_build_object('colonnes', jsonb_build_array(
  jsonb_build_object('cle', 'nouveau',     'libelle', 'Nouveau',     'systeme', true),
  jsonb_build_object('cle', 'qualifie',    'libelle', 'Qualifié',    'systeme', false),
  jsonb_build_object('cle', 'proposition', 'libelle', 'Proposition', 'systeme', false),
  jsonb_build_object('cle', 'negociation', 'libelle', 'Négociation', 'systeme', false),
  jsonb_build_object('cle', 'gagne',       'libelle', 'Gagné',       'systeme', true),
  jsonb_build_object('cle', 'perdu',       'libelle', 'Perdu',       'systeme', true)
)))
on conflict (cle) do nothing;

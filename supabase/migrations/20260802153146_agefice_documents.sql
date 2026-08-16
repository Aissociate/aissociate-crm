-- Tickets Benjamin « Plan de formation : remplissage formulaire AGEFICE » et
-- « création convention de formation ».
--
-- Les documents AGEFICE produits sont rangés avec les PDF de plans (même liste,
-- mêmes actions « ouvrir » / « ajouter au dossier »). On distingue leur nature
-- pour savoir dans quelle pièce justificative les déposer :
--   plan       → « Programme de formation »
--   demande    → « Demande de prise en charge »
--   convention → « Convention / contrat de formation »
alter table public.plan_pdfs
  add column if not exists kind text not null default 'plan';

comment on column public.plan_pdfs.kind is
  'Nature du document : plan | demande | convention. Détermine la pièce justificative cible.';

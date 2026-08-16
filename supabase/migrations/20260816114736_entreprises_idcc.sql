-- Convention collective applicable à l'entreprise (code IDCC, 4 chiffres).
-- Ticket Benjamin « Entreprise : rajouter un champ IDCC » — affiché à droite du
-- code NAF dans la fiche entreprise.
alter table public.entreprises add column if not exists idcc text;
comment on column public.entreprises.idcc is 'Code IDCC de la convention collective applicable';

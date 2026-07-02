-- Fiche Entreprise : ajout du statut juridique (EI / EURL / SARL / SAS / SA / …).
alter table public.entreprises add column if not exists statut_juridique text;

notify pgrst, 'reload schema';

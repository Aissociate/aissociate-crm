-- Studio IA — outils des agents (Google Drive via Nango).
-- Un livrable peut porter une action à exécuter au « VALIDÉ » du propriétaire
-- (ex. créer un Google Doc), et le résultat de cette exécution (lien ou erreur).
alter table public.studio_livrables
  add column if not exists action jsonb,
  add column if not exists resultat jsonb;

comment on column public.studio_livrables.action is 'Action exécutée à la validation (ex. {type:"drive_creer_document", titre, contenu, dossier_id}).';
comment on column public.studio_livrables.resultat is 'Résultat de l''action : {id, lien} ou {erreur}.';

notify pgrst, 'reload schema';

-- Applications du catalogue Nango demandées à Aissociate : type « app:<fournisseur> ».
alter table public.studio_connecteurs drop constraint if exists studio_connecteurs_type_check;
alter table public.studio_connecteurs add constraint studio_connecteurs_type_check check (
  type in ('google', 'outlook', 'smtp', 'facebook', 'instagram', 'linkedin', 'tiktok', 'mcp')
  or type ~ '^app:[a-z0-9][a-z0-9._-]{0,79}$'
);

notify pgrst, 'reload schema';

-- Pièces jointes du chat (texte extrait dans le navigateur) : relues aux tours suivants.
alter table public.studio_messages add column if not exists pieces jsonb;

notify pgrst, 'reload schema';

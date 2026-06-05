/*
  # Dossier client — centralisation automatique (production + documents)

  La table `dossiers` fait office de « dossier client ». Il est créé
  automatiquement au nom du prospect (clé : contact + formation) côté
  application, puis toute la production (devis, plans de formation, PDF générés)
  et les documents téléversés y sont rattachés.

  Ajouts :
  - `plans_formation.dossier_id` : rattachement du plan au dossier client.
  - `documents.dossier_id`        : rattachement du document au dossier client.
  - Index de centralisation (recherche par dossier / par contact+formation).

  NB : `devis.dossier_id` existe déjà ; les `plan_pdfs` se rattachent via
  `plan_id` -> `plans_formation.dossier_id` (aucune colonne supplémentaire).
*/

alter table public.plans_formation
  add column if not exists dossier_id uuid references public.dossiers(id) on delete set null;
create index if not exists idx_plans_dossier on public.plans_formation(dossier_id);

alter table public.documents
  add column if not exists dossier_id uuid references public.dossiers(id) on delete set null;
create index if not exists idx_documents_dossier on public.documents(dossier_id);

create index if not exists idx_dossiers_contact on public.dossiers(contact_id);
create index if not exists idx_dossiers_contact_formation on public.dossiers(contact_id, formation_id);

notify pgrst, 'reload schema';

/*
  # Fiabilisation du tracking visiteurs (page_views)

  Le Dashboard ne remontait pas les visiteurs du site. Deux causes possibles,
  traitées ici de façon défensive et idempotente :

  1. LECTURE — le KPI lit `page_views` sous une policy SELECT `is_manager()`.
     Pour un compte « admin par flag » (is_admin=true sans role manager),
     is_manager() renvoyait false → 0 ligne lue → 0 visiteur affiché. Corrigé
     par la migration `align_is_admin_flag` ; on réaffirme ici la policy.

  2. ÉCRITURE — l'insertion est faite par le visiteur ANONYME (rôle `anon`).
     Une policy RLS `with check (true)` ne suffit pas : le rôle doit aussi
     disposer du privilège de table. On accorde explicitement les GRANT pour
     ne pas dépendre des privilèges par défaut du projet.
*/

-- La table peut ne pas exister si la migration KPI n'a pas été appliquée.
create table if not exists public.page_views (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,
  visitor_id text,
  referrer   text,
  created_at timestamptz not null default now()
);
create index if not exists idx_page_views_created on public.page_views(created_at desc);
create index if not exists idx_page_views_visitor on public.page_views(visitor_id);
alter table public.page_views enable row level security;

-- Privilèges de table (RLS = filtre, GRANT = droit de base nécessaire à anon).
grant insert on public.page_views to anon, authenticated;
grant select on public.page_views to authenticated;

-- Policies (réaffirmées, idempotentes).
drop policy if exists page_views_insert_public on public.page_views;
create policy page_views_insert_public on public.page_views
  for insert to anon, authenticated with check (true);

drop policy if exists page_views_select_manager on public.page_views;
create policy page_views_select_manager on public.page_views
  for select to authenticated using (is_manager());

notify pgrst, 'reload schema';

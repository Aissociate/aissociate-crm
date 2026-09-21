/*
  # Plans de formation : mise à jour en direct

  Les plans et leurs documents (plan PDF, convention) sont aussi produits
  depuis l'écran Positionnement et par l'IA. La page Plans de formation
  s'abonne à ces tables (useRealtimeRefresh) pour afficher les nouveaux
  documents sans rechargement. La RLS s'applique aux événements reçus.
*/

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_pdfs') then
    alter publication supabase_realtime add table public.plan_pdfs;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plans_formation') then
    alter publication supabase_realtime add table public.plans_formation;
  end if;
end $$;

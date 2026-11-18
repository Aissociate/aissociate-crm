-- À exécuter après la restauration des données Supabase.

-- Création du profil à l'inscription (même trigger que sur Supabase).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Policies du stockage, recopiées de Supabase (18).
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;
create policy blog_storage_delete on storage.objects as permissive for delete to authenticated using ((bucket_id = 'blog'::text));
create policy blog_storage_insert on storage.objects as permissive for insert to authenticated with check ((bucket_id = 'blog'::text));
create policy blog_storage_select on storage.objects as permissive for select to authenticated using (((bucket_id = 'blog'::text) and is_manager()));
create policy blog_storage_update on storage.objects as permissive for update to authenticated using ((bucket_id = 'blog'::text)) with check ((bucket_id = 'blog'::text));
create policy coffre_storage_rw on storage.objects as permissive for all to authenticated using ((bucket_id = 'coffre'::text)) with check ((bucket_id = 'coffre'::text));
create policy conseiller_coffre_rw on storage.objects as permissive for all to authenticated using ((bucket_id = 'conseiller_coffre'::text)) with check ((bucket_id = 'conseiller_coffre'::text));
create policy conversations_storage_rw on storage.objects as permissive for all to authenticated using ((bucket_id = 'conversations'::text)) with check ((bucket_id = 'conversations'::text));
create policy crm_storage_delete on storage.objects as permissive for delete to authenticated using ((bucket_id = any (array['documents'::text, 'pieces'::text, 'cv'::text, 'screenshots'::text])));
create policy crm_storage_insert on storage.objects as permissive for insert to authenticated with check ((bucket_id = any (array['documents'::text, 'pieces'::text, 'cv'::text, 'screenshots'::text])));
create policy crm_storage_select on storage.objects as permissive for select to authenticated using ((bucket_id = any (array['documents'::text, 'pieces'::text, 'cv'::text, 'screenshots'::text])));
create policy crm_storage_update on storage.objects as permissive for update to authenticated using ((bucket_id = any (array['documents'::text, 'pieces'::text, 'cv'::text, 'screenshots'::text]))) with check ((bucket_id = any (array['documents'::text, 'pieces'::text, 'cv'::text, 'screenshots'::text])));
create policy devis_storage_rw on storage.objects as permissive for all to authenticated using ((bucket_id = 'devis'::text)) with check ((bucket_id = 'devis'::text));
create policy emails_storage_select on storage.objects as permissive for select to authenticated using ((bucket_id = 'emails'::text));
create policy factures_storage_rw on storage.objects as permissive for all to authenticated using ((bucket_id = 'factures'::text)) with check ((bucket_id = 'factures'::text));
create policy formateurs_storage_rw on storage.objects as permissive for all to authenticated using ((bucket_id = 'formateurs'::text)) with check ((bucket_id = 'formateurs'::text));
create policy plans_storage_rw on storage.objects as permissive for all to authenticated using ((bucket_id = 'plans'::text)) with check ((bucket_id = 'plans'::text));
create policy qualiopi_storage_rw on storage.objects as permissive for all to authenticated using ((bucket_id = 'qualiopi'::text)) with check ((bucket_id = 'qualiopi'::text));
create policy recrutement_rw on storage.objects as permissive for all to authenticated using (((bucket_id = 'recrutement'::text) and is_manager())) with check (((bucket_id = 'recrutement'::text) and is_manager()));

-- Les tâches pg_cron ne sont PAS recréées ici : tant que la prod tourne sur
-- Supabase, les relancer ici enverrait les e-mails et newsletters en double.
-- Elles sont activées à la bascule (deploy/data/sql/30-cron.sql).

-- Tables suivies en temps réel (les mêmes que la publication supabase_realtime).
-- À exécuter après la restauration des données ; rejouable.
do $$
declare t text;
begin
  foreach t in array array['emails', 'notifications', 'plan_pdfs', 'plans_formation', 'tickets'] loop
    execute format('drop trigger if exists realtime_notify on public.%I', t);
    execute format('create trigger realtime_notify after insert or update or delete on public.%I for each row execute function realtime.notify_change()', t);
  end loop;
end $$;

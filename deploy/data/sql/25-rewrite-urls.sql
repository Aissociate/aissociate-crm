-- À exécuter à la bascule, après la copie finale : remplace dans les données
-- les adresses du projet Supabase (stockage et fonctions) par celles de l'API.
--   psql -v old='https://<ref>.supabase.co' -v new='https://api.aissociate.re' -f 25-rewrite-urls.sql
-- Parcourt toutes les colonnes texte et JSON du schéma public ; rejouable.
\set ON_ERROR_STOP on
select set_config('migr.old', :'old', false), set_config('migr.new', :'new', false) \gset
begin;
-- Triggers métier (updated_at, partage LinkedIn…) suspendus le temps de la réécriture.
set local session_replication_role = replica;
do $$
declare
  r record; n bigint; total bigint := 0;
  v_old text := current_setting('migr.old');
  v_new text := current_setting('migr.new');
begin
  if v_old !~ '^https://[a-z0-9]+\.supabase\.co$' or v_new !~ '^https://[a-z0-9.-]+$' then
    raise exception 'Paramètres old/new invalides';
  end if;
  for r in
    select c.table_name, c.column_name, c.data_type
      from information_schema.columns c
      join pg_tables t on t.schemaname = c.table_schema and t.tablename = c.table_name
     where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'json')
       and c.is_generated = 'NEVER'
  loop
    execute format(
      'update public.%1$I set %2$I = replace(%2$I::text, %3$L, %4$L)::%5$s where %2$I::text like %6$L',
      r.table_name, r.column_name, v_old, v_new, r.data_type, '%' || v_old || '%');
    get diagnostics n = row_count;
    if n > 0 then raise notice '%.% : % lignes', r.table_name, r.column_name, n; total := total + n; end if;
  end loop;
  raise notice 'Total : % lignes réécrites', total;
end $$;
commit;

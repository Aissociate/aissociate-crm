-- Les événements de clic (tél / WhatsApp) sont enregistrés dans page_views sous
-- des chemins /click/… : on les exclut des KPI visiteurs/vues du dashboard.
create or replace function public.dashboard_visiteurs(p_ranges jsonb)
 returns jsonb
 language sql
 stable
 set search_path to 'public'
as $function$
  select coalesce(
    jsonb_agg(jsonb_build_object('visiteurs', s.v, 'vues', s.n) order by t.ord),
    '[]'::jsonb
  )
  from jsonb_array_elements(p_ranges) with ordinality as t(r, ord)
  cross join lateral (
    -- Un visiteur sans identifiant compte pour une visite distincte.
    select count(distinct coalesce(pv.visitor_id::text, pv.id::text)) as v,
           count(*) as n
    from public.page_views pv
    where pv.created_at >= (t.r ->> 0)::timestamptz
      and pv.created_at <  (t.r ->> 1)::timestamptz
      and pv.path not like '/click/%'
  ) s;
$function$;

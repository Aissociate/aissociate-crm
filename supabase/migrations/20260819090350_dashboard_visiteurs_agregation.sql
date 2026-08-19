/*
  # Tableau de bord : agrégation du trafic côté serveur

  Le dashboard rapatriait toute la table `page_views` pour compter les visiteurs
  dans le navigateur : 20 592 lignes = 21 requêtes paginées, ~35 s pendant
  lesquelles la tuile « Visiteurs site » affichait 0. Le coût grandit avec le
  trafic (~500 vues/jour).

  `dashboard_visiteurs` reçoit les fenêtres voulues (période courante, période
  précédente, seaux de la courbe) et renvoie un compteur par fenêtre — une seule
  requête. SECURITY INVOKER : la RLS de page_views s'applique (managers seuls).
*/

create index if not exists idx_page_views_created_at
  on public.page_views (created_at desc);

create or replace function public.dashboard_visiteurs(p_ranges jsonb)
returns jsonb
language sql
stable
set search_path = public
as $$
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
  ) s;
$$;

grant execute on function public.dashboard_visiteurs(jsonb) to authenticated;

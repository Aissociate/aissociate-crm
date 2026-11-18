-- Performance : la policy de lecture de page_views appelait is_manager() pour
-- chaque ligne (27 000+). Encapsulée dans un sous-select, la fonction est
-- évaluée une seule fois par requête (InitPlan). Les droits sont inchangés :
-- seuls les managers lisent page_views.
-- Effet : dashboard_visiteurs (14 périodes) passe de > 8 s à < 0,2 s.
alter policy page_views_select_manager on public.page_views using ((select public.is_manager()));

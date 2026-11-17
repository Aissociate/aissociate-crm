-- Studio IA : documents mis en forme en HTML par les agents (devis, proposition, compte rendu…),
-- modifiables en WYSIWYG dans le Studio et exportés en PDF ou Word. Stockés comme livrables.
alter table public.studio_livrables add column if not exists format text not null default 'markdown';
alter table public.studio_livrables drop constraint if exists studio_livrables_format_check;
alter table public.studio_livrables add constraint studio_livrables_format_check check (format in ('markdown', 'html'));

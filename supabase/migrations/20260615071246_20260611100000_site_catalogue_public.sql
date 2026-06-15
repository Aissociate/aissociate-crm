alter table public.formations add column if not exists slug text;

create unique index if not exists formations_slug_key
  on public.formations (slug) where slug is not null;

update public.formations f
set slug = pick.slug
from (
  select distinct on (m.slug) m.slug, f2.id
  from (values
    ('creation-contenus-ia',       '%création de contenus%'),
    ('introduction-ia-pme',        '%introduction aux ia%'),
    ('automatisation-process-pme', '%automatisation des process%'),
    ('ia-relation-client',         '%relation client%'),
    ('ia-marketing-communication', '%marketing et la communication%'),
    ('ia-prospection-commerciale', '%prospection commerciale%'),
    ('ia-ressources-humaines',     '%ressources humaines%'),
    ('ia-manager',                 '%service du manager%'),
    ('marches-publics-btp-ia',     '%marchés publics%')
  ) as m(slug, pattern)
  join public.formations f2 on f2.slug is null and f2.intitule ilike m.pattern
  order by m.slug, f2.created_at
) as pick
where f.id = pick.id
  and not exists (select 1 from public.formations fx where fx.slug = pick.slug);

drop policy if exists formations_select_public on public.formations;
create policy formations_select_public on public.formations
  for select to anon using (actif = true);

/*
  # Catalogue public dynamique

  Le site vitrine (/formations) affichait un catalogue 100 % statique : les
  modifications du back-office CRM (page Catalogue) n'étaient jamais visibles
  des visiteurs. Cette migration branche le site sur la table `formations`.

  1. `formations.slug` : identifiant d'URL côté site public (/formations/:slug).
     - Unique (hors NULL). Géré depuis la page Catalogue du CRM.
     - Une formation avec un slug correspondant à une page statique du site
       vient SURCHARGER son contenu (titre, durée, prix, public, objectifs).
     - Une formation active sans correspondance statique est ajoutée au
       catalogue public (carte + page détail générées depuis le CRM).
  2. Backfill best-effort : rattache les formations existantes aux slugs
     historiques du site (pages prérendues) par correspondance d'intitulé.
  3. Lecture anonyme : policy SELECT pour `anon` limitée aux formations
     actives. NB : `reference` et `prix_intra` sont déjà affichés publiquement
     sur les pages détail du site, la table ne contient pas de donnée sensible.
*/

alter table public.formations add column if not exists slug text;

create unique index if not exists formations_slug_key
  on public.formations (slug) where slug is not null;

-- Backfill best-effort : au plus une formation par slug, jamais d'écrasement.
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

-- Lecture anonyme du catalogue actif (le site vitrine n'est pas authentifié).
drop policy if exists formations_select_public on public.formations;
create policy formations_select_public on public.formations
  for select to anon using (actif = true);

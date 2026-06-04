/*
  # Blog du site vitrine

  Tables `blog_categories` / `blog_articles` (schéma repris du site OF) pour
  alimenter les pages /blog et /blog/:slug. Lecture publique des articles publiés,
  écriture réservée à la direction (CRM). Un article d'amorçage est inséré.
*/

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  description text default '',
  color text default '#f97316',
  icon text default 'BookOpen',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  excerpt text not null default '',
  content text not null default '',
  category_id uuid references public.blog_categories(id) on delete set null,
  image_url text,
  author text default 'Équipe Aissociate',
  read_time integer default 5,
  seo_title text, seo_description text, seo_keywords text,
  published boolean default true,
  published_at timestamptz default now(),
  created_by uuid references auth.users(id) on delete set null,
  generation_prompt text, ai_model_used text, views_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_blog_articles_slug on public.blog_articles(slug);
create index if not exists idx_blog_articles_pub on public.blog_articles(published, published_at desc);
create index if not exists idx_blog_articles_cat on public.blog_articles(category_id);

alter table public.blog_categories enable row level security;
alter table public.blog_articles enable row level security;

drop policy if exists blog_categories_read on public.blog_categories;
create policy blog_categories_read on public.blog_categories for select to anon, authenticated using (true);
drop policy if exists blog_articles_read on public.blog_articles;
create policy blog_articles_read on public.blog_articles for select to anon, authenticated using (published = true);
drop policy if exists blog_categories_write on public.blog_categories;
create policy blog_categories_write on public.blog_categories for all to authenticated using (is_manager()) with check (is_manager());
drop policy if exists blog_articles_write on public.blog_articles;
create policy blog_articles_write on public.blog_articles for all to authenticated using (is_manager()) with check (is_manager());

insert into public.blog_categories (name, slug, description, color, icon)
values ('Intelligence artificielle', 'intelligence-artificielle', 'Actualités et conseils IA', '#3b82f6', 'TrendingUp')
on conflict (slug) do nothing;

insert into public.blog_articles (title, slug, excerpt, content, category_id, author, read_time, published)
select
  'Bienvenue sur le blog Aissociate',
  'bienvenue-sur-le-blog-aissociate',
  'Découvrez nos formations IA et nos conseils pour intégrer l''intelligence artificielle dans votre entreprise.',
  '<p>Bienvenue sur le blog d''Aissociate, votre organisme de formation à l''intelligence artificielle. Retrouvez ici nos actualités, guides et retours d''expérience.</p>',
  (select id from public.blog_categories where slug = 'intelligence-artificielle'),
  'Équipe Aissociate', 3, true
where not exists (select 1 from public.blog_articles where slug = 'bienvenue-sur-le-blog-aissociate');

notify pgrst, 'reload schema';

/*
  # Partage automatique des articles du blog sur LinkedIn (page entreprise)

  À la publication d'un article (passage `published = true`), un trigger appelle
  l'Edge Function `linkedin-share` (via pg_net + secrets Vault project_url /
  service_role_key, comme le cron blog) qui poste texte + image sur la page
  entreprise LinkedIn.

  Prérequis (à renseigner dans Paramètres → LinkedIn, ou en secrets Supabase) :
    - access_token OAuth (scope w_organization_social, produit Community Management API)
    - org_urn (ex. urn:li:organization:XXXX, ou juste l'id numérique)
*/

-- 1. Suivi du partage sur l'article
alter table public.blog_articles add column if not exists linkedin_shared_at timestamptz;
alter table public.blog_articles add column if not exists linkedin_post_urn text;

-- 2. Configuration par défaut (éditable dans Paramètres). Secret/token à compléter.
insert into public.parametres (cle, valeur, description) values
  ('linkedin',
   jsonb_build_object(
     'enabled', true,
     'client_id', '77bf2p5s6yamdv',
     'client_secret', '',
     'access_token', '',
     'org_urn', ''
   ),
   'LinkedIn : partage auto des articles (page entreprise). Renseigner access_token + org_urn.')
on conflict (cle) do nothing;

-- 3. Trigger : à la publication, déclenche l'Edge Function linkedin-share
create or replace function public.blog_article_linkedin_share()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Uniquement quand l'article vient d'être publié et n'a pas déjà été partagé.
  if new.published is true
     and new.linkedin_shared_at is null
     and (tg_op = 'INSERT' or old.published is distinct from new.published) then
    begin
      perform net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/linkedin-share',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := jsonb_build_object('article_id', new.id),
        timeout_milliseconds := 120000
      );
    exception when others then
      -- Non bloquant : la publication réussit même si LinkedIn n'est pas configuré.
      raise notice 'Partage LinkedIn non déclenché (%). pg_net + secrets Vault + Edge Function requis.', sqlerrm;
    end;
  end if;
  return new;
end $$;

drop trigger if exists trg_blog_linkedin_share on public.blog_articles;
create trigger trg_blog_linkedin_share after insert or update on public.blog_articles
  for each row execute function public.blog_article_linkedin_share();

notify pgrst, 'reload schema';

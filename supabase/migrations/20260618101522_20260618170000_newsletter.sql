create table if not exists public.newsletters (
  id               uuid primary key default gen_random_uuid(),
  sujet            text not null,
  contenu_html     text not null,
  image_url        text,
  periode_debut    date,
  periode_fin      date,
  statut           text not null default 'brouillon',
  recipients_count integer not null default 0,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
create index if not exists idx_newsletters_created on public.newsletters(created_at desc);
alter table public.newsletters enable row level security;

drop policy if exists newsletters_all on public.newsletters;
create policy newsletters_all on public.newsletters for all to authenticated
  using (is_manager()) with check (is_manager());

insert into public.parametres (cle, valeur, description) values
  ('newsletter',
   jsonb_build_object(
     'auto_send', false,
     'rgpd_only', true,
     'sender_name', 'Aissociate',
     'intro',
       'Tu es le rédacteur de la newsletter hebdomadaire d''Aissociate, organisme de formation IA. À partir de la liste des articles publiés cette semaine, rédige une courte introduction éditoriale chaleureuse et professionnelle (2-3 phrases, en français) qui donne envie de lire la suite. Réponds UNIQUEMENT par le texte de l''introduction, sans titre ni guillemets.'
   ),
   'Newsletter hebdo : éditorial, expéditeur, auto-envoi, RGPD')
on conflict (cle) do nothing;

do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'newsletter-weekly';

  perform cron.schedule(
    'newsletter-weekly',
    '0 9 * * 1',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/generate-newsletter',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{"source":"cron"}'::jsonb,
        timeout_milliseconds := 150000
      );
    $job$
  );

  raise notice 'Job cron "newsletter-weekly" programmé (lundi 9h).';
exception when others then
  raise notice 'Cron newsletter non configuré (%). Secrets Vault requis + generate-newsletter déployée.', sqlerrm;
end $$;

notify pgrst, 'reload schema';
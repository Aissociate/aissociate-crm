/*
  # Blog IA : paramétrage + génération automatique (cron)

  - Paramètre `blog` : prompt maître, thèmes de veille IA, publication auto,
    recherche web. Édité dans Paramètres (admin), lu par l'Edge Function.
  - Cron `blog-generate` : appelle l'Edge Function `generate-article` chaque
    semaine pour produire un article (brouillon par défaut). Bloc défensif.
*/

insert into public.parametres (cle, valeur, description) values
  ('blog',
   jsonb_build_object(
     'prompt',
       'Tu es rédacteur expert en intelligence artificielle pour le blog d''Aissociate, organisme de formation IA certifié Qualiopi. À partir du THÈME fourni, rédige un article de blog complet, informatif et optimisé SEO, en français, à destination des PME et dirigeants. Ton professionnel et accessible. Termine par une incitation à découvrir nos formations. Réponds UNIQUEMENT par un objet JSON valide {"title": string, "excerpt": string, "content": string (HTML), "category": string, "seo_keywords": string}.',
     'themes', jsonb_build_array(
       'L''IA générative au service des PME',
       'Automatiser ses processus métier avec l''IA',
       'Financer sa formation IA avec le CPF',
       'L''IA pour optimiser la relation client',
       'Prompt engineering : les bases pour débuter',
       'IA et conformité RGPD en entreprise',
       'Veille IA : tendances et nouveautés du moment'
     ),
     'auto_publish', false,
     'use_web', true
   ),
   'Blog IA : prompt maître, thèmes de veille, publication auto')
on conflict (cle) do nothing;

-- Cron hebdomadaire (lundi 8h) -> generate-article. Défensif : n'échoue jamais.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  perform cron.unschedule(jobid) from cron.job where jobname = 'blog-generate';

  perform cron.schedule(
    'blog-generate',
    '0 8 * * 1',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/generate-article',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' ||
            (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{"source":"cron"}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$
  );

  raise notice 'Job cron "blog-generate" programmé (lundi 8h).';
exception when others then
  raise notice 'Cron blog non configuré (%). Secrets Vault requis + generate-article déployée.', sqlerrm;
end $$;

notify pgrst, 'reload schema';

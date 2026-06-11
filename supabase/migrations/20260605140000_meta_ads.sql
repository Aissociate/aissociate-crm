/*
  # Publicité Meta (Marketing API) — configuration

  Ligne de paramètres `meta_ads` pour la lecture des performances publicitaires
  Meta (dépense, impressions, leads…) affichées dans le tableau de bord.

  Sécurité : la table `parametres` est en lecture/écriture ADMIN uniquement ;
  l'Edge Function `meta-ads` lit le token via service_role (jamais exposé au
  navigateur). Préférer le secret Supabase `META_ACCESS_TOKEN` au stockage en base.
*/

insert into public.parametres (cle, valeur, description) values
  ('meta_ads',
   jsonb_build_object(
     'enabled', false,
     'ad_account_id', '',
     'api_version', 'v21.0',
     'access_token', ''
   ),
   'Publicité Meta — Marketing API (lecture des performances Ads)')
on conflict (cle) do nothing;

notify pgrst, 'reload schema';

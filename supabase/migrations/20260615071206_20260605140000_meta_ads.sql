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

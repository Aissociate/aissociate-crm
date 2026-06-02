/*
  # Purge des e-mails reçus + date de coupure de réception
*/
delete from public.emails where direction = 'entrant';

insert into public.parametres (cle, valeur, description) values
  ('email_sync_since',
   jsonb_build_object('date', to_char(current_date, 'YYYY-MM-DD')),
   'Réception IMAP : ne récupère que les messages reçus à partir de cette date')
on conflict (cle) do nothing;

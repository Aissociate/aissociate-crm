/*
  # Purge des e-mails reçus + date de coupure de réception

  Contexte : boîte de réception saturée par un backlog d'e-mails. On repart
  propre et on borne la réception future.

  1. Purge de TOUS les e-mails entrants (backlog). Les sortants — dont l'import
     de prospection AGEFICE — ne sont PAS touchés (direction = 'sortant').
  2. Paramètre `email_sync_since` = date du jour : la synchro IMAP ne récupèrera
     plus que les messages reçus À PARTIR d'aujourd'hui (cf. fetch-emails).

  À partir de là, ne remontent que :
    - les e-mails de l'ancienne app (sortants, déjà importés) ;
    - les e-mails reçus depuis aujourd'hui dont l'expéditeur figure en base
      (contact / formateur / candidat) — filtrage côté fetch-emails.
*/

delete from public.emails where direction = 'entrant';

insert into public.parametres (cle, valeur, description) values
  ('email_sync_since',
   jsonb_build_object('date', to_char(current_date, 'YYYY-MM-DD')),
   'Réception IMAP : ne récupère que les messages reçus à partir de cette date')
on conflict (cle) do nothing;

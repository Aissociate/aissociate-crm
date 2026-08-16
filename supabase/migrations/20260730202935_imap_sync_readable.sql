-- Ticket Benjamin « synchronisation messagerie » : la fonction `fetch-emails`
-- journalise chaque passage dans parametres.imap_sync (horodatage + compteurs).
-- La table `parametres` est réservée aux admins ; on ouvre en LECTURE SEULE la
-- seule clé `imap_sync` à tous les utilisateurs connectés, pour que les
-- conseillers voient aussi la date de dernière réception dans la Messagerie.
-- Aucune donnée sensible : horodatage, compteurs et message d'erreur technique.
drop policy if exists parametres_select_imap_sync on public.parametres;
create policy parametres_select_imap_sync
  on public.parametres for select
  to authenticated
  using (cle = 'imap_sync');

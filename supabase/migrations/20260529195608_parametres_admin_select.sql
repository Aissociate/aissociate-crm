/*
  # 16 — Restreindre la lecture des paramètres aux admins

  La table `parametres` contient désormais des secrets (mots de passe SMTP/IMAP).
  La lecture passe de « tous les authentifiés » à « admin uniquement ».
  Les Edge Functions y accèdent via la clé service_role (contourne la RLS).
*/

drop policy if exists parametres_select on public.parametres;
create policy parametres_select on public.parametres for select to authenticated
  using (is_admin());

-- Entrée IMAP par défaut (placeholder) pour la configuration en UI
insert into public.parametres (cle, valeur, description) values
  ('imap', '{"host":"","port":993,"user":"","password":""}'::jsonb, 'Configuration IMAP entrante (CDC 4.7)')
on conflict (cle) do nothing;

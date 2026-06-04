/*
  # 16 — Restreindre la lecture des parametres aux admins

  La table parametres contient des secrets (mots de passe SMTP/IMAP).
  La lecture passe de tous les authentifies a admin uniquement.
  Les Edge Functions y accedent via la cle service_role (contourne la RLS).
*/

drop policy if exists parametres_select on public.parametres;
create policy parametres_select on public.parametres for select to authenticated
  using (is_admin());

-- Entree IMAP par defaut (placeholder) pour la configuration en UI
insert into public.parametres (cle, valeur, description) values
  ('imap', '{"host":"","port":993,"user":"","password":""}'::jsonb, 'Configuration IMAP entrante (CDC 4.7)')
on conflict (cle) do nothing;

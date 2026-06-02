/*
  # E-mails orphelins réservés à l'administrateur

  Règle métier (messagerie) : un e-mail ENTRANT qui ne correspond à AUCUN
  contact, formateur ni candidat — rapprochement par l'adresse de l'expéditeur —
  et non affecté (`contact_id` null ET `owner_id` null) est « orphelin ».
  Il ne doit être visible QUE par l'administrateur (`is_admin()`), pas par le
  reste de la direction ni par les conseillers.

  Avant :  emails_select = is_manager() OR owner_id = auth.uid()
           => un orphelin (owner_id null) était visible par toute la direction
              (admin + directeur_commercial).
  Après :  la direction non-admin ne voit plus les orphelins ; un entrant reste
           visible par la direction dès qu'il est affecté OU que son expéditeur
           correspond à un contact / formateur / candidat (cohérent avec l'UI).
*/

-- Vrai si l'adresse de l'expéditeur correspond à un contact, un formateur ou un
-- candidat. SECURITY DEFINER pour évaluer les 3 tables en contournant leur RLS.
create or replace function public.email_sender_matched(p_expediteur text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with a as (
    -- « Nom <addr@x> » -> addr@x ; sinon l'adresse brute. Normalisée.
    select lower(trim(coalesce(substring(p_expediteur from '<([^>]+)>'), p_expediteur))) as addr
  )
  select coalesce((
    select true
    from a
    where a.addr is not null and a.addr <> '' and (
         exists (select 1 from public.contacts   c where lower(c.email) = a.addr)
      or exists (select 1 from public.formateurs f where lower(f.email) = a.addr)
      or exists (select 1 from public.candidats  k where lower(k.email) = a.addr)
    )
    limit 1
  ), false);
$$;

revoke all on function public.email_sender_matched(text) from public;
grant execute on function public.email_sender_matched(text) to authenticated;

-- Périmètre commun : admin = tout ; conseiller = ses e-mails affectés ;
-- direction (manager) = tout SAUF les entrants orphelins.
-- SELECT
drop policy if exists emails_select on public.emails;
create policy emails_select on public.emails for select to authenticated
using (
  is_admin()
  or owner_id = auth.uid()
  or (is_manager() and (
        direction = 'sortant'
        or contact_id is not null
        or owner_id is not null
        or public.email_sender_matched(expediteur)
     ))
);

-- WRITE (insert/update/delete) : mêmes périmètres. Conséquence : un e-mail
-- orphelin ne peut être affecté que par l'admin (la direction ne le voit pas).
drop policy if exists emails_write on public.emails;
create policy emails_write on public.emails for all to authenticated
using (
  is_admin()
  or owner_id = auth.uid()
  or (is_manager() and (
        direction = 'sortant'
        or contact_id is not null
        or owner_id is not null
        or public.email_sender_matched(expediteur)
     ))
)
with check (
  is_admin()
  or owner_id = auth.uid()
  or (is_manager() and (
        direction = 'sortant'
        or contact_id is not null
        or owner_id is not null
        or public.email_sender_matched(expediteur)
     ))
);

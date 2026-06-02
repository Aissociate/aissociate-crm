/*
  # E-mails orphelins réservés à l'administrateur + fonction email_sender_matched
*/
create or replace function public.email_sender_matched(p_expediteur text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with a as (
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

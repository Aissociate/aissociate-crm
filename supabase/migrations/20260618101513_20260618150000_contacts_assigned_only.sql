drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (is_manager() or owner_id = auth.uid() or responsable_id = auth.uid());

drop policy if exists contacts_modify on public.contacts;
create policy contacts_modify on public.contacts for update to authenticated
  using (is_manager() or owner_id = auth.uid() or responsable_id = auth.uid())
  with check (is_manager() or owner_id = auth.uid() or responsable_id = auth.uid());

drop policy if exists contact_actions_all on public.contact_actions;
create policy contact_actions_all on public.contact_actions for all to authenticated
  using (exists (
    select 1 from public.contacts c
    where c.id = contact_id and (is_manager() or c.owner_id = auth.uid() or c.responsable_id = auth.uid())
  ))
  with check (exists (
    select 1 from public.contacts c
    where c.id = contact_id and (is_manager() or c.owner_id = auth.uid() or c.responsable_id = auth.uid())
  ));

notify pgrst, 'reload schema';
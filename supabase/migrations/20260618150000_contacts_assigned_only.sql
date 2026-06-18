/*
  # RLS contacts : un conseiller ne voit QUE ses contacts affectés

  Avant, la policy SELECT était :
    is_manager() OR owner_id = auth.uid() OR owner_id IS NULL
  → un conseiller voyait aussi TOUS les contacts non affectés (tous les
    prospects importés en attente), et ne voyait PAS les contacts où il est
    `responsable_id` sans être `owner_id`.

  Correctif — un contact est « affecté » à un conseiller s'il en est le
  propriétaire (owner_id) OU le responsable (responsable_id), cohérent avec le
  reste de l'app (répartition, coffre, assistant) :
    - SELECT / UPDATE : is_manager() OR owner_id = auth.uid() OR responsable_id = auth.uid()
    - les contacts non affectés (owner_id IS NULL) ne sont visibles que de la
      direction (is_manager()), qui les répartit.
  INSERT/DELETE inchangés (création avec soi-même en owner ; suppression
  réservée à l'owner ou la direction).
*/

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (is_manager() or owner_id = auth.uid() or responsable_id = auth.uid());

drop policy if exists contacts_modify on public.contacts;
create policy contacts_modify on public.contacts for update to authenticated
  using (is_manager() or owner_id = auth.uid() or responsable_id = auth.uid())
  with check (is_manager() or owner_id = auth.uid() or responsable_id = auth.uid());

-- Journal d'actions : aligné sur la visibilité du contact parent (owner ou responsable).
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

/*
  # Positionner un contact sur une session depuis sa fiche

  Le volet « fiche client » embarque un calendrier miniature qui permet
  d'inscrire le contact sur une session sans quitter la fiche. Les policies
  d'écriture de `session_participants` étaient réservées aux managers : un
  conseiller ne pouvait pas positionner SON prospect.

  On les aligne sur `contact_actions` : manager, OU conseiller à qui le contact
  est attribué (owner_id / responsable_id). Les lignes sans contact_id
  (participant saisi à la main depuis le calendrier) restent aux managers.
*/

create or replace function public.peut_gerer_contact(p_contact uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.is_manager() or c.owner_id = auth.uid() or c.responsable_id = auth.uid()
    from public.contacts c where c.id = p_contact
  ), false);
$$;

grant execute on function public.peut_gerer_contact(uuid) to authenticated;

drop policy if exists participants_insert on public.session_participants;
create policy participants_insert on public.session_participants
  for insert to authenticated
  with check (public.is_manager() or public.peut_gerer_contact(contact_id));

drop policy if exists participants_update on public.session_participants;
create policy participants_update on public.session_participants
  for update to authenticated
  using (public.is_manager() or public.peut_gerer_contact(contact_id))
  with check (public.is_manager() or public.peut_gerer_contact(contact_id));

drop policy if exists participants_delete on public.session_participants;
create policy participants_delete on public.session_participants
  for delete to authenticated
  using (public.is_manager() or public.peut_gerer_contact(contact_id));

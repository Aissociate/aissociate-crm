alter policy devis_select on public.devis
  using (
    is_manager()
    or owner_id = auth.uid()
    or exists (select 1 from public.contacts c where c.id = devis.contact_id and c.owner_id = auth.uid())
  );

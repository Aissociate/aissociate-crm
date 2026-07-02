-- Visibilité des devis : le chargé de formation voit aussi les devis des contacts
-- qui lui sont affectés (créés par un admin pour lui, par ex.), pas seulement les siens.
-- (SELECT uniquement — l'écriture reste au créateur / à la direction.)
alter policy devis_select on public.devis
  using (
    is_manager()
    or owner_id = auth.uid()
    or exists (select 1 from public.contacts c where c.id = devis.contact_id and c.owner_id = auth.uid())
  );

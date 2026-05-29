/*
  # 08 — Supabase Storage : buckets de fichiers + policies

  Buckets
    - `documents` (public)  : procedures, modeles, documents Qualiopi partageables
    - `pieces`    (prive)   : pieces justificatives des dossiers (RGPD)
    - `cv`        (prive)   : CV des candidats (RGPD)

  Acces (storage.objects)
    - Lecture/ecriture reservees aux utilisateurs authentifies, sur ces buckets.
    - Les buckets prives s'ouvrent via des URL signees (createSignedUrl cote app).

  Idempotent : on conflict / drop policy if exists.
*/

insert into storage.buckets (id, name, public) values
  ('documents', 'documents', true),
  ('pieces',    'pieces',    false),
  ('cv',        'cv',        false)
on conflict (id) do nothing;

drop policy if exists "crm_storage_select" on storage.objects;
create policy "crm_storage_select" on storage.objects for select to authenticated
  using (bucket_id in ('documents', 'pieces', 'cv'));

drop policy if exists "crm_storage_insert" on storage.objects;
create policy "crm_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('documents', 'pieces', 'cv'));

drop policy if exists "crm_storage_update" on storage.objects;
create policy "crm_storage_update" on storage.objects for update to authenticated
  using (bucket_id in ('documents', 'pieces', 'cv'))
  with check (bucket_id in ('documents', 'pieces', 'cv'));

drop policy if exists "crm_storage_delete" on storage.objects;
create policy "crm_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('documents', 'pieces', 'cv'));

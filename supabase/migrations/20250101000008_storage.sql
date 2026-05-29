/*
  # 08 — Supabase Storage : buckets de fichiers + policies

  Buckets
    - `documents` (public)  : procédures, modèles, documents Qualiopi partageables
    - `pieces`    (privé)   : pièces justificatives des dossiers (RGPD)
    - `cv`        (privé)   : CV des candidats (RGPD)

  Accès (storage.objects)
    - Lecture/écriture réservées aux utilisateurs authentifiés, sur ces buckets.
    - Les buckets privés s'ouvrent via des URL signées (createSignedUrl côté app).

  Idempotent : on conflict / drop policy if exists.
*/

insert into storage.buckets (id, name, public) values
  ('documents', 'documents', true),
  ('pieces',    'pieces',    false),
  ('cv',        'cv',        false)
on conflict (id) do nothing;

-- Lecture
drop policy if exists "crm_storage_select" on storage.objects;
create policy "crm_storage_select" on storage.objects for select to authenticated
  using (bucket_id in ('documents', 'pieces', 'cv'));

-- Upload
drop policy if exists "crm_storage_insert" on storage.objects;
create policy "crm_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('documents', 'pieces', 'cv'));

-- Mise à jour (upsert / remplacement de version)
drop policy if exists "crm_storage_update" on storage.objects;
create policy "crm_storage_update" on storage.objects for update to authenticated
  using (bucket_id in ('documents', 'pieces', 'cv'))
  with check (bucket_id in ('documents', 'pieces', 'cv'));

-- Suppression
drop policy if exists "crm_storage_delete" on storage.objects;
create policy "crm_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('documents', 'pieces', 'cv'));

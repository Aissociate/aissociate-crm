/*
  # Bucket screenshots + colonne screenshot_url sur tickets

  ## Modifications
  - Storage : nouveau bucket `screenshots` (public) pour les captures de bugs
  - Policies storage étendues pour inclure le bucket `screenshots`
  - `tickets` : ajout de la colonne `screenshot_url text` (nullable)
    - Contient l'URL publique de la capture d'écran jointe au ticket

  ## Sécurité
  - Bucket public : les URL sont accessibles sans authentification (acceptable
    car les captures ne contiennent pas de données sensibles par nature)
  - Upload restreint aux utilisateurs authentifiés (policies storage)
*/

insert into storage.buckets (id, name, public)
  values ('screenshots', 'screenshots', true)
  on conflict (id) do nothing;

-- Étendre les policies storage existantes pour inclure screenshots
drop policy if exists "crm_storage_select" on storage.objects;
create policy "crm_storage_select" on storage.objects for select to authenticated
  using (bucket_id in ('documents', 'pieces', 'cv', 'screenshots'));

drop policy if exists "crm_storage_insert" on storage.objects;
create policy "crm_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('documents', 'pieces', 'cv', 'screenshots'));

drop policy if exists "crm_storage_update" on storage.objects;
create policy "crm_storage_update" on storage.objects for update to authenticated
  using  (bucket_id in ('documents', 'pieces', 'cv', 'screenshots'))
  with check (bucket_id in ('documents', 'pieces', 'cv', 'screenshots'));

drop policy if exists "crm_storage_delete" on storage.objects;
create policy "crm_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('documents', 'pieces', 'cv', 'screenshots'));

-- Colonne screenshot_url sur tickets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'screenshot_url'
  ) THEN
    ALTER TABLE tickets ADD COLUMN screenshot_url text;
  END IF;
END $$;

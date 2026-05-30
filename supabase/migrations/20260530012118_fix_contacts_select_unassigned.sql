/*
  # Fix RLS contacts : prospects non affectés visibles

  ## Problème
  La politique SELECT actuelle (is_manager() OR owner_id = auth.uid()) exclut
  les contacts avec owner_id IS NULL. Un conseiller qui importe des prospects
  ne les voit pas s'ils restent non affectés.

  ## Correction
  - Conseillers voient leurs propres contacts OU les contacts non affectés (owner_id IS NULL)
  - Managers voient tout (inchangé)
  - Les prospects non affectés apparaissent dans la liste en attente d'attribution
*/

DROP POLICY IF EXISTS "contacts_select" ON contacts;

CREATE POLICY "contacts_select"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    is_manager()
    OR owner_id = auth.uid()
    OR owner_id IS NULL
  );

/*
  # Enrichissement de la table formations

  1. Nouvelles colonnes
    - `reference` (text) : code de référence interne (ex. INTROIA1)
    - `prix_intra` (numeric) : tarif forfait intra HT (le champ `prix` existant = prix inter)
    - `certifiante` (boolean) : indique si la formation est certifiante / éligible CPF
    - `code_certification` (text) : référence certification (ex. RS 7667)

  2. Notes
    - Colonnes ajoutées en toute sécurité avec IF NOT EXISTS
    - Pas de modification de données existantes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'formations' AND column_name = 'reference'
  ) THEN
    ALTER TABLE formations ADD COLUMN reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'formations' AND column_name = 'prix_intra'
  ) THEN
    ALTER TABLE formations ADD COLUMN prix_intra numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'formations' AND column_name = 'certifiante'
  ) THEN
    ALTER TABLE formations ADD COLUMN certifiante boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'formations' AND column_name = 'code_certification'
  ) THEN
    ALTER TABLE formations ADD COLUMN code_certification text;
  END IF;
END $$;

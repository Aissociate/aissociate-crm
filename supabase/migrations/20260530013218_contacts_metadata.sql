/*
  # Ajout metadata JSONB sur contacts

  ## Contexte
  L'import CSV/Google Sheets stockait les colonnes supplémentaires (dont la colonne K)
  sous forme de texte brut dans le champ notes. Cette migration ajoute un champ
  structuré pour conserver le contenu brut de chaque colonne.

  ## Modifications
  - `contacts` : ajout de la colonne `metadata jsonb`
    - Stocke le contenu original de chaque colonne du sheet (clé = en-tête, valeur = contenu)
    - Nullable (les contacts créés manuellement n'ont pas de metadata)
    - Permet d'afficher la colonne K et toutes les autres dans la fiche contact
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE contacts ADD COLUMN metadata jsonb;
  END IF;
END $$;

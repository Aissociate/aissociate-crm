/*
  # Ajout metadata JSONB sur candidats

  ## Contexte
  Même approche que pour les contacts : les colonnes supplémentaires du sheet
  (le questionnaire Meta Leads) étaient stockées en texte brut dans notes.
  Cette migration ajoute un champ structuré pour la fiche candidat.

  ## Modifications
  - `candidats` : ajout de la colonne `metadata jsonb`
    - Stocke le contenu brut de chaque colonne du sheet (clé = en-tête, valeur = contenu)
    - Nullable (les candidats saisis manuellement n'ont pas de metadata)
    - Utilisé pour afficher le questionnaire dans la fiche candidat
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidats' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE candidats ADD COLUMN metadata jsonb;
  END IF;
END $$;

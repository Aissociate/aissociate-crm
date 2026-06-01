/*
  # Dédoublonnage emails — contrainte UNIQUE complète sur message_id

  ## Contexte
  L'index partiel existant (WHERE message_id IS NOT NULL) empêche l'utilisation
  de ON CONFLICT (message_id) DO NOTHING dans upsert car PostgreSQL exige une
  contrainte UNIQUE complète pour les clauses ON CONFLICT sur colonne nommée.

  ## Changements
  1. Nettoyage préventif : suppression des éventuels doublons (garde le plus ancien)
  2. Remplacement de l'index partiel par une contrainte UNIQUE complète
     (les NULL restent autorisés en nombre illimité — comportement PostgreSQL standard)

  ## Sécurité
  Aucune donnée n'est perdue : seuls des vrais doublons (même message_id) sont supprimés.
*/

-- 1. Supprimer les doublons éventuels en gardant le plus ancien
DELETE FROM public.emails
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY created_at) AS rn
    FROM public.emails
    WHERE message_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- 2. Supprimer l'ancien index partiel
DROP INDEX IF EXISTS public.uq_emails_message_id;

-- 3. Ajouter une contrainte UNIQUE complète (NULL != NULL en PostgreSQL,
--    donc plusieurs lignes sans message_id restent autorisées)
ALTER TABLE public.emails
  ADD CONSTRAINT uq_emails_message_id UNIQUE (message_id);

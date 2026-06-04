/*
  # Approbation des nouveaux comptes back-office

  1. Modifications table profiles
     - Ajout colonne `approved` (boolean, default false)
     - Les admins et directeurs commerciaux existants sont approuvés automatiquement

  2. Sécurité
     - ProtectedRoute bloquera les utilisateurs non approuvés côté UI
     - La colonne approved est lisible par l'utilisateur lui-même (via profiles_select)
     - Seuls les admins peuvent mettre à jour approved (via profiles_admin_all)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'approved'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN approved boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Les comptes existants admin et directeur_commercial sont approuvés
UPDATE public.profiles
SET approved = true
WHERE role IN ('admin', 'directeur_commercial') OR actif = true;

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';

-- Adresse de dépôt du financeur, utilisée par le bouton « Mail au financeur »
-- des pièces justificatives d'un dossier (ticket Benjamin « Dossier : création
-- de mail pour financeur »). Appliquée en production le 01/09/2026 ; ce fichier
-- la verse dans le dépôt pour que la base reste reproductible.
alter table public.financeurs add column if not exists email text;

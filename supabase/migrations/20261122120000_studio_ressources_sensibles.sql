-- Studio IA — ressources sensibles (refonte, lot 1, §4.4).
-- À l'ajout d'une ressource (import du client, note d'un agent), la fonction studio
-- reconnaît RIB / IBAN, pièces d'identité, bulletins de paie et numéros de sécurité
-- sociale (supabase/functions/studio/sensible.ts) : la ressource est enregistrée
-- désactivée (actif = false) et la nature reconnue est notée ici. Le client peut
-- l'activer lui-même, après confirmation ; l'activation est tracée au journal.
-- Les ressources déjà présentes ne sont pas réexaminées par cette migration.

alter table public.studio_documents add column if not exists sensible text;
alter table public.studio_documents drop constraint if exists studio_documents_sensible_check;
alter table public.studio_documents add constraint studio_documents_sensible_check
  check (sensible is null or sensible in ('rib', 'identite', 'paie', 'securite_sociale'));

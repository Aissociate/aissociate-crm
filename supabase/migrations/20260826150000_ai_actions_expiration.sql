-- Propositions de l'assistant IA non traitées : expiration automatique.
-- Une carte « Valider / Annuler » ignorée plus de 24 h n'a plus de valeur
-- (le contexte a changé) : un cron horaire la passe en 'expiree' — elle ne
-- peut alors plus être exécutée (le mode execute exige statut = 'proposee').
alter table ai_actions drop constraint if exists ai_actions_statut_check;
alter table ai_actions add constraint ai_actions_statut_check
  check (statut in ('proposee', 'executee', 'annulee', 'erreur', 'expiree'));

do $$
begin
  perform cron.unschedule('ai-actions-expire');
exception when others then null; -- première installation : rien à désinscrire
end $$;

select cron.schedule(
  'ai-actions-expire',
  '5 * * * *',
  $$update ai_actions set statut = 'expiree' where statut = 'proposee' and created_at < now() - interval '24 hours'$$
);

-- Rattrapage immédiat des propositions déjà périmées.
update ai_actions set statut = 'expiree'
where statut = 'proposee' and created_at < now() - interval '24 hours';

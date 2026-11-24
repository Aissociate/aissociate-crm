/*
  # Messagerie : origine des e-mails sortants (humain, IA, automatique)

  Les envois faits par une IA (assistant du CRM, agents du Studio) étaient
  journalisés comme ceux d'un humain — ou pas du tout pour le Studio. Deux
  colonnes disent désormais QUI a envoyé :

    origine          'utilisateur' | 'ia_assistant' | 'ia_studio' | 'automatique'
                     (NULL = ligne ancienne ou mail entrant ; le CRM en déduit
                     « utilisateur » si owner_id est renseigné, sinon « automatique »)
    origine_libelle  nom affiché : « Assistant IA », « Léa (Studio) », « Nora (Studio) »…

  Rattrapage des étiquettes : les lignes `emails` créées par une proposition
  validée de l'assistant (ai_actions.resultat->>'entite_id') sont marquées IA.
  Rien d'autre n'est modifié.

  Prod (hors Supabase) :
    ssh root@76.13.37.71 'docker exec -i aissociate-db psql -U postgres -d aissociate -v ON_ERROR_STOP=1 --single-transaction' < supabase/migrations/20261127100000_emails_origine.sql
  puis recharger le cache de schéma de l'API (voir docs : GET sur une table inexistante après 10 s).
*/

alter table public.emails add column if not exists origine text;
alter table public.emails add column if not exists origine_libelle text;

do $$ begin
  alter table public.emails add constraint emails_origine_check
    check (origine is null or origine in ('utilisateur', 'ia_assistant', 'ia_studio', 'automatique'));
exception when duplicate_object then null; end $$;

create index if not exists idx_emails_sortants on public.emails (sent_at desc) where direction = 'sortant';

update public.emails e
   set origine = 'ia_assistant', origine_libelle = 'Assistant IA'
  from public.ai_actions a
 where a.statut = 'executee'
   and a.resultat->>'entite' = 'emails'
   and a.resultat->>'entite_id' = e.id::text
   and e.origine is null;

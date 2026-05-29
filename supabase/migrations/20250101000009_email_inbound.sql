/*
  # 09 — Messagerie entrante (réception IMAP, CDC 4.7 v2)

  Étend `emails` pour gérer les messages reçus :
    - `direction` : 'sortant' (défaut) | 'entrant'
    - `message_id`: identifiant IMAP unique (dédoublonnage des synchros)
    - `lu`        : marqueur lu/non-lu côté CRM

  Visibilité : les messages entrants (boîte partagée) sont lisibles par tous les
  utilisateurs authentifiés ; les sortants restent owner/manager (policies 06).
*/

alter table public.emails add column if not exists direction text not null default 'sortant';
alter table public.emails add column if not exists message_id text;
alter table public.emails add column if not exists lu boolean not null default false;

create unique index if not exists uq_emails_message_id
  on public.emails(message_id) where message_id is not null;

create index if not exists idx_emails_direction on public.emails(direction);

-- Lecture des messages entrants pour tous les authentifiés (boîte partagée)
drop policy if exists emails_select_inbound on public.emails;
create policy emails_select_inbound on public.emails for select to authenticated
  using (direction = 'entrant');

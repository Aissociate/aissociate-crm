/*
  # 09 — Messagerie entrante (reception IMAP, CDC 4.7 v2)

  Etend `emails` pour gerer les messages recus :
    - `direction` : 'sortant' (defaut) | 'entrant'
    - `message_id`: identifiant IMAP unique (dedoublonnage des synchros)
    - `lu`        : marqueur lu/non-lu cote CRM

  Visibilite : les messages entrants (boite partagee) sont lisibles par tous les
  utilisateurs authentifies ; les sortants restent owner/manager (policies 06).
*/

alter table public.emails add column if not exists direction text not null default 'sortant';
alter table public.emails add column if not exists message_id text;
alter table public.emails add column if not exists lu boolean not null default false;

create unique index if not exists uq_emails_message_id
  on public.emails(message_id) where message_id is not null;

create index if not exists idx_emails_direction on public.emails(direction);

drop policy if exists emails_select_inbound on public.emails;
create policy emails_select_inbound on public.emails for select to authenticated
  using (direction = 'entrant');

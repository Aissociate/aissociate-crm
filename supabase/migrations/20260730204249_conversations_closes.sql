-- Ticket Benjamin « tri mails de messagerie suivant la réponse apportée » :
-- possibilité de clore une discussion qui n'appelle pas de réponse (un refus,
-- par exemple). Une conversation n'est pas une entité stockée — elle est
-- reconstruite par interlocuteur — on mémorise donc sa clé de regroupement
-- (`contact:<id>`, `addr:<email>`, `wa:<numero>`…).
create table if not exists public.conversations_closes (
  cle         text primary key,
  closed_at   timestamptz not null default now(),
  closed_by   uuid references auth.users(id) on delete set null
);

comment on table public.conversations_closes is
  'Conversations de la Messagerie marquées « close » (aucune réponse attendue).';

alter table public.conversations_closes enable row level security;

-- Même logique de visibilité que la Messagerie : tout utilisateur connecté peut
-- lire et clore une discussion qu''il voit. La table ne contient aucune donnée
-- personnelle au-delà de la clé de regroupement.
drop policy if exists conversations_closes_select on public.conversations_closes;
create policy conversations_closes_select
  on public.conversations_closes for select to authenticated using (true);

drop policy if exists conversations_closes_insert on public.conversations_closes;
create policy conversations_closes_insert
  on public.conversations_closes for insert to authenticated with check (true);

drop policy if exists conversations_closes_delete on public.conversations_closes;
create policy conversations_closes_delete
  on public.conversations_closes for delete to authenticated using (true);

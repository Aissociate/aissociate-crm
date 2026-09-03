/*
  # Centre de notifications in-app + Realtime

  - `notifications` : une ligne par utilisateur et par événement (relances du
    jour, devis sans réponse, propositions IA en attente…). Générées par
    l'Edge Function `notifications-cron` (service role) ; chacun ne voit et ne
    modifie que les siennes.
  - `dedupe_key` : évite de recréer la même notification tant qu'elle existe
    (ex. « devis DEVIS-00012 sans réponse »).
  - Active Supabase Realtime sur `notifications`, `emails` et `tickets` pour
    remplacer les rafraîchissements par intervalle côté CRM.
*/

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'info',
  titre      text not null,
  corps      text,
  lien       text,
  dedupe_key text,
  lu         boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, lu, created_at desc);
create unique index if not exists idx_notifications_dedupe on public.notifications(user_id, dedupe_key) where dedupe_key is not null;
alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Realtime : ajout idempotent des tables à la publication Supabase.
do $$
begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.emails; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tickets; exception when duplicate_object then null; end;
exception when others then
  raise notice 'Publication realtime non modifiée (%).', sqlerrm;
end $$;

notify pgrst, 'reload schema';

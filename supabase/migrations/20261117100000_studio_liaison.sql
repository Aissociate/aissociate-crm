/*
  Studio IA — canal e-mail de liaison (vague 2 du paquet « plateforme multi-tenant »).

  Chaque espace peut recevoir une adresse dédiée (boîte AgentMail, créée depuis le CRM).
  Les utilisateurs de l'espace y écrivent leurs demandes ; l'agent désigné répond par
  e-mail dans le même fil. Les messages arrivent par webhook signé (Svix) sur la
  fonction `studio`, qui retrouve l'espace par l'identifiant de la boîte.

  1. studio_workspaces : liaison_inbox_id (boîte AgentMail), liaison_email,
     liaison_actif, liaison_agent (agent par défaut quand l'e-mail n'en désigne aucun).
  2. studio_instructions : registre des e-mails reçus (référence INSTR-AAAA-NNNN,
     type, statut traitee / quarantaine / ignoree / erreur, motif). Dédoublonnage par
     event_id (les webhooks peuvent être rejoués).

  Cloisonnement : écrit par le service role uniquement ; lecture réservée aux managers.
*/

alter table public.studio_workspaces add column if not exists liaison_inbox_id text;
alter table public.studio_workspaces add column if not exists liaison_email text;
alter table public.studio_workspaces add column if not exists liaison_actif boolean not null default false;
alter table public.studio_workspaces add column if not exists liaison_agent text references public.studio_agents(id) on delete set null;
create unique index if not exists idx_studio_workspaces_liaison on public.studio_workspaces(liaison_inbox_id) where liaison_inbox_id is not null;

create sequence if not exists public.studio_instructions_seq;

create table if not exists public.studio_instructions (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.studio_workspaces(id) on delete cascade,
  reference        text not null unique
                     default ('INSTR-' || to_char(now() at time zone 'Indian/Reunion', 'YYYY') || '-' || lpad(nextval('public.studio_instructions_seq')::text, 4, '0')),
  event_id         text not null unique,
  message_id       text,
  thread_id        text,
  expediteur       text not null,
  sujet            text not null default '',
  extrait          text not null default '',
  type             text not null default 'ORDRE',
  statut           text not null default 'recue' check (statut in ('recue', 'traitee', 'quarantaine', 'ignoree', 'erreur')),
  motif            text,
  agent_id         text references public.studio_agents(id) on delete set null,
  conversation_id  uuid references public.studio_conversations(id) on delete set null,
  livrable_id      uuid references public.studio_livrables(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_studio_instructions_ws on public.studio_instructions(workspace_id, created_at desc);
create index if not exists idx_studio_instructions_fil on public.studio_instructions(workspace_id, thread_id);
drop trigger if exists trg_studio_instructions_updated on public.studio_instructions;
create trigger trg_studio_instructions_updated before update on public.studio_instructions
  for each row execute function public.set_updated_at();
alter table public.studio_instructions enable row level security;
drop policy if exists studio_instructions_manager on public.studio_instructions;
create policy studio_instructions_manager on public.studio_instructions for select to authenticated using (public.is_manager());
revoke all on sequence public.studio_instructions_seq from anon, authenticated;

notify pgrst, 'reload schema';

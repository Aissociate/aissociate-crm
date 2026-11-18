-- Studio IA — autonomie du client : mot de passe oublié et limite d'inscriptions par adresse IP.

-- Liens « mot de passe oublié » : jeton à usage unique, valable une heure. Seul son SHA-256 est stocké.
-- Table fermée (RLS sans politique : service role seulement).
create table if not exists public.studio_reinitialisations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.studio_users(id) on delete cascade,
  jeton_hash text not null unique,
  expire_le  timestamptz not null,
  utilise_le timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_studio_reinit_user on public.studio_reinitialisations(user_id, created_at desc);
alter table public.studio_reinitialisations enable row level security;
revoke all on public.studio_reinitialisations from anon, authenticated;

-- Adresse IP de la demande : au plus 3 questionnaires par IP et par 24 h (un essai ouvre un espace
-- et envoie un e-mail). Effacée avec la demande (purge RGPD habituelle).
alter table public.studio_onboarding add column if not exists ip text;
create index if not exists idx_studio_onboarding_ip on public.studio_onboarding(ip, created_at desc) where ip is not null;

notify pgrst, 'reload schema';

-- Schémas « système » que le code et les policies attendent de Supabase,
-- réduits à ce qui est réellement utilisé (inventaire du 18/11/2026).

------------------------------------------------------------------ extensions
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pg_cron;
grant usage on schema extensions to anon, authenticated, service_role;

------------------------------------------------------------------ auth
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                  uuid primary key default gen_random_uuid(),
  aud                 text default 'authenticated',
  role                text default 'authenticated',
  email               text unique,
  encrypted_password  text,                       -- bcrypt ($2a$), repris de Supabase
  email_confirmed_at  timestamptz,
  last_sign_in_at     timestamptz,
  raw_app_meta_data   jsonb not null default '{}'::jsonb,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  banned_until        timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Jetons de rafraîchissement et jetons à usage unique (reset, lien magique) de l'API.
create table auth.refresh_tokens (
  token_hash  text primary key,                   -- sha256 du jeton, jamais le jeton
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index on auth.refresh_tokens (user_id);

create table auth.one_time_tokens (
  token_hash  text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('recovery','magiclink','signup')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

-- Mêmes fonctions que Supabase : lisent les claims posés par l'API (SET LOCAL).
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', current_user)
$$;
create function auth.email() returns text language sql stable as $$
  select auth.jwt() ->> 'email'
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

------------------------------------------------------------------ storage
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id                  text primary key,
  name                text not null unique,
  public              boolean not null default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table storage.objects (
  id                uuid primary key default gen_random_uuid(),
  bucket_id         text not null references storage.buckets(id),
  name              text not null,
  owner             uuid,
  metadata          jsonb not null default '{}'::jsonb,   -- size, mimetype, eTag…
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_accessed_at  timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select on storage.buckets to anon, authenticated, service_role;
grant all on storage.buckets to service_role;
grant all on storage.objects to authenticated, service_role;
grant select on storage.objects to anon;

------------------------------------------------------------------ vault (secrets lus par les tâches planifiées)
create schema vault;
create table vault.secrets (
  name        text primary key,
  secret      text not null,
  updated_at  timestamptz not null default now()
);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
revoke all on schema vault from public;

------------------------------------------------------------------ net (remplace pg_net)
-- net.http_post garde sa signature : la requête est mise en file et l'API
-- l'exécute (réveillée par NOTIFY). Les tâches pg_cron et le trigger LinkedIn
-- fonctionnent donc sans modification.
create schema net;
create table net.http_request_queue (
  id          bigserial primary key,
  method      text not null default 'POST',
  url         text not null,
  headers     jsonb not null default '{}'::jsonb,
  body        jsonb,
  timeout_ms  integer not null default 5000,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  status      integer,
  error       text
);

create function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
) returns bigint language plpgsql security definer set search_path = net as $$
declare v_id bigint;
begin
  insert into net.http_request_queue (method, url, headers, body, timeout_ms)
  values ('POST', url, headers, body, timeout_milliseconds)
  returning id into v_id;
  perform pg_notify('net_http', v_id::text);
  return v_id;
end $$;
grant usage on schema net to anon, authenticated, service_role;
grant execute on function net.http_post(text, jsonb, jsonb, jsonb, integer) to authenticated, service_role;

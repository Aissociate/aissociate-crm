/*
  # 01 — Socle : enums, profils, financeurs, helpers RBAC

  Ce fichier pose les fondations du CRM de gestion de dossiers de formation.

  1. Types enumeres
     - user_role : admin | directeur_commercial | conseiller (RBAC ref. CDC 4.9)
     - contact_type, financement_type, opportunite_stage, dossier_statut,
       piece_statut, candidat_statut, plan_statut

  2. Tables
     - `profiles` : 1 ligne par utilisateur auth (role, identite, actif)
     - `financeurs` : referentiel des financeurs (CPF, OPCO, France Travail...)

  3. Fonctions utilitaires (SECURITY DEFINER, contournent la RLS)
     - `auth_role()`  : role de l'utilisateur courant
     - `is_admin()`   : true si admin
     - `is_manager()` : true si admin OU directeur_commercial
     - `set_updated_at()` : trigger generique de maj du champ updated_at
     - `handle_new_user()` : cree le profil a l'inscription

  4. Securite
     - RLS activee sur profiles et financeurs (policies dans 06_rls).
*/

-- ENUMS
do $$ begin
  create type public.user_role as enum ('admin', 'directeur_commercial', 'conseiller');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contact_type as enum ('prospect', 'apprenant', 'contact_entreprise', 'contact_financeur');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.financement_type as enum (
    'cpf', 'opco', 'france_travail', 'pole_emploi', 'conseil_regional',
    'transition_pro', 'agefice', 'entreprise', 'particulier', 'autre'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.opportunite_stage as enum (
    'nouveau', 'qualifie', 'proposition', 'negociation', 'gagne', 'perdu'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dossier_statut as enum (
    'brouillon', 'montage', 'depose', 'en_instruction',
    'accorde', 'refuse', 'en_cours', 'solde', 'cloture'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.piece_statut as enum ('manquante', 'recue', 'validee', 'rejetee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.candidat_statut as enum (
    'recu', 'preselection', 'entretien', 'retenu', 'refuse', 'onboarding'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_statut as enum ('brouillon', 'valide', 'envoye', 'archive');
exception when duplicate_object then null; end $$;

-- FONCTIONS UTILITAIRES
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- TABLE profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nom         text not null default '',
  prenom      text not null default '',
  role        public.user_role not null default 'conseiller',
  telephone   text,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create or replace function public.auth_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('admin', 'directeur_commercial') from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nom, prenom, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'conseiller')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- TABLE financeurs (referentiel)
create table if not exists public.financeurs (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  nom           text not null,
  type          public.financement_type not null,
  specificites  text,
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_financeurs_updated on public.financeurs;
create trigger trg_financeurs_updated before update on public.financeurs
  for each row execute function public.set_updated_at();

alter table public.financeurs enable row level security;

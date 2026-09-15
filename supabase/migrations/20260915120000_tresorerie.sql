/*
  # Trésorerie prévisionnelle — direction uniquement

  Le pipeline « gagné » ne dit pas QUAND l'argent rentre : une affaire gagnée
  peut être encaissée en une fois, à 30/60 jours, ou étalée en plusieurs
  versements (acompte + solde, mensualités OPCO, subrogation CPF…). Ce module
  matérialise cet échéancier et le confronte aux charges.

  - `tresorerie_encaissements` : une ligne = un versement attendu. Rattachée à
    une opportunité gagnée (l'échéancier de l'affaire) ou libre
    (`opportunite_id` null : subvention, remboursement, apport…). Le lien
    passe à null si l'opportunité est supprimée : la ligne de trésorerie
    survit (le libellé est autoporteur).
  - `tresorerie_charges` : saisie 100 % libre (libellé, catégorie, montant,
    échéance) avec récurrence optionnelle. Une charge récurrente est une
    PROJECTION : ses occurrences sont calculées à l'affichage, jamais stockées
    — d'où `statut`/`date_paiement` réservés aux charges ponctuelles.
  - `tresorerie_config` : ligne unique, point de départ du solde cumulé
    (dernier solde bancaire connu + sa date).

  RLS : `is_manager()` (admin + directeur commercial) sur les trois tables, en
  lecture comme en écriture. Un conseiller ne voit rien de la trésorerie.
*/

-- ── Encaissements ───────────────────────────────────────────────────────────
create table if not exists public.tresorerie_encaissements (
  id                uuid primary key default gen_random_uuid(),
  opportunite_id    uuid references public.opportunites(id) on delete set null,
  facture_id        uuid references public.factures(id) on delete set null,
  libelle           text not null default '',
  montant           numeric(12,2) not null default 0,
  date_prevue       date not null default current_date,
  date_encaissement date,
  statut            text not null default 'prevu'
                      check (statut in ('prevu', 'encaisse', 'annule')),
  mode_reglement    text,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_tresorerie_enc_opp on public.tresorerie_encaissements(opportunite_id);
create index if not exists idx_tresorerie_enc_date on public.tresorerie_encaissements(date_prevue);
alter table public.tresorerie_encaissements enable row level security;

drop trigger if exists trg_tresorerie_enc_updated on public.tresorerie_encaissements;
create trigger trg_tresorerie_enc_updated before update on public.tresorerie_encaissements
  for each row execute function public.set_updated_at();

drop policy if exists tresorerie_enc_all on public.tresorerie_encaissements;
create policy tresorerie_enc_all on public.tresorerie_encaissements for all to authenticated
  using (is_manager()) with check (is_manager());

-- ── Charges (saisie libre) ──────────────────────────────────────────────────
create table if not exists public.tresorerie_charges (
  id             uuid primary key default gen_random_uuid(),
  libelle        text not null,
  categorie      text,
  fournisseur    text,
  montant        numeric(12,2) not null default 0,
  date_echeance  date not null default current_date,
  recurrence     text not null default 'ponctuelle'
                   check (recurrence in ('ponctuelle', 'mensuelle', 'trimestrielle', 'annuelle')),
  -- Fin de la récurrence (null = jusqu'au bout de l'horizon affiché).
  recurrence_fin date,
  statut         text not null default 'prevue'
                   check (statut in ('prevue', 'payee', 'annulee')),
  date_paiement  date,
  notes          text,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_tresorerie_charges_date on public.tresorerie_charges(date_echeance);
alter table public.tresorerie_charges enable row level security;

drop trigger if exists trg_tresorerie_charges_updated on public.tresorerie_charges;
create trigger trg_tresorerie_charges_updated before update on public.tresorerie_charges
  for each row execute function public.set_updated_at();

drop policy if exists tresorerie_charges_all on public.tresorerie_charges;
create policy tresorerie_charges_all on public.tresorerie_charges for all to authenticated
  using (is_manager()) with check (is_manager());

-- ── Point de départ du solde ────────────────────────────────────────────────
-- Ligne unique (`id` booléen contraint à true) : le solde bancaire connu à une
-- date, à partir duquel le solde cumulé du prévisionnel est calculé.
create table if not exists public.tresorerie_config (
  id            boolean primary key default true check (id),
  solde_initial numeric(12,2) not null default 0,
  date_solde    date not null default current_date,
  updated_by    uuid references public.profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);
alter table public.tresorerie_config enable row level security;

insert into public.tresorerie_config (id) values (true) on conflict (id) do nothing;

drop policy if exists tresorerie_config_all on public.tresorerie_config;
create policy tresorerie_config_all on public.tresorerie_config for all to authenticated
  using (is_manager()) with check (is_manager());

notify pgrst, 'reload schema';

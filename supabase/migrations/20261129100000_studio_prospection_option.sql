/*
  Studio IA — option « Prospection » de Sam, facturée à part (prospection_option.ts).
  - studio_prospection_contacts : registre des contacts prépayés (achat par pack, geste
    d'Aissociate, 10 contacts de découverte du Stage, consommation par recherche). Le solde
    est la somme des contacts ; il se reporte sans date limite.
  - studio_config : pack vendu (15 € HT les 1 000 contacts).
  - L'ancien plafond mensuel `prospection_fiches_mois` n'est plus lu : c'est le solde qui borne.
  Rejouable.
*/

create table if not exists public.studio_prospection_contacts (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.studio_workspaces(id) on delete cascade,
  nature         text not null check (nature in ('achat', 'offert', 'decouverte', 'correction', 'consommation')),
  contacts       integer not null,              -- positif : ajout ; négatif : fiches consommées
  prospection_id uuid references public.studio_prospections(id) on delete set null,
  prix_ht        numeric(10,2),                 -- achat : montant payé
  stripe_ref     text,                          -- session Stripe : un paiement n'est crédité qu'une fois
  acteur         text,                          -- client:email, crm:email, studio
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_studio_prospection_contacts_ws on public.studio_prospection_contacts (workspace_id, created_at desc);
create unique index if not exists studio_prospection_contacts_stripe_ref
  on public.studio_prospection_contacts (stripe_ref) where stripe_ref is not null;
-- Une seule réserve par recherche, un seul cadeau de découverte par espace.
create unique index if not exists studio_prospection_contacts_recherche
  on public.studio_prospection_contacts (prospection_id) where nature = 'consommation';
create unique index if not exists studio_prospection_contacts_decouverte
  on public.studio_prospection_contacts (workspace_id) where nature = 'decouverte';

alter table public.studio_prospection_contacts enable row level security;
drop policy if exists studio_prospection_contacts_manager on public.studio_prospection_contacts;
create policy studio_prospection_contacts_manager on public.studio_prospection_contacts for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

insert into public.studio_config (cle, valeur) values
  ('prospection_pack_prix_ht', '15'), ('prospection_pack_contacts', '1000')
on conflict (cle) do nothing;

delete from public.studio_config where cle = 'prospection_fiches_mois';

notify pgrst, 'reload schema';

-- Ticket Benjamin « ajouts de champs mails supplémentaires identifiables » :
-- deux adresses complémentaires, chacune accompagnée d'un libellé précisant le
-- service concerné (ex. « comptabilité », « service formation »).
alter table public.contacts
  add column if not exists email2 text,
  add column if not exists email2_libelle text,
  add column if not exists email3 text,
  add column if not exists email3_libelle text;
comment on column public.contacts.email2_libelle is 'À quoi correspond email2 (service, rôle…)';
comment on column public.contacts.email3_libelle is 'À quoi correspond email3 (service, rôle…)';

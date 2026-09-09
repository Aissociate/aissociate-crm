-- Destinataires en copie (CC) d'un message sortant.
--
-- La table ne portait que `destinataires` : mettre quelqu'un en copie obligeait
-- à l'ajouter aux destinataires principaux, ce qui effaçait la distinction —
-- or elle porte un sens (« pour information ») que le fil de conversation doit
-- restituer. Les adresses en copie sont visibles de tous les destinataires,
-- contrairement à une copie cachée : rien à masquer côté affichage.
alter table public.emails add column if not exists copie text[] not null default '{}';

comment on column public.emails.copie is
  'Destinataires en copie (CC) d''un message sortant ; vide pour les messages entrants.';

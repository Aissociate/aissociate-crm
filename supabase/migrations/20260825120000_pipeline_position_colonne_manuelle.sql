-- Pipeline : placement libre des cartes.
-- `position`        : ordre manuel dans la colonne (réindexé à chaque dépôt ;
--                     null = jamais placée à la main, affichée en fin de colonne).
-- `colonne_manuelle`: colonne épinglée par un glisser-déposer. Tant qu'elle est
--                     nulle, la colonne reste calculée (stand-by automatique
--                     selon les actions du contact) ; une fois posée à la main,
--                     la carte reste où l'utilisateur l'a mise.
alter table opportunites
  add column if not exists position double precision,
  add column if not exists colonne_manuelle text
    check (colonne_manuelle in ('nouveau','qualifie','proposition','negociation','gagne','perdu','standby30','standby90'));

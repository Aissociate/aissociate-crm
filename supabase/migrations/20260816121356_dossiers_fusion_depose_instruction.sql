-- Ticket Benjamin « type dans statut du dossier » : une fois le dossier déposé,
-- rien ne permet de savoir si le financeur a ouvert l'instruction. Les deux
-- statuts sont fusionnés sous « depose ».
-- La valeur « en_instruction » reste dans le type (données historiques) mais
-- n'est plus proposée à la saisie.
update public.dossiers set statut = 'depose' where statut = 'en_instruction';

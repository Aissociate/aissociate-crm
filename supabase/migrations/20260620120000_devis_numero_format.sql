/*
  # Format de numéro de devis : DV-AAAA-NNNN (ticket Benjamin)

  Avant : « DEVIS-00001 » → affiché « DEVIS N° DEVIS-00001 » (redondance).
  Après : « DV-2026-0002 » → « DEVIS N° DV-2026-0002 ». La séquence devis_seq
  est conservée (numérotation continue), préfixée de l'année courante.
*/

alter table public.devis
  alter column numero set default ('DV-' || to_char(now(), 'YYYY') || '-' || lpad((nextval('devis_seq'::regclass))::text, 4, '0'));

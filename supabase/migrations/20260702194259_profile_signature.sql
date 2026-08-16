-- Signature d'e-mail propre à chaque utilisateur (ajoutée à ses e-mails sortants,
-- à la place du préfixe nom/coordonnées générique). Gérée dans Paramètres.
alter table public.profiles add column if not exists signature text;

notify pgrst, 'reload schema';

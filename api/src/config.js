function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: required('JWT_SECRET'),
  db: {
    host: process.env.PGHOST ?? 'aissociate-db',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? 'aissociate',
    user: 'authenticator',
    password: required('AUTHENTICATOR_PASSWORD'),
    max: Number(process.env.PG_POOL_MAX ?? 10),
  },
  // Même plafond que Supabase (db-max-rows) : le front peut en dépendre.
  maxRows: Number(process.env.MAX_ROWS ?? 1000),
  // Mêmes délais que Supabase par rôle (ms).
  statementTimeout: { anon: 3000, authenticated: 8000, service_role: 120000 },
  bodyLimit: 20 * 1024 * 1024,
  storage: {
    dir: process.env.STORAGE_DIR ?? '/data/storage',
    // Plafond global par fichier ; chaque bucket peut imposer plus petit.
    maxFileSize: Number(process.env.STORAGE_MAX_FILE_SIZE ?? 110 * 1024 * 1024),
    maxSignedUrlSeconds: 365 * 24 * 3600,
  },
  auth: {
    // Rôle Postgres limité au schéma auth (et à la lecture de la config SMTP).
    db: {
      host: process.env.PGHOST ?? 'aissociate-db',
      port: Number(process.env.PGPORT ?? 5432),
      database: process.env.PGDATABASE ?? 'aissociate',
      user: 'auth_admin',
      password: required('AUTH_ADMIN_PASSWORD'),
      max: 4,
    },
    siteUrl: process.env.SITE_URL ?? 'https://aissociate.re',
    // Origines autorisées pour les redirections (liens de réinitialisation).
    redirectOrigins: (process.env.REDIRECT_ORIGINS ?? 'https://aissociate.re,https://preprod.aissociate.re').split(',').map((s) => s.trim()).filter(Boolean),
    // URL publique de l'API, utilisée dans les liens envoyés par e-mail.
    externalUrl: process.env.API_EXTERNAL_URL ?? 'https://api.aissociate.re',
    allowSignup: (process.env.ALLOW_SIGNUP ?? 'true') === 'true',
    passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH ?? 6),
    accessTokenTtl: 3600,
    refreshTokenTtlDays: 60,
    oneTimeTokenTtlMinutes: 60,
    // Tolérance de réutilisation d'un jeton de rafraîchissement (onglets concurrents).
    refreshReuseSeconds: 10,
  },
};

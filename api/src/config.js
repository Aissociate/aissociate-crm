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
  // Appels HTTP mis en file par la base (net.http_post : tâches planifiées, triggers).
  net: {
    // Désactivé tant que la production tourne sur Supabase : sinon les e-mails,
    // newsletters et publications partiraient en double.
    enabled: (process.env.NET_WORKER_ENABLED ?? 'false') === 'true',
    // Seules les URL de notre propre API sont appelées (pas de requête vers l'extérieur).
    internalUrl: `http://127.0.0.1:${Number(process.env.PORT ?? 3000)}`,
  },
  realtime: {
    maxConnections: 500,
    maxChannelsPerSocket: 30,
    idleMs: 90_000,
  },
  functions: {
    url: process.env.FUNCTIONS_URL ?? 'http://aissociate-functions:8000',
    // Fonctions publiques (verify_jwt = false chez Supabase au 18/11/2026).
    noVerifyJwt: new Set((process.env.FUNCTIONS_NO_VERIFY_JWT ?? 'mcp,studio,signature,chatbot,sitemap-blog,generate-article,studio-demo,linkedin-oauth,qualiopi-cron,newsletter-unsubscribe').split(',').map((s) => s.trim()).filter(Boolean)),
    timeoutMs: Number(process.env.FUNCTIONS_TIMEOUT_MS ?? 400_000),
    bodyLimit: 60 * 1024 * 1024,
  },
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
    // Inscription publique fermée par défaut : les comptes sont créés avec la clé de service.
    allowSignup: (process.env.ALLOW_SIGNUP ?? 'false') === 'true',
    passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH ?? 6),
    accessTokenTtl: 3600,
    refreshTokenTtlDays: 60,
    oneTimeTokenTtlMinutes: 60,
    // Tolérance de réutilisation d'un jeton de rafraîchissement (onglets concurrents).
    refreshReuseSeconds: 10,
  },
};

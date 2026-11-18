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
};

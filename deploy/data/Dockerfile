# Postgres 17 (même version majeure que Supabase) + pg_cron.
FROM postgres:17-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-17-cron \
 && rm -rf /var/lib/apt/lists/*
COPY init/ /docker-entrypoint-initdb.d/

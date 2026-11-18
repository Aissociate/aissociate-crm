# Fonctions serveur : Deno 2 + le code de supabase/functions, inchangé.
# Contexte de build : la racine du repo.
FROM denoland/deno:2.1.4
WORKDIR /app
COPY functions-runtime/main.ts ./main.ts
COPY supabase/functions ./functions
# Dépendances npm téléchargées à la construction (y compris les imports dynamiques),
# pour un démarrage sans accès réseau aux registres.
RUN find functions -mindepth 2 -maxdepth 2 -name index.ts | sort | xargs deno cache main.ts \
 && deno cache npm:unpdf@0.12.1 npm:xlsx@0.18.5 npm:mammoth@1.8.0 npm:docx@9.0.2
USER deno
EXPOSE 8000
# Mêmes limites que le runtime Supabase : réseau et variables d'environnement,
# lecture du code seulement, écriture dans /tmp, aucun lancement de processus.
CMD ["run", "--no-prompt", "--cached-only", "--allow-net", "--allow-env", "--allow-sys", "--allow-read=/app,/tmp,/deno-dir", "--allow-write=/tmp", "--v8-flags=--max-old-space-size=384", "main.ts"]

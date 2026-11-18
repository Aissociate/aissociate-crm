# Fonctions serveur : Deno 2 + le code de supabase/functions, inchangé.
# Contexte de build : la racine du repo.
FROM denoland/deno:2.1.4
WORKDIR /app
COPY functions-runtime/main.ts ./main.ts
COPY supabase/functions ./functions
# Dépendances npm : une seule résolution pour tout le code (imports statiques et
# dynamiques), figée dans deno.lock et réutilisée à l'exécution, sans accès réseau.
RUN echo '{ "nodeModulesDir": "none" }' > deno.json  && deno cache main.ts       $(find functions -mindepth 2 -maxdepth 2 -name index.ts | sort)       $(grep -rhoE "npm:@?[a-zA-Z0-9._-]+(/[a-zA-Z0-9._-]+)?@[0-9][a-zA-Z0-9._-]*(/[a-zA-Z0-9._/-]+)?" functions --include=*.ts | sort -u)  && test -s deno.lock
USER deno
EXPOSE 8000
# Mêmes limites que le runtime Supabase : réseau et variables d'environnement,
# lecture du code seulement, écriture dans /tmp, aucun lancement de processus.
CMD ["run", "--no-prompt", "--cached-only", "--frozen", "--allow-net", "--allow-env", "--allow-sys", "--allow-read=/app,/tmp,/deno-dir", "--allow-write=/tmp", "--v8-flags=--max-old-space-size=384", "main.ts"]

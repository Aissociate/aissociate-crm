# Fonctions serveur : Deno 2 + le code de supabase/functions, inchangé.
# Contexte de build : la racine du repo.
FROM denoland/deno:2.1.4
WORKDIR /app
COPY functions-runtime/main.ts ./main.ts
COPY supabase/functions ./functions
# Dépendances npm : une seule résolution pour tout le code (imports statiques et
# dynamiques), figée dans deno.lock et réutilisée à l'exécution, sans accès réseau.
RUN echo '{ "nodeModulesDir": "none" }' > deno.json  && deno cache main.ts       $(find functions -mindepth 2 -maxdepth 2 -name index.ts | sort)       $(grep -rhoE "npm:@?[a-zA-Z0-9._-]+(/[a-zA-Z0-9._-]+)?@[0-9][a-zA-Z0-9._-]*(/[a-zA-Z0-9._/-]+)?" functions --include=*.ts | sort -u)  && test -s deno.lock  && chmod -R a+rX /app /deno-dir
# Certains paquets npm s'extraient avec des fichiers illisibles par un autre
# utilisateur que root : sans ce chmod, le serveur s'arrête au démarrage
# (« Permission denied (os error 13) ») en utilisateur deno.
USER deno
# Contrôle à la construction, dans les conditions du conteneur (utilisateur deno,
# mêmes options que CMD) : une image qui ne démarre pas ne sort jamais du build.
RUN (deno run --no-prompt --cached-only --frozen --allow-net --allow-env --allow-sys       --allow-read=/app,/tmp,/deno-dir --allow-write=/tmp main.ts &)  && for i in $(seq 1 20); do sleep 1;       deno eval "const r = await fetch('http://127.0.0.1:8000/_health'); Deno.exit(r.ok ? 0 : 1)" 2>/dev/null && exit 0;     done; echo "Le serveur des fonctions ne répond pas sur /_health" >&2; exit 1
EXPOSE 8000
# Mêmes limites que le runtime Supabase : réseau et variables d'environnement,
# lecture du code seulement, écriture dans /tmp, aucun lancement de processus.
CMD ["run", "--no-prompt", "--cached-only", "--frozen", "--allow-net", "--allow-env", "--allow-sys", "--allow-read=/app,/tmp,/deno-dir", "--allow-write=/tmp", "--v8-flags=--max-old-space-size=384", "main.ts"]

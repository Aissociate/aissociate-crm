#!/usr/bin/env bash
# Sauvegarde quotidienne : base complète (pg_dump) + fichiers du stockage.
# Installé en /usr/local/bin/aissociate-backup, lancé par /etc/cron.d/aissociate-backup.
# ⚠ Ces sauvegardes restent sur le VPS : elles protègent d'une erreur de
#   manipulation, pas de la perte du serveur. Une copie hors du VPS reste à brancher.
set -euo pipefail
umask 077
DEST=/opt/aissociate-data/backups/daily
KEEP_DB=14      # jours de sauvegardes de base conservés
KEEP_FILES=7    # archives de fichiers conservées
STAMP=$(date -u +%Y%m%d-%H%M)
mkdir -p "$DEST"

# Base : format « custom », tous les schémas (public, auth, storage, vault, net, cron).
docker exec aissociate-db pg_dump -U postgres -d aissociate -Fc > "$DEST/base-$STAMP.dump.tmp"
docker exec -i aissociate-db pg_restore -l < "$DEST/base-$STAMP.dump.tmp" > /dev/null   # archive lisible ?
mv "$DEST/base-$STAMP.dump.tmp" "$DEST/base-$STAMP.dump"

# Fichiers : archive du volume de stockage.
docker run --rm -v aissociate-storage:/data:ro -v "$DEST:/out" alpine:3.20 \
  tar -czf "/out/fichiers-$STAMP.tar.gz.tmp" --exclude=.tmp -C /data .
mv "$DEST/fichiers-$STAMP.tar.gz.tmp" "$DEST/fichiers-$STAMP.tar.gz"

ls -1t "$DEST"/base-*.dump 2>/dev/null | tail -n +$((KEEP_DB + 1)) | xargs -r rm -f
ls -1t "$DEST"/fichiers-*.tar.gz 2>/dev/null | tail -n +$((KEEP_FILES + 1)) | xargs -r rm -f
echo "$(date -u +%FT%TZ) sauvegarde ok : base $(du -h "$DEST/base-$STAMP.dump" | cut -f1), fichiers $(du -h "$DEST/fichiers-$STAMP.tar.gz" | cut -f1)"

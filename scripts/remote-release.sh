#!/usr/bin/env bash
set -euo pipefail

TAG="${1:?Usage: remote-release.sh TAG}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/equipment}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${HOME}/equipment-backups"
BACKUP_FILE="${BACKUP_DIR}/equipment-backup-${TAG}-${TIMESTAMP}.sql"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

cd "$DEPLOY_PATH"

mkdir -p "$BACKUP_DIR"

echo "Backing up database to ${BACKUP_FILE}"
$COMPOSE exec -T postgres pg_dump -U equipment equipment > "$BACKUP_FILE"

echo "Checking out tag ${TAG}"
git fetch --tags origin
git checkout "$TAG"

export IMAGE_TAG="$TAG"

echo "Pulling images and restarting"
$COMPOSE pull
$COMPOSE up -d

echo "Waiting for health check"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
    echo "Health OK"
    exit 0
  fi
  sleep 2
done

echo "Health check failed after deploy of ${TAG}"
exit 1

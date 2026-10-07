#!/bin/sh
# Production entrypoint: verify the persistent volume, migrate, boot tasks, serve.
set -e

DB_PATH="${DATABASE_URL#file:}"
DB_DIR="$(dirname "$DB_PATH")"

echo "[start] DATABASE_URL=$DATABASE_URL"

# Guard against silently running on the container's ephemeral filesystem.
if [ "${ALLOW_EPHEMERAL_DB:-false}" != "true" ]; then
  case "$DB_PATH" in
    /data/*) ;;
    *) echo "[start] ERROR: production DATABASE_URL must point into /data (persistent volume). Got: $DB_PATH"; exit 1 ;;
  esac
  if ! grep -qs " /data " /proc/mounts; then
    echo "[start] ERROR: /data is not a mounted volume — data would be lost on restart."
    echo "[start]        Create one with: fly volumes create buyur_data --size 1 --region <region>"
    echo "[start]        (set ALLOW_EPHEMERAL_DB=true only for throwaway test machines)"
    exit 1
  fi
fi

mkdir -p "$DB_DIR"

echo "[start] applying migrations…"
npx prisma migrate deploy

echo "[start] boot tasks…"
node scripts/boot.mjs

echo "[start] starting Next.js on port ${PORT:-3000}"
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"

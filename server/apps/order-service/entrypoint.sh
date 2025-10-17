#!/bin/sh
set -e

# wait for Postgres
echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "Postgres is ready - running migrations (if any) and starting app"
# nếu có migration: npm run migrate
# npm run migrate || true

exec "$@"



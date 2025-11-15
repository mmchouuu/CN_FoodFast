#!/bin/sh
set -e

# Provide sane defaults when env vars are missing (e.g. local docker up)
DB_HOST=${DB_HOST:-paymentdb}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-paymentdb}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-123}
export PGPASSWORD="$DB_PASSWORD"

# wait for Postgres
echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "Postgres is ready - running migrations (if any) and starting app"
# nếu có migration: npm run migrate
# npm run migrate || true

exec node src/index.js

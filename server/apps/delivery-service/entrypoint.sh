#!/bin/sh
set -e

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "Postgres is ready - starting Product Service"
exec node server.js

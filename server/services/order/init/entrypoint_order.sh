#!/bin/bash
set -e

echo "Seeding Product DB..."

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
\i /docker-entrypoint-initdb.d/1_orders_init.sql
\i /docker-entrypoint-initdb.d/2_seed_orders.sql
EOSQL

echo "Product DB seed completed."

exec postgres

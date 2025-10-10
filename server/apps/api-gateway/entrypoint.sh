#!/bin/sh
set -e

echo "Starting API Gateway..."

exec node src/index.js

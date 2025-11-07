#!/bin/sh
set -e

echo "Starting API Gateway..."

if [ "${GATEWAY_HTTPS_ENABLED}" = "true" ]; then
  CERT_PATH=${GATEWAY_SSL_CERT_PATH:-/app/certs/gateway.pem}
  KEY_PATH=${GATEWAY_SSL_KEY_PATH:-/app/certs/gateway-key.pem}
  SUBJECT=${GATEWAY_SSL_SUBJECT:-/CN=localhost}
  DAYS_VALID=${GATEWAY_SSL_DAYS:-365}

  if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "[api-gateway] TLS files missing. Generating self-signed certificate..."
    mkdir -p "$(dirname "$CERT_PATH")"
    mkdir -p "$(dirname "$KEY_PATH")"
    openssl req -x509 -nodes -newkey rsa:2048 \
      -keyout "$KEY_PATH" \
      -out "$CERT_PATH" \
      -days "$DAYS_VALID" \
      -subj "$SUBJECT"
    echo "[api-gateway] Self-signed certificate created at $CERT_PATH"
  fi
fi

exec node src/index.js

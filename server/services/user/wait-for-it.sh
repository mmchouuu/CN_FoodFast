#!/usr/bin/env bash
# wait-for-it.sh: script để chờ service (DB, MQ, ...) sẵn sàng trước khi chạy app
# Usage: ./wait-for-it.sh host:port [-t timeout] -- command args...

set -e

HOSTPORT="$1"
shift
TIMEOUT=30
QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    -q|--quiet)
      QUIET=1
      shift
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

HOST=$(echo $HOSTPORT | cut -d: -f1)
PORT=$(echo $HOSTPORT | cut -d: -f2)

if [[ -z "$HOST" || -z "$PORT" ]]; then
  echo "Usage: $0 host:port [-t timeout] -- command args..."
  exit 1
fi

end_time=$(( $(date +%s) + TIMEOUT ))

while true; do
  nc -z "$HOST" "$PORT" >/dev/null 2>&1
  result=$?
  if [[ $result -eq 0 ]]; then
    break
  fi
  now=$(date +%s)
  if [[ $now -ge $end_time ]]; then
    echo "Timeout waiting for $HOST:$PORT"
    exit 1
  fi
  sleep 1
done

if [[ $QUIET -ne 1 ]]; then
  echo "$HOST:$PORT is available!"
fi

exec "$@"

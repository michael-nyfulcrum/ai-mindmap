#!/usr/bin/env bash
set -euo pipefail

warn() {
  echo "WARN: $*" >&2
}

load_dotenv_defaults() {
  [ -f .env ] || return 0

  while IFS='=' read -r key value || [ -n "$key" ]; do
    case "$key" in
      ""|\#*) continue ;;
    esac

    if ! [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi

    if [ -z "${!key+x}" ]; then
      value="${value%$'\r'}"
      value="${value#\"}"
      value="${value%\"}"
      value="${value#\'}"
      value="${value%\'}"
      export "$key=$value"
    fi
  done < .env
}

./scripts/env-check.sh demo
docker compose -f compose.yml -f compose.demo.yml config >/dev/null
load_dotenv_defaults

echo "Docker:"
docker --version
docker compose version

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not reachable for the current user." >&2
  exit 1
fi

echo "Compose project:"
docker compose -f compose.yml -f compose.demo.yml config --services

echo "DNS:"
if command -v getent >/dev/null 2>&1; then
  if ! getent ahosts "$DEMO_SITE_ADDRESS" | awk 'NR <= 4 {print}'; then
    warn "DNS lookup did not resolve $DEMO_SITE_ADDRESS from this machine yet."
  fi
else
  warn "getent is unavailable; skipping DNS lookup."
fi

echo "Port listeners:"
if command -v ss >/dev/null 2>&1; then
  ss -tln '( sport = :80 or sport = :443 )' || true
else
  warn "ss is unavailable; skipping port listener check."
fi

echo "Disk:"
df -h .

echo "Server preflight passed for $DEMO_SITE_ADDRESS."

#!/usr/bin/env bash
set -euo pipefail

warn() {
  echo "WARN: $*" >&2
}

collect_local_ips() {
  {
    hostname -I 2>/dev/null || true
    ip -o -4 addr show 2>/dev/null | awk '{split($4, parts, "/"); print parts[1]}' || true
    if command -v curl >/dev/null 2>&1; then
      curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || true
      echo
    fi
  } | tr ' ' '\n' | sed '/^$/d' | sort -u
}

collect_dns_ips() {
  if command -v getent >/dev/null 2>&1; then
    getent ahostsv4 "$DEMO_SITE_ADDRESS" | awk '{print $1}' | sort -u
  fi
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

./scripts/env-check.sh live
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
dns_ips="$(collect_dns_ips)"
if command -v getent >/dev/null 2>&1; then
  if ! getent ahosts "$DEMO_SITE_ADDRESS" | awk 'NR <= 4 {print}'; then
    warn "DNS lookup did not resolve $DEMO_SITE_ADDRESS from this machine yet."
  fi
else
  warn "getent is unavailable; skipping DNS lookup."
fi

if [ "${SKIP_DNS_LOCAL_CHECK:-}" != "1" ]; then
  local_ips="$(collect_local_ips)"
  if [ -n "$dns_ips" ] && [ -n "$local_ips" ]; then
    dns_matches_local="0"
    while IFS= read -r dns_ip; do
      if printf '%s\n' "$local_ips" | grep -Fxq "$dns_ip"; then
        dns_matches_local="1"
        break
      fi
    done <<EOF
$dns_ips
EOF

    if [ "$dns_matches_local" != "1" ]; then
      echo "DNS for $DEMO_SITE_ADDRESS does not point at this host." >&2
      echo "Resolved DNS IPs:" >&2
      printf '  %s\n' $dns_ips >&2
      echo "Local/public IPs seen from this host:" >&2
      printf '  %s\n' $local_ips >&2
      echo "Run live deployment on the target server, use the correct Docker context, or set SKIP_DNS_LOCAL_CHECK=1 only if this mismatch is expected." >&2
      exit 1
    fi
  else
    warn "Could not compare DNS and local IPs; set SKIP_DNS_LOCAL_CHECK=1 to silence this check if needed."
  fi
fi

echo "Port listeners:"
if command -v ss >/dev/null 2>&1; then
  ss -tln '( sport = :80 or sport = :443 )' || true
else
  warn "ss is unavailable; skipping port listener check."
fi

echo "Disk:"
df -h .

echo "Live server preflight passed for $DEMO_SITE_ADDRESS."

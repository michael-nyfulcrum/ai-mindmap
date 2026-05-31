#!/usr/bin/env bash
set -euo pipefail

compose_command="${COMPOSE:-docker compose}"
compose_files="${COMPOSE_FILES:--f compose.yml -f compose.demo.yml}"

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

read -r -a compose_parts <<< "$compose_command"
read -r -a compose_file_parts <<< "$compose_files"

load_dotenv_defaults
base_url="${BASE_URL:-https://${DEMO_SITE_ADDRESS:?Set DEMO_SITE_ADDRESS}}"

echo "Live URL: ${base_url}"
echo

echo "Health:"
curl -fsS "${base_url}/health"
echo
echo

echo "DNS and host:"
dns_ips=""
if command -v getent >/dev/null 2>&1; then
  dns_ips="$(getent ahostsv4 "$DEMO_SITE_ADDRESS" | awk '{print $1}' | sort -u)"
  printf '%s\n' "$dns_ips" | sed '/^$/d; s/^/DNS /'
else
  echo "DNS lookup unavailable: getent is not installed"
fi
if command -v curl >/dev/null 2>&1; then
  public_ip="$(curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  [ -z "$public_ip" ] || echo "Public IP ${public_ip}"
  if [ -n "$public_ip" ] && [ -n "$dns_ips" ] && ! printf '%s\n' "$dns_ips" | grep -Fxq "$public_ip"; then
    echo "WARN: DNS does not match this host's public IP; container output is for the current Docker context."
  fi
fi
echo

echo "Containers:"
"${compose_parts[@]}" "${compose_file_parts[@]}" ps
echo

echo "Disk:"
df -h .
echo

echo "Docker volumes:"
docker volume ls --filter label=com.docker.compose.project=context-canvas
echo

echo "Recent logs:"
"${compose_parts[@]}" "${compose_file_parts[@]}" logs --tail=80

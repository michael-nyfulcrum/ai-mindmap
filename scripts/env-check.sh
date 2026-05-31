#!/usr/bin/env bash
set -euo pipefail

mode="${1:-local}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_env() {
  name="$1"
  value="${!name:-}"
  if [ -z "$value" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
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

require_command docker

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required: docker compose version failed" >&2
  exit 1
fi

case "$mode" in
  local)
    require_command pnpm
    require_command uv
    echo "Local toolchain is ready."
    ;;
  demo|live)
    load_dotenv_defaults

    require_env DEMO_SITE_ADDRESS
    require_env OPENAI_API_KEY

    case "$DEMO_SITE_ADDRESS" in
      demo.example.com)
        echo "Replace DEMO_SITE_ADDRESS=demo.example.com with your real demo domain." >&2
        exit 1
        ;;
      http://*|https://*|*/*)
        echo "DEMO_SITE_ADDRESS must be a bare hostname, for example 7865420.xyz, not '$DEMO_SITE_ADDRESS'." >&2
        exit 1
        ;;
      :*|localhost*|127.*)
        echo "DEMO_SITE_ADDRESS must be a public DNS name, not '$DEMO_SITE_ADDRESS'." >&2
        exit 1
        ;;
    esac

    if [ "${DOCKER_CONTEXT_CANVAS_CORS_ORIGINS:-}" = "http://localhost:8080,http://127.0.0.1:8080" ]; then
      echo "Set DOCKER_CONTEXT_CANVAS_CORS_ORIGINS=https://$DEMO_SITE_ADDRESS for demo deploys." >&2
      exit 1
    fi
    case ",${DOCKER_CONTEXT_CANVAS_CORS_ORIGINS:-}," in
      *",https://$DEMO_SITE_ADDRESS,"*) ;;
      *)
        echo "DOCKER_CONTEXT_CANVAS_CORS_ORIGINS must include https://$DEMO_SITE_ADDRESS." >&2
        exit 1
        ;;
    esac

    echo "Live environment is ready for $DEMO_SITE_ADDRESS."
    ;;
  *)
    echo "Unknown env-check mode: $mode" >&2
    exit 1
    ;;
esac

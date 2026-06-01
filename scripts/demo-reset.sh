#!/usr/bin/env bash
set -euo pipefail

# Reset the live demo back to an empty project list before a presentation.
#
# Backs up current data, wipes the SQLite database and uploads in the shared
# Docker volume, restarts the stack, and verifies that /api/projects is empty.
# Because CONTEXT_CANVAS_SEED_DEMO=0, the API recreates an empty database on
# start, so the project picker comes up clean.
#
# Run on the live server, or through a Docker context that points at it.
#
#   ./scripts/demo-reset.sh             # prompts for confirmation
#   FORCE=1 ./scripts/demo-reset.sh     # skip the prompt (rehearsed runs)
#   SKIP_BACKUP=1 ./scripts/demo-reset.sh
#
# Honors the same COMPOSE / COMPOSE_FILES / BASE_URL / DEMO_SITE_ADDRESS
# environment as the other live scripts. `make demo-reset` wires the live
# Compose files automatically.

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
compose=( "${compose_parts[@]}" "${compose_file_parts[@]}" )

load_dotenv_defaults
base_url="${BASE_URL:-${DEMO_SITE_ADDRESS:+https://${DEMO_SITE_ADDRESS}}}"

target_label="${base_url:-the local Docker stack}"

if [ "${FORCE:-0}" != "1" ]; then
  echo "This DELETES all projects, canvas history, and uploads on:"
  echo "  ${target_label}"
  printf 'Type "reset" to continue: '
  read -r reply
  [ "$reply" = "reset" ] || { echo "Aborted."; exit 1; }
fi

if [ "${SKIP_BACKUP:-0}" != "1" ]; then
  echo "Backing up current data first..."
  COMPOSE="$compose_command" COMPOSE_FILES="$compose_files" ./scripts/docker-backup-data.sh
fi

echo "Stopping api and mcp..."
"${compose[@]}" stop api mcp

echo "Wiping database and uploads in the shared volume..."
"${compose[@]}" run --rm --no-deps -T --entrypoint sh api -c \
  'rm -f /data/context-canvas.sqlite /data/context-canvas.sqlite-wal /data/context-canvas.sqlite-shm; rm -rf /data/uploads; mkdir -p /data/uploads'

echo "Starting the stack..."
"${compose[@]}" up -d

if [ -n "${base_url:-}" ]; then
  echo "Verifying ${base_url}/api/projects is empty..."
  projects="$(curl -fsS --retry 15 --retry-delay 2 --retry-connrefused "${base_url}/api/projects")"
  echo "$projects"
  if printf '%s' "$projects" | grep -q '"projects":\[\]'; then
    echo "Demo reset complete: project list is empty."
  else
    echo "WARN: project list is not empty after reset." >&2
    exit 1
  fi
else
  echo "Demo reset complete. Set BASE_URL or DEMO_SITE_ADDRESS to auto-verify."
fi

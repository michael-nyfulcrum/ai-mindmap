#!/usr/bin/env bash
set -euo pipefail

package_path="${1:-}"

if [ -z "$package_path" ]; then
  package_path="$(ls -t dist/packages/*.tar.gz 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$package_path" ] || [ ! -f "$package_path" ]; then
  echo "No package archive found. Run make package first." >&2
  exit 1
fi

listing="$(mktemp)"
trap 'rm -f "$listing"' EXIT
tar -tzf "$package_path" > "$listing"

require_entry() {
  if ! grep -Fxq "$1" "$listing"; then
    echo "Package is missing required entry: $1" >&2
    exit 1
  fi
}

reject_entry() {
  pattern="$1"
  if grep -Eq "$pattern" "$listing"; then
    echo "Package contains excluded entry matching: $pattern" >&2
    grep -E "$pattern" "$listing" >&2
    exit 1
  fi
}

require_entry "./.env.example"
require_entry "./.env.demo.example"
require_entry "./.dockerignore"
require_entry "./Dockerfile"
require_entry "./Makefile"
require_entry "./compose.yml"
require_entry "./compose.demo.yml"
require_entry "./infra/caddy/Caddyfile"
require_entry "./infra/caddy/Dockerfile"
require_entry "./scripts/docker-smoke.sh"
require_entry "./scripts/docker-backup-data.sh"
require_entry "./scripts/env-check.sh"
require_entry "./scripts/install-server-deps.sh"
require_entry "./scripts/package-release.sh"

reject_entry '(^|/)\.env$'
reject_entry '(^|/)node_modules(/|$)'
reject_entry '(^|/)\.venv(/|$)'
reject_entry '(^|/)\.uv-cache(/|$)'
reject_entry '\.sqlite(-shm|-wal)?$'
reject_entry '(^|/)uploads(/|$)'

echo "Package verified: $package_path"

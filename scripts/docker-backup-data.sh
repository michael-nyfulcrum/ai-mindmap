#!/usr/bin/env bash
set -euo pipefail

compose_command="${COMPOSE:-docker compose}"
compose_files="${COMPOSE_FILES:--f compose.yml}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_dir="${BACKUP_DIR:-dist/backups}"
archive_path="${output_dir}/context-canvas-data-${timestamp}.tar.gz"

mkdir -p "$output_dir"

read -r -a compose_parts <<< "$compose_command"
read -r -a compose_file_parts <<< "$compose_files"

"${compose_parts[@]}" "${compose_file_parts[@]}" exec -T api sh -s > "$archive_path" <<'SH'
set -eu

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

.venv/bin/python - "$tmp_dir/context-canvas.sqlite" <<'PY'
from pathlib import Path
import sqlite3
import sys

source = Path("/data/context-canvas.sqlite")
if not source.exists():
    raise SystemExit("missing /data/context-canvas.sqlite")

destination = Path(sys.argv[1])
src = sqlite3.connect(source)
dst = sqlite3.connect(destination)
src.backup(dst)
dst.close()
src.close()
PY

if [ -d /data/uploads ]; then
  cp -a /data/uploads "$tmp_dir/uploads"
else
  mkdir -p "$tmp_dir/uploads"
fi

tar -C "$tmp_dir" -czf - .
SH

echo "$archive_path"

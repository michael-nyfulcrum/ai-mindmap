#!/usr/bin/env bash
set -euo pipefail

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_dir="${PACKAGE_DIR:-dist/packages}"
package_name="${PACKAGE_NAME:-context-canvas-demo-${timestamp}.tar.gz}"
package_path="${output_dir}/${package_name}"

mkdir -p "${output_dir}"

tar \
  --exclude='./.git' \
  --exclude='./.venv' \
  --exclude='./.uv-cache' \
  --exclude='./node_modules' \
  --exclude='./**/node_modules' \
  --exclude='./apps/web/dist' \
  --exclude='./dist/packages' \
  --exclude='./.env' \
  --exclude='./.env.local' \
  --exclude='./.env.production' \
  --exclude='./.env.development' \
  --exclude='./*.sqlite' \
  --exclude='./*.sqlite-shm' \
  --exclude='./*.sqlite-wal' \
  --exclude='./uploads' \
  --exclude='./services/api/uploads' \
  --exclude='./services/api/context-canvas.sqlite' \
  --exclude='./services/api/context-canvas.sqlite-shm' \
  --exclude='./services/api/context-canvas.sqlite-wal' \
  -czf "${package_path}" .

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${package_path}" > "${package_path}.sha256"
fi

echo "${package_path}"

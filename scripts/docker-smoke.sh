#!/usr/bin/env bash
set -euo pipefail

base_url="${BASE_URL:-http://127.0.0.1:${APP_PORT:-8080}}"

echo "Checking ${base_url}/health"
curl -fsS "${base_url}/health" | grep -q '"status":"ok"'

echo "Checking ${base_url}/api/projects"
curl -fsS "${base_url}/api/projects" | grep -q '"projects"'

echo "Checking web app shell"
curl -fsS "${base_url}/" | grep -q '<div id="root"></div>'

echo "Docker smoke checks passed for ${base_url}"

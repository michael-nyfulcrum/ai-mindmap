#!/usr/bin/env bash
set -euo pipefail

base_url="${BASE_URL:-http://127.0.0.1:${APP_PORT:-8080}}"
curl_args=(-fsS --retry 10 --retry-delay 2 --retry-connrefused)

echo "Checking ${base_url}/health"
curl "${curl_args[@]}" "${base_url}/health" | grep -q '"status":"ok"'

echo "Checking ${base_url}/api/projects"
curl "${curl_args[@]}" "${base_url}/api/projects" | grep -q '"projects"'

echo "Checking web app shell"
curl "${curl_args[@]}" "${base_url}/" | grep -q '<div id="root"></div>'

echo "Docker smoke checks passed for ${base_url}"

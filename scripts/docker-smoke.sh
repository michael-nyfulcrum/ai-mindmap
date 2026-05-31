#!/usr/bin/env bash
set -euo pipefail

base_url="${BASE_URL:-http://127.0.0.1:${APP_PORT:-8080}}"
curl_args=(-fsS --retry 10 --retry-delay 2 --retry-connrefused)

echo "Checking ${base_url}/health"
curl "${curl_args[@]}" "${base_url}/health" | grep -q '"status":"ok"'

echo "Checking ${base_url}/api/projects"
curl "${curl_args[@]}" "${base_url}/api/projects" | grep -q '"projects"'

echo "Checking web app shell"
index_html="$(curl "${curl_args[@]}" "${base_url}/")"
printf '%s' "$index_html" | grep -q '<div id="root"></div>'

asset_path="$(printf '%s' "$index_html" | sed -n 's/.*src="\([^"]*\/assets\/[^"]*\.js\)".*/\1/p' | head -n 1)"
if [ -n "$asset_path" ]; then
  echo "Checking web app bundle API target"
  bundle="$(curl "${curl_args[@]}" "${base_url}${asset_path}")"
  if printf '%s' "$bundle" | grep -Eq 'http://(127\.0\.0\.1|localhost):8787|http://(127\.0\.0\.1|localhost):8790'; then
    echo "Web bundle references local development API or MCP endpoints." >&2
    exit 1
  fi
fi

echo "Docker smoke checks passed for ${base_url}"

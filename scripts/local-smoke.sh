#!/usr/bin/env bash
set -euo pipefail

web_url="${WEB_URL:-http://127.0.0.1:5173}"
api_url="${API_URL:-http://127.0.0.1:8787}"
curl_args=(-fsS --connect-timeout "${CURL_CONNECT_TIMEOUT:-10}" --max-time "${CURL_MAX_TIME:-30}")

echo "Checking ${web_url}/"
curl "${curl_args[@]}" "${web_url}/" | grep -q '<div id="root"></div>'

echo "Checking ${api_url}/health"
curl "${curl_args[@]}" "${api_url}/health" | grep -q '"status":"ok"'

echo "Checking project creation and canvas persistence"
created_json="$(curl "${curl_args[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke test canvas","nodes":[{"id":"node_contract","type":"contextNode","position":{"x":0,"y":0},"data":{"canvasType":"project_contract","title":"Contract","fields":{"content":"Contract"},"tags":[],"updatedAt":"2026-05-14T00:00:00.000Z"}},{"id":"node_requirement","type":"contextNode","position":{"x":180,"y":0},"data":{"canvasType":"requirement","title":"Requirement","fields":{"content":"Requirement"},"tags":[],"updatedAt":"2026-05-14T00:00:00.000Z"}}],"edges":[{"id":"edge_contract_requirement","source":"node_contract","target":"node_requirement","label":"implements","data":{"relationship":"implements","updatedAt":"2026-05-14T00:00:00.000Z"}}]}' \
  "${api_url}/api/projects")"
project_id="$(CREATED_JSON="${created_json}" python3 - <<'PY'
import json
import os

print(json.loads(os.environ["CREATED_JSON"])["project"]["id"])
PY
)"
canvas_json="$(curl "${curl_args[@]}" "${api_url}/api/projects/${project_id}/canvas")"
CANVAS_JSON="${canvas_json}" python3 - <<'PY'
import json
import os
import sys

canvas = json.loads(os.environ["CANVAS_JSON"])
nodes = canvas.get("nodes") or []
edges = canvas.get("edges") or []
node_types = {node.get("data", {}).get("canvasType") for node in nodes}
required_types = {"project_contract", "requirement"}
missing = sorted(required_types - node_types)

if missing:
    sys.exit(f"canvas is missing node types: {', '.join(missing)}")
if len(nodes) < 2:
    sys.exit(f"canvas has too few nodes: {len(nodes)}")
if not edges:
    sys.exit("canvas has no relationships")
PY

echo "Local smoke checks passed for ${web_url} and ${api_url}"

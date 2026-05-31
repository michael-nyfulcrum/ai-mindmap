#!/usr/bin/env bash
set -euo pipefail

web_url="${WEB_URL:-http://127.0.0.1:5173}"
api_url="${API_URL:-http://127.0.0.1:8787}"
curl_args=(-fsS --connect-timeout "${CURL_CONNECT_TIMEOUT:-10}" --max-time "${CURL_MAX_TIME:-30}")

echo "Checking ${web_url}/"
curl "${curl_args[@]}" "${web_url}/" | grep -q '<div id="root"></div>'

echo "Checking ${api_url}/health"
curl "${curl_args[@]}" "${api_url}/health" | grep -q '"status":"ok"'

echo "Checking seeded canvas data"
canvas_json="$(curl "${curl_args[@]}" "${api_url}/api/projects/project_demo_context_canvas/canvas")"
CANVAS_JSON="${canvas_json}" python3 - <<'PY'
import json
import os
import sys

canvas = json.loads(os.environ["CANVAS_JSON"])
nodes = canvas.get("nodes") or []
edges = canvas.get("edges") or []
node_types = {node.get("data", {}).get("canvasType") for node in nodes}
required_types = {"project_contract", "requirement", "source_snapshot", "link"}
missing = sorted(required_types - node_types)

if missing:
    sys.exit(f"seeded canvas is missing node types: {', '.join(missing)}")
if len(nodes) < 4:
    sys.exit(f"seeded canvas has too few nodes: {len(nodes)}")
if not edges:
    sys.exit("seeded canvas has no relationships")
PY

echo "Local smoke checks passed for ${web_url} and ${api_url}"

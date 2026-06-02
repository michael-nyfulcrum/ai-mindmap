from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from context_canvas_api.analyzer import (
    AIProviderError,
    _openai_client,
    _openai_model,
    _parse_json_object,
    _response_text,
)

ALLOWED_NODE_TYPES = {"project_contract", "requirement", "note", "link"}
ALLOWED_RELATIONSHIPS = {
    "references",
    "clarifies",
    "depends on",
    "implements",
    "design reference",
    "requirement source",
    "test coverage",
}

GENERATION_INSTRUCTIONS = """
You are Context Canvas AI, a senior delivery lead who turns a short project brief
into a structured planning canvas that a whole team can build from.

You receive one short brief. Produce a focused project plan as a graph of canvas
nodes. Return exactly one JSON object and no Markdown. The object must match this
contract:
{
  "projectName": "concise project name, max 60 characters",
  "projectDescription": "one-sentence summary, max 140 characters",
  "nodes": [
    {
      "key": "stable-slug-unique-within-response",
      "type": "project_contract" | "requirement" | "note" | "link",
      "title": "short node title",
      "content": "Markdown body. For the contract: scope, goals, and out-of-scope. For a requirement: what it does plus 2-4 acceptance criteria as a bullet list.",
      "tags": ["short", "lowercase", "tags"]
    }
  ],
  "edges": [
    { "source": "node-key", "target": "node-key", "relationship": "implements" }
  ]
}

Rules:
- Produce exactly one "project_contract" node as the single source of truth.
- Produce between 4 and 8 "requirement" nodes covering the core scope.
- Add 0-2 "note" nodes only for genuinely important risks or decisions.
- Add a "link" node only if the brief explicitly references an external resource.
- Every requirement must connect to the contract with an "implements" edge.
- Use only these relationship values: references, clarifies, depends on,
  implements, design reference, requirement source, test coverage.
- Use "depends on" edges between requirements when one truly blocks another.
- Keep every "key" unique and referenced consistently in edges.
- Be specific to the brief. Never invent unrelated scope or external systems.
- Keep each requirement content under 90 words.
""".strip()


def generate_canvas(prompt: str) -> dict[str, Any]:
    """Turn a short natural-language brief into a canvas-shaped project graph."""
    client = _openai_client()
    response = client.responses.create(
        model=_openai_model(),
        instructions=GENERATION_INSTRUCTIONS,
        input=json.dumps({"brief": prompt}, ensure_ascii=False),
        max_output_tokens=3000,
    )
    parsed = _parse_json_object(_response_text(response))
    return _normalize_generated_graph(parsed, prompt)


def _normalize_generated_graph(parsed: dict[str, Any], prompt: str) -> dict[str, Any]:
    raw_nodes = parsed.get("nodes")
    if not isinstance(raw_nodes, list) or not raw_nodes:
        raise AIProviderError("OpenAI returned a project plan with no nodes.")

    key_to_id: dict[str, str] = {}
    nodes: list[dict[str, Any]] = []
    for raw in raw_nodes:
        if not isinstance(raw, dict):
            continue
        node_type = str(raw.get("type") or "requirement")
        if node_type not in ALLOWED_NODE_TYPES:
            node_type = "requirement"
        title = str(raw.get("title") or "").strip() or "Untitled"
        content = str(raw.get("content") or "").strip()
        tags = [str(tag).strip() for tag in raw.get("tags") or [] if str(tag).strip()][:4]
        node_id = f"node_{uuid4().hex}"
        key = str(raw.get("key") or "").strip()
        if key:
            key_to_id[key] = node_id
        nodes.append(
            {
                "id": node_id,
                "type": "contextNode",
                "position": {"x": 0, "y": 0},
                "data": {
                    "canvasType": node_type,
                    "title": title[:120],
                    "fields": {"content": content},
                    "tags": tags,
                    "updatedAt": "",
                },
            }
        )

    edges: list[dict[str, Any]] = []
    for raw in parsed.get("edges") or []:
        if not isinstance(raw, dict):
            continue
        source = key_to_id.get(str(raw.get("source") or ""))
        target = key_to_id.get(str(raw.get("target") or ""))
        if not source or not target or source == target:
            continue
        relationship = str(raw.get("relationship") or "references").strip()
        if relationship not in ALLOWED_RELATIONSHIPS:
            relationship = "references"
        edges.append(
            {
                "id": f"edge_{uuid4().hex}",
                "type": "default",
                "source": source,
                "target": target,
                "label": relationship,
                "data": {"relationship": relationship, "updatedAt": ""},
            }
        )

    name = str(parsed.get("projectName") or "").strip() or _fallback_name(prompt)
    description = str(parsed.get("projectDescription") or "").strip() or prompt.strip()[:140]
    return {
        "projectName": name[:80],
        "projectDescription": description[:140],
        "nodes": nodes,
        "edges": edges,
    }


def _fallback_name(prompt: str) -> str:
    words = prompt.strip().split()
    return " ".join(words[:6])[:80] or "New Project"

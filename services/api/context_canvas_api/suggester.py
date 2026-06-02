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
from context_canvas_api.generator import ALLOWED_NODE_TYPES, ALLOWED_RELATIONSHIPS
from context_canvas_api.models import CanvasSnapshot, ProposedChange, SuggestionResponse

SUGGEST_INSTRUCTIONS = """
You are Context Canvas AI, a senior delivery lead helping a team build out a planning
canvas. You propose a small set of high-value changes the user can preview and approve.

Use only the supplied saved canvas as the source of truth. Never invent external systems,
tools, or scope the canvas does not imply. Return exactly one JSON object and no Markdown,
matching this contract:
{
  "summary": "one sentence describing the batch of suggestions",
  "changes": [
    {
      "op": "add_node",
      "nodeKey": "unique-slug-within-response",
      "nodeType": "project_contract" | "requirement" | "note" | "link",
      "title": "short node title",
      "content": "Markdown body. For a requirement: what it does plus 2-4 acceptance criteria bullets.",
      "tags": ["short", "lowercase"],
      "anchorNodeId": "id of an existing node this should attach to, or null",
      "rationale": "why this is worth adding, grounded in the canvas"
    },
    {
      "op": "add_edge",
      "sourceRef": "existing node id OR a nodeKey from this response",
      "targetRef": "existing node id OR a nodeKey from this response",
      "relationship": "implements" | "depends on" | "references" | "clarifies" | "design reference" | "requirement source" | "test coverage",
      "rationale": "why this connection matters"
    },
    {
      "op": "update_node",
      "nodeId": "id of an existing node to revise",
      "titleAfter": "optional new title, omit to keep current",
      "contentAfter": "the full revised Markdown body",
      "rationale": "what the update fixes or improves"
    }
  ]
}

Rules:
- Propose between 2 and 5 changes total. Favor quality over quantity.
- When a target node is provided, focus suggestions on attaching to or improving it.
- Prefer add_node + add_edge to fill genuine gaps (missing requirements, acceptance
  criteria, decisions, risks). New requirements should connect via "implements" or
  "depends on".
- Use update_node when an existing node is vague, outdated, or flagged; contentAfter must
  be a complete replacement body, not a diff or a note about the change.
- Every add_edge ref must be an existing node id or a nodeKey you define in this response.
- Keep each content body under 100 words. Be specific and actionable.
""".strip()


def suggest_canvas_changes(
    snapshot: CanvasSnapshot,
    target_node_id: str | None = None,
    instruction: str | None = None,
) -> SuggestionResponse:
    client = _openai_client()
    response = client.responses.create(
        model=_openai_model(),
        instructions=SUGGEST_INSTRUCTIONS,
        input=_suggest_payload(snapshot, target_node_id, instruction),
        max_output_tokens=2400,
    )
    parsed = _parse_json_object(_response_text(response))
    return _normalize_suggestions(parsed, snapshot)


def _suggest_payload(
    snapshot: CanvasSnapshot,
    target_node_id: str | None,
    instruction: str | None,
) -> str:
    return json.dumps(
        {
            "targetNodeId": target_node_id,
            "userInstruction": (instruction or "").strip() or None,
            "savedCanvas": {
                "project": snapshot.project.model_dump(),
                "nodes": snapshot.nodes,
                "edges": snapshot.edges,
            },
        },
        ensure_ascii=False,
    )


def _node_index(snapshot: CanvasSnapshot) -> dict[str, dict[str, str]]:
    index: dict[str, dict[str, str]] = {}
    for node in snapshot.nodes:
        node_id = str(node.get("id") or "")
        if not node_id:
            continue
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        fields = data.get("fields") if isinstance(data.get("fields"), dict) else {}
        index[node_id] = {
            "title": str(data.get("title") or node_id),
            "content": str(fields.get("content") or ""),
        }
    return index


def _normalize_suggestions(parsed: dict[str, Any], snapshot: CanvasSnapshot) -> SuggestionResponse:
    index = _node_index(snapshot)
    raw_changes = parsed.get("changes")
    if not isinstance(raw_changes, list):
        raw_changes = []

    # First pass: collect valid add_node keys so edges can reference them.
    proposed_keys: set[str] = set()
    for raw in raw_changes:
        if isinstance(raw, dict) and raw.get("op") == "add_node":
            key = str(raw.get("nodeKey") or "").strip()
            if key:
                proposed_keys.add(key)

    changes: list[ProposedChange] = []
    for raw in raw_changes:
        if not isinstance(raw, dict):
            continue
        op = str(raw.get("op") or "")

        if op == "add_node":
            node_type = str(raw.get("nodeType") or "requirement")
            if node_type not in ALLOWED_NODE_TYPES:
                node_type = "requirement"
            title = str(raw.get("title") or "").strip()
            if not title:
                continue
            anchor = str(raw.get("anchorNodeId") or "").strip()
            changes.append(
                ProposedChange(
                    id=f"chg_{uuid4().hex}",
                    op="add_node",
                    rationale=str(raw.get("rationale") or "").strip()[:300],
                    nodeKey=str(raw.get("nodeKey") or "").strip() or f"key_{uuid4().hex[:8]}",
                    nodeType=node_type,  # type: ignore[arg-type]
                    title=title[:120],
                    content=str(raw.get("content") or "").strip(),
                    tags=[str(tag).strip() for tag in raw.get("tags") or [] if str(tag).strip()][:4],
                    anchorNodeId=anchor if anchor in index else None,
                )
            )

        elif op == "add_edge":
            source = str(raw.get("sourceRef") or "").strip()
            target = str(raw.get("targetRef") or "").strip()
            if not _ref_is_valid(source, index, proposed_keys) or not _ref_is_valid(target, index, proposed_keys):
                continue
            if source == target:
                continue
            relationship = str(raw.get("relationship") or "references").strip()
            if relationship not in ALLOWED_RELATIONSHIPS:
                relationship = "references"
            changes.append(
                ProposedChange(
                    id=f"chg_{uuid4().hex}",
                    op="add_edge",
                    rationale=str(raw.get("rationale") or "").strip()[:300],
                    sourceRef=source,
                    targetRef=target,
                    relationship=relationship,
                )
            )

        elif op == "update_node":
            node_id = str(raw.get("nodeId") or "").strip()
            if node_id not in index:
                continue
            content_after = str(raw.get("contentAfter") or "").strip()
            if not content_after:
                continue
            title_after = str(raw.get("titleAfter") or "").strip()
            changes.append(
                ProposedChange(
                    id=f"chg_{uuid4().hex}",
                    op="update_node",
                    rationale=str(raw.get("rationale") or "").strip()[:300],
                    nodeId=node_id,
                    titleBefore=index[node_id]["title"],
                    titleAfter=title_after or None,
                    contentBefore=index[node_id]["content"],
                    contentAfter=content_after,
                )
            )

    summary = str(parsed.get("summary") or "").strip() or "Proposed canvas changes."
    return SuggestionResponse(summary=summary[:200], changes=changes)


def _ref_is_valid(ref: str, index: dict[str, dict[str, str]], proposed_keys: set[str]) -> bool:
    return bool(ref) and (ref in index or ref in proposed_keys)

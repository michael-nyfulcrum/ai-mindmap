from __future__ import annotations

import difflib
import json
import os
from typing import Any

from context_canvas_api.models import AnalysisResponse, CanvasSnapshot, ChangeImpact


class AIProviderError(RuntimeError):
    pass


ANALYSIS_INSTRUCTIONS = """
You are Context Canvas AI, a senior requirements analyst.

Use only the saved canvas payload supplied by the application. Treat node IDs,
node titles, node text, edges, and the project record as the complete source of
truth. Do not use or invent Jira, Confluence, Slack, files, internet content, or
unstated project history.

Return exactly one JSON object and no Markdown. The object must match this
contract:
{
  "status": "ok" | "needs_context",
  "model": "string",
  "summary": "short answer to the user's question",
  "findings": [
    {
      "severity": "info" | "low" | "medium" | "high",
      "title": "short finding title",
      "detail": "specific evidence-based detail",
      "citationNodeIds": ["saved-canvas-node-id"]
    }
  ],
  "missingContext": ["specific missing input needed to answer better"],
  "suggestedNextSteps": ["specific next step the user can take"],
  "citations": [
    { "nodeId": "saved-canvas-node-id", "title": "saved canvas node title" }
  ]
}

Rules:
- Cite only node IDs present in the saved canvas.
- Prefer requirement nodes and project contract nodes as evidence.
- Set status to "needs_context" when the saved canvas is insufficient.
- Keep findings focused on requirements, gaps, dependencies, and decisions.
- Keep suggested next steps actionable and minimal.
""".strip()


CHAT_INSTRUCTIONS = """
Formatting re-enabled.

You are Context Canvas AI, a concise requirements and product partner.

Answer using GitHub-Flavored Markdown for a chat UI.

Rules:
- Start with the direct answer in one or two short sentences.
- Use short bullets or a numbered list when structure helps.
- Use exact canvas node titles as evidence when relevant.
- If the canvas does not contain enough information, include a **Missing context:**
  line with the specific missing detail.
- Do not claim to access Jira, Confluence, Slack, local files, the internet, or
  hidden data.
- Do not claim to create, edit, delete, or move canvas nodes.
- Do not expose raw JSON or implementation details.
- Keep the answer under 220 words unless the user asks for a deeper breakdown.
""".strip()


CHANGE_IMPACT_INSTRUCTIONS = """
You are Context Canvas AI, a senior requirements change-control analyst.

Use only the supplied saved canvas, changed node before/after payloads, changed
fields, and candidate affected nodes. Return exactly one JSON object and no
Markdown. The object must match this contract:
{
  "summary": "imperative changelog-style summary under 140 characters",
  "affectedNodes": [
    {
      "nodeId": "candidate-node-id",
      "status": "review" | "outdated" | "needs_update" | "conflict",
      "reason": "specific reason grounded in the changed requirement or contract"
    }
  ]
}

Rules:
- Choose only node IDs from candidateAffectedNodes.
- Prefer "conflict" only when the candidate appears incompatible with the new text.
- Prefer "outdated" when the candidate reflects old wording or decisions.
- Prefer "needs_update" when the candidate should be revised for parity.
- Prefer "review" when the candidate is connected and may be affected but the
  saved context is insufficient for a stronger status.
- The summary is a version-history entry, so describe the actual edit specifically:
  name what changed between beforeNode and afterNode (e.g. a renamed title, an
  added acceptance criterion, a reworded constraint). Never use vague filler like
  "content changed", "updated node", or "made edits". Two different edits must
  never produce the same summary.
""".strip()


def analyze_canvas(snapshot: CanvasSnapshot, question: str) -> AnalysisResponse:
    client = _openai_client()
    response = client.responses.create(
        model=_openai_model(),
        instructions=ANALYSIS_INSTRUCTIONS,
        input=_analysis_payload(snapshot, question),
        max_output_tokens=1800,
    )
    parsed = _parse_json_object(_response_text(response))
    parsed["model"] = _openai_model()
    try:
        return AnalysisResponse.model_validate(parsed)
    except Exception as exc:
        raise AIProviderError("OpenAI returned analysis that did not match the expected contract.") from exc


def chat_with_canvas(
    snapshot: CanvasSnapshot,
    question: str,
    history: list[dict[str, Any]] | None = None,
) -> tuple[str, AnalysisResponse]:
    analysis = analyze_canvas(snapshot, question)
    client = _openai_client()
    response = client.responses.create(
        model=_openai_model(),
        instructions=CHAT_INSTRUCTIONS,
        input=_chat_payload(snapshot, question, history or [], analysis),
        max_output_tokens=1600,
    )
    content = _response_text(response).strip()
    if not content:
        raise AIProviderError("OpenAI returned an empty chat response.")
    return content, analysis


def analyze_change_impact(
    snapshot: CanvasSnapshot,
    before_node: dict[str, Any] | None,
    after_node: dict[str, Any] | None,
    changed_fields: list[str],
    candidate_nodes: list[dict[str, Any]],
    source_version_id: str,
    changed_at: str,
) -> tuple[str, list[ChangeImpact]]:
    fallback_summary, fallback_impacts = _rule_based_change_impact(
        before_node,
        after_node,
        changed_fields,
        candidate_nodes,
        source_version_id,
        changed_at,
    )
    if os.getenv("CONTEXT_CANVAS_DISABLE_CHANGE_AI", "").lower() in {"1", "true", "yes"}:
        return fallback_summary, fallback_impacts
    if not os.getenv("OPENAI_API_KEY", "").strip():
        return fallback_summary, fallback_impacts

    try:
        client = _openai_client()
        response = client.responses.create(
            model=_openai_model(),
            instructions=CHANGE_IMPACT_INSTRUCTIONS,
            input=_change_impact_payload(snapshot, before_node, after_node, changed_fields, candidate_nodes),
            max_output_tokens=1400,
        )
        parsed = _parse_json_object(_response_text(response))
    except Exception:
        return fallback_summary, fallback_impacts

    summary = str(parsed.get("summary") or fallback_summary).strip() or fallback_summary
    candidate_by_id = {str(node.get("id")): node for node in candidate_nodes}
    impacts: list[ChangeImpact] = []
    for item in parsed.get("affectedNodes", []):
        if not isinstance(item, dict):
            continue
        node_id = str(item.get("nodeId") or "")
        node = candidate_by_id.get(node_id)
        if not node:
            continue
        status = str(item.get("status") or "review")
        if status not in {"review", "outdated", "needs_update", "conflict"}:
            status = "review"
        reason = str(item.get("reason") or "").strip() or "Review this connected node against the latest requirement change."
        impacts.append(
            ChangeImpact(
                nodeId=node_id,
                title=str(node.get("data", {}).get("title") or node_id),
                status=status,  # type: ignore[arg-type]
                reason=reason[:360],
                sourceNodeId=str((after_node or before_node or {}).get("id") or ""),
                sourceVersionId=source_version_id,
                updatedAt=changed_at,
            )
        )
    return summary[:220], impacts or fallback_impacts


def _openai_client():
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise AIProviderError("OPENAI_API_KEY is required.")

    try:
        from openai import OpenAI
    except Exception as exc:
        raise AIProviderError("The OpenAI Python package is required.") from exc

    return OpenAI(api_key=api_key)


def _openai_model() -> str:
    return "gpt-4.1-mini"


def _analysis_payload(snapshot: CanvasSnapshot, question: str) -> str:
    return json.dumps(
        {
            "userQuestion": question,
            "savedCanvas": _saved_canvas_payload(snapshot),
        },
        ensure_ascii=False,
    )


def _chat_payload(
    snapshot: CanvasSnapshot,
    question: str,
    history: list[dict[str, Any]],
    analysis: AnalysisResponse,
) -> str:
    return json.dumps(
        {
            "userQuestion": question,
            "savedCanvas": _saved_canvas_payload(snapshot),
            "recentChatHistory": _compact_history(history),
            "analysisContract": analysis.model_dump(),
        },
        ensure_ascii=False,
    )


def _change_impact_payload(
    snapshot: CanvasSnapshot,
    before_node: dict[str, Any] | None,
    after_node: dict[str, Any] | None,
    changed_fields: list[str],
    candidate_nodes: list[dict[str, Any]],
) -> str:
    return json.dumps(
        {
            "changedFields": changed_fields,
            "beforeNode": before_node,
            "afterNode": after_node,
            "candidateAffectedNodes": candidate_nodes,
            "savedCanvas": _saved_canvas_payload(snapshot),
        },
        ensure_ascii=False,
    )


def _saved_canvas_payload(snapshot: CanvasSnapshot) -> dict[str, Any]:
    return {
        "project": snapshot.project.model_dump(),
        "nodes": snapshot.nodes,
        "edges": snapshot.edges,
    }


def _response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    chunks: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if isinstance(text, str):
                chunks.append(text)
    return "".join(chunks)


def _parse_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.lower().startswith("json"):
            stripped = stripped[4:].strip()

    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError as exc:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise AIProviderError("OpenAI did not return JSON analysis.") from exc
        try:
            parsed = json.loads(stripped[start : end + 1])
        except json.JSONDecodeError as nested_exc:
            raise AIProviderError("OpenAI did not return valid JSON analysis.") from nested_exc

    if not isinstance(parsed, dict):
        raise AIProviderError("OpenAI analysis response must be a JSON object.")
    return parsed


def _compact_history(history: list[dict[str, Any]]) -> list[dict[str, str]]:
    compacted: list[dict[str, str]] = []
    for message in history[-8:]:
        role = str(message.get("role") or "")
        if role not in {"user", "assistant"}:
            continue
        content = str(message.get("content") or "").strip()
        if content:
            compacted.append({"role": role, "content": content[:1200]})
    return compacted


def _rule_based_change_impact(
    before_node: dict[str, Any] | None,
    after_node: dict[str, Any] | None,
    changed_fields: list[str],
    candidate_nodes: list[dict[str, Any]],
    source_version_id: str,
    changed_at: str,
) -> tuple[str, list[ChangeImpact]]:
    source = after_node or before_node or {}
    source_data = source.get("data") if isinstance(source.get("data"), dict) else {}
    source_type = str(source_data.get("canvasType") or "requirement")
    source_title = str(source_data.get("title") or source.get("id") or "Requirement")
    before_data = before_node.get("data") if isinstance(before_node, dict) and isinstance(before_node.get("data"), dict) else {}
    after_data = after_node.get("data") if isinstance(after_node, dict) and isinstance(after_node.get("data"), dict) else {}
    before_content = _node_content(before_node)
    after_content = _node_content(after_node)

    if before_node is None:
        line_count = len(after_content.splitlines()) or (1 if after_content else 0)
        size = f" ({line_count} line{'s' if line_count != 1 else ''})" if line_count else ""
        summary = f"Created {source_title}{size}"
    elif after_node is None:
        summary = f"Deleted {source_title}"
    else:
        details = _describe_field_changes(changed_fields, after_data, before_content, after_content)
        summary = f"Updated {source_title} — {details}" if details else f"Updated {source_title}"

    statuses: dict[str, str] = {}
    for node in candidate_nodes:
        node_id = str(node.get("id") or "")
        content = _node_content(node).lower()
        status = "review"
        reason = "Connected to the changed requirement or contract; verify it still aligns."
        if after_node is None:
            status = "outdated"
            reason = "The source requirement was deleted; this connected node may reference retired scope."
        elif source_type == "project_contract":
            status = "needs_update"
            reason = "The project contract changed; this requirement may need revision to preserve contract alignment."
        if after_content and before_content and before_content.lower() in content and after_content.lower() not in content:
            status = "outdated"
            reason = "This node appears to reference the prior wording and may be stale."
        if any(term in content for term in ("conflict", "contradict", "blocked by", "cannot")):
            status = "conflict"
            reason = "This node contains conflict language and should be reconciled with the latest change."
        statuses[node_id] = status
        node["__impact_reason"] = reason

    impacts = [
        ChangeImpact(
            nodeId=str(node.get("id")),
            title=str(node.get("data", {}).get("title") or node.get("id")),
            status=statuses.get(str(node.get("id")), "review"),  # type: ignore[arg-type]
            reason=str(node.get("__impact_reason") or "Review this node against the latest change."),
            sourceNodeId=str(source.get("id") or ""),
            sourceVersionId=source_version_id,
            updatedAt=changed_at,
        )
        for node in candidate_nodes
        if node.get("id")
    ]
    return summary[:220], impacts


def _content_diff_stat(before: str, after: str) -> tuple[int, int]:
    matcher = difflib.SequenceMatcher(a=before.splitlines(), b=after.splitlines())
    added = removed = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag in ("replace", "delete"):
            removed += i2 - i1
        if tag in ("replace", "insert"):
            added += j2 - j1
    return added, removed


def _describe_field_changes(
    changed_fields: list[str],
    after_data: dict[str, Any],
    before_content: str,
    after_content: str,
) -> str:
    """Build a concise, edit-specific changelog line for the version history."""
    parts: list[str] = []
    if "title" in changed_fields:
        new_title = str(after_data.get("title") or "").strip()
        parts.append(f'renamed to "{new_title}"' if new_title else "renamed")
    if "tags" in changed_fields:
        after_tags = [str(tag).strip() for tag in (after_data.get("tags") or []) if str(tag).strip()]
        parts.append(f"retagged ({', '.join(after_tags)})" if after_tags else "tags cleared")
    if "content" in changed_fields:
        added, removed = _content_diff_stat(before_content, after_content)
        if added or removed:
            parts.append(f"content +{added}/-{removed} line{'s' if (added + removed) != 1 else ''}")
        else:
            parts.append("content reworded")
    return "; ".join(parts)


def _node_content(node: dict[str, Any] | None) -> str:
    if not node:
        return ""
    data = node.get("data")
    if not isinstance(data, dict):
        return ""
    fields = data.get("fields")
    if not isinstance(fields, dict):
        return ""
    return str(fields.get("content") or "").strip()

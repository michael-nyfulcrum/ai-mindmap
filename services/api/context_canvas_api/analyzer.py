from __future__ import annotations

import json
import os
from typing import Any

from context_canvas_api.models import AnalysisResponse, CanvasSnapshot


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
    return os.getenv("OPENAI_MODEL", "").strip() or "gpt-4.1-mini"


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

"""Build a GitHub Spec Kit-style feature specification from a canvas snapshot.

The "Create spec" AI action turns a node on the project canvas into a single,
self-contained feature spec centered on two things: granular **functional
requirements** (FR-###, "the system MUST…" notation with testable acceptance
criteria) and the **development requirements** (DR-###) likely needed to build
them. The spec is stored as its own canvas node and handed to a coding agent
over MCP.

Generation is AI-backed: OpenAI turns the saved canvas text into concrete
requirements. When OpenAI is unavailable (or disabled for tests via
``CONTEXT_CANVAS_DISABLE_SPEC_AI``), it falls back to a deterministic mapping.
Either way the Markdown structure is rendered here so the format stays stable.
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import UTC, datetime
from typing import Any

from context_canvas_api.analyzer import (
    _openai_client,
    _openai_model,
    _parse_json_object,
    _response_text,
)

logger = logging.getLogger(__name__)

CLARIFY = "[NEEDS CLARIFICATION: {reason}]"

SPEC_AI_INSTRUCTIONS = """
You are Context Canvas AI, a senior product engineer writing a GitHub Spec Kit
feature specification from a saved project canvas. The spec must be focused on
functional requirements and the development requirements needed to build them.

You receive the feature name, an optional author instruction, the project
overview, the in-scope requirements (each with a stable id and saved text),
connected sources, and dependencies. Return exactly one JSON object and no
Markdown matching this contract:
{
  "overview": "2-3 sentence plain-language summary of the feature",
  "functionalRequirements": [
    {
      "sourceId": "id of the canvas requirement this came from",
      "statement": "The system MUST ... (or: Users MUST be able to ...)",
      "acceptanceCriteria": ["testable Given/When/Then or measurable outcome", "..."]
    }
  ],
  "developmentRequirements": [
    "Category: concrete technical task, e.g. 'API: add POST /tickets endpoint with validation'"
  ],
  "openQuestions": ["a genuinely unresolved ambiguity"]
}

Rules:
- Decompose each canvas requirement into one or more GRANULAR functional
  requirements. Each is a single, testable capability written as "The system
  MUST ..." or "Users MUST be able to ...". Echo the originating canvas id in
  sourceId.
- Give each functional requirement 2-4 concrete acceptance criteria. Prefer the
  Given/When/Then form. Never write filler like "no acceptance criteria".
- developmentRequirements list the likely technical work to implement the FRs:
  data model/entities, API endpoints, UI components, validation & error
  handling, integrations, auth/permissions, and testing. Keep each short and
  prefix with a category. These are proposals to refine in planning — do not
  over-specify frameworks unless the canvas states them.
- openQuestions ONLY for genuine gaps; most specs should have an empty list. Do
  not invent questions to fill space.
- Use only the supplied canvas text and instruction. Do not invent scope.
""".strip()


def build_feature_spec(
    snapshot: dict[str, Any],
    focus_node_id: str | None = None,
    instruction: str | None = None,
) -> dict[str, Any]:
    """Build a feature spec from a ``{project, nodes, edges}`` snapshot.

    When ``focus_node_id`` points at a requirement, the spec centers on that
    single feature. Otherwise (the contract or no focus) it covers every
    requirement on the canvas. ``instruction`` is the optional author note from
    the AI-actions prompt; it is recorded as a Requested Focus section.
    """
    project = snapshot.get("project") if isinstance(snapshot.get("project"), dict) else {}
    nodes = [node for node in (snapshot.get("nodes") or []) if isinstance(node, dict)]
    edges = [edge for edge in (snapshot.get("edges") or []) if isinstance(edge, dict)]

    project_name = str(project.get("name") or "Untitled Project").strip() or "Untitled Project"
    instruction = (instruction or "").strip()
    generated_at = _utc_now()

    contract = next((node for node in nodes if _canvas_type(node) == "project_contract"), None)
    all_requirements = [node for node in nodes if _canvas_type(node) == "requirement"]
    focus = next((node for node in nodes if str(node.get("id")) == focus_node_id), None) if focus_node_id else None

    if focus is not None and _canvas_type(focus) == "requirement":
        feature_name = _title(focus) or "Feature"
        requirements = [focus]
        related = _related_sources(focus, nodes, edges)
        dependency_ids = _dependency_ids(focus, all_requirements, edges)
        dependencies = [node for node in all_requirements if str(node.get("id")) in dependency_ids]
    else:
        feature_name = project_name
        requirements = all_requirements
        related = [node for node in nodes if _canvas_type(node) in {"source_snapshot", "link"}]
        dependencies = []

    overview_node = focus if (focus is not None and _canvas_type(focus) != "requirement") else contract
    overview = _content(overview_node) or str(project.get("description") or "").strip()
    requirement_ids = {str(node.get("id")) for node in requirements}
    default_source = str(focus.get("id")) if focus is not None and _canvas_type(focus) == "requirement" else (
        str(requirements[0].get("id")) if requirements else ""
    )

    ai = _maybe_ai_spec(feature_name, overview, instruction, requirements, related, dependencies)

    functional = _functional_requirements(requirements, ai, requirement_ids, default_source)
    development = _development_requirements(requirements, related, ai)
    if ai and str(ai.get("overview") or "").strip():
        overview = _clip(str(ai["overview"]).strip(), 600)
    ai_questions = [_clip(str(q).strip(), 200) for q in (ai.get("openQuestions") if ai else []) or [] if str(q).strip()]
    open_questions = _open_questions(requirements, ai_questions)

    content = _render_spec(
        feature_name=feature_name,
        project=project,
        overview=overview,
        functional=functional,
        development=development,
        related=related,
        dependencies=dependencies,
        open_questions=open_questions,
        instruction=instruction,
        generated_at=generated_at,
    )

    return {
        "title": f"{feature_name} Spec",
        "slug": _slug(feature_name),
        "content": content,
        "requirementCount": len(functional),
        "developmentRequirementCount": len(development),
        "openQuestionCount": len(open_questions),
    }


def _maybe_ai_spec(
    feature_name: str,
    overview: str,
    instruction: str,
    requirements: list[dict[str, Any]],
    related: list[dict[str, Any]],
    dependencies: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not requirements:
        return None
    if os.getenv("CONTEXT_CANVAS_DISABLE_SPEC_AI", "").lower() in {"1", "true", "yes"}:
        return None
    if not os.getenv("OPENAI_API_KEY", "").strip():
        return None

    payload = {
        "feature": feature_name,
        "instruction": instruction,
        "projectOverview": overview,
        "requirements": [
            {"id": str(node.get("id")), "title": _title(node), "text": _content(node)}
            for node in requirements
        ],
        "sources": [{"title": _title(node), "text": _clip(_content(node), 600)} for node in related],
        "dependencies": [{"title": _title(node)} for node in dependencies],
    }
    try:
        client = _openai_client()
        response = client.responses.create(
            model=_openai_model(),
            instructions=SPEC_AI_INSTRUCTIONS,
            input=json.dumps(payload, ensure_ascii=False),
            max_output_tokens=2200,
        )
        parsed = _parse_json_object(_response_text(response))
    except Exception:
        logger.warning("Spec AI generation failed; using deterministic fallback.", exc_info=True)
        return None
    return parsed if isinstance(parsed.get("functionalRequirements"), list) else None


def _functional_requirements(
    requirements: list[dict[str, Any]],
    ai: dict[str, Any] | None,
    requirement_ids: set[str],
    default_source: str,
) -> list[dict[str, Any]]:
    """Return ``[{fr_id, statement, criteria, source_id}]`` numbered FR-001…"""
    items: list[dict[str, Any]] = []
    if ai:
        for raw in ai.get("functionalRequirements", []):
            if not isinstance(raw, dict):
                continue
            statement = _clip(str(raw.get("statement") or "").strip(), 280)
            if not statement:
                continue
            source = str(raw.get("sourceId") or "")
            source = source if source in requirement_ids else default_source
            criteria = [
                _clip(str(item).strip(), 200)
                for item in raw.get("acceptanceCriteria") or []
                if str(item).strip()
            ][:5]
            items.append({"statement": statement, "criteria": criteria, "source_id": source})

    if not items:
        # Deterministic fallback: one functional requirement per canvas node.
        for node in requirements:
            statement, criteria = _statement_and_criteria(node)
            items.append(
                {
                    "statement": _must_phrase(statement),
                    "criteria": criteria,
                    "source_id": str(node.get("id")),
                }
            )

    for index, item in enumerate(items, start=1):
        item["fr_id"] = f"FR-{index:03d}"
    return items


def _development_requirements(
    requirements: list[dict[str, Any]],
    related: list[dict[str, Any]],
    ai: dict[str, Any] | None,
) -> list[str]:
    if ai:
        ai_dev = [_clip(str(item).strip(), 220) for item in ai.get("developmentRequirements") or [] if str(item).strip()]
        if ai_dev:
            return ai_dev[:10]
    return _fallback_development_requirements(requirements, related)


def _fallback_development_requirements(
    requirements: list[dict[str, Any]],
    related: list[dict[str, Any]],
) -> list[str]:
    text = " ".join(_content(node).lower() for node in requirements)
    items: list[str] = []
    if _has(text, ("form", "submit", "upload", "attachment", "input", "field", "message")):
        items.append("UI: build the form/input components with client-side validation and submission handling.")
    if _has(text, ("api", "backend", "endpoint", "content", "store", "database", "persist", "save", "record")):
        items.append("API & data: define the endpoints and persistence for the data this feature reads and writes.")
    if _has(text, ("login", "sign in", "sign-in", "auth", "identity", "account", "session", "access", "permission")):
        items.append("Auth: handle authentication, session, and access control for the feature.")
    if _has(text, ("search", "filter", "list", "grid", "catalog", "category", "faq", "navigation")):
        items.append("Data access: implement query, filtering, and pagination for the listed content.")
    if related:
        names = ", ".join(_title(node) for node in related if _title(node))[:160]
        items.append(f"Integration: wire up the referenced sources/designs ({names}).")
    items.append("Quality: add automated tests covering each functional requirement's acceptance criteria.")
    return items


def _open_questions(
    requirements: list[dict[str, Any]],
    ai_questions: list[str],
) -> list[str]:
    questions: list[str] = []
    for node in requirements:
        title = _title(node) or str(node.get("id"))
        if not _content(node):
            questions.append(f"{title} has no description on the canvas yet.")
        impact = _impact(node)
        if impact:
            status = str(impact.get("status") or "review")
            reason = _clip(str(impact.get("reason") or "Review against the latest change."), 200)
            questions.append(f"{title} is flagged {status}: {reason}")
    questions.extend(ai_questions)
    seen: set[str] = set()
    return [q for q in questions if not (q in seen or seen.add(q))][:8]


def _render_spec(
    feature_name: str,
    project: dict[str, Any],
    overview: str,
    functional: list[dict[str, Any]],
    development: list[str],
    related: list[dict[str, Any]],
    dependencies: list[dict[str, Any]],
    open_questions: list[str],
    instruction: str,
    generated_at: str,
) -> str:
    lines = [
        f"# Feature Specification: {feature_name}",
        "",
        f"**Source**: AI Mindmap project `{project.get('id') or 'unknown'}` · "
        f"**Generated**: {generated_at} · **Format**: GitHub Spec Kit",
        "**Status**: Draft · **Input**: Visual project canvas (single source of truth)",
        "",
        "## Overview",
        overview or "This feature is defined by the functional requirements below.",
    ]
    if instruction:
        lines.extend(["", "## Requested Focus", _clip(instruction, 600)])

    lines.extend(["", "## Functional Requirements"])
    if functional:
        for item in functional:
            trace = f" _(canvas: `{item['source_id']}`)_" if item.get("source_id") else ""
            lines.append(f"- **{item['fr_id']}** {item['statement']}{trace}")
            lines.extend(f"  - {criterion}" for criterion in item["criteria"])
    else:
        lines.append(f"- {CLARIFY.format(reason='no requirement nodes are connected to this feature')}")

    lines.extend(
        [
            "",
            "## Development Requirements",
            "_Likely technical work to implement the functional requirements — refine during planning._",
        ]
    )
    if development:
        for index, item in enumerate(development, start=1):
            lines.append(f"- **DR-{index:03d}** {item}")
    else:
        lines.append("- _None identified yet._")

    lines.extend(["", "## Key Entities & References"])
    if related:
        for node in related:
            detail = _clip(_content(node) or "No detail captured.", 200)
            lines.append(f"- **{_title(node)}** (`{_canvas_type(node)}`) — {detail}")
    else:
        lines.append("_No source or reference nodes connected on the canvas._")

    if dependencies:
        lines.extend(["", "## Dependencies"])
        lines.extend(f"- Depends on **{_title(node)}** _(canvas: `{node.get('id')}`)_" for node in dependencies)

    lines.extend(["", "## Open Questions"])
    lines.extend(
        [f"- {question}" for question in open_questions]
        or ["_None; the spec is ready for implementation._"]
    )

    lines.extend(
        [
            "",
            "## Review & Acceptance Checklist",
            "- [ ] Each functional requirement is testable and traces to its canvas node",
            "- [ ] Development requirements are validated with engineering",
            "- [ ] Open questions are resolved",
            "",
        ]
    )
    return "\n".join(lines).strip() + "\n"


def _related_sources(
    focus: dict[str, Any],
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    focus_id = str(focus.get("id"))
    by_id = {str(node.get("id")): node for node in nodes}
    connected: list[dict[str, Any]] = []
    seen: set[str] = set()
    for edge in edges:
        source = str(edge.get("source") or "")
        target = str(edge.get("target") or "")
        other = target if source == focus_id else source if target == focus_id else None
        if not other or other in seen:
            continue
        node = by_id.get(other)
        if node and _canvas_type(node) in {"source_snapshot", "link"}:
            seen.add(other)
            connected.append(node)
    return connected


def _dependency_ids(
    focus: dict[str, Any],
    requirements: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> set[str]:
    # A "depends on" edge is directional: source depends on target. The focused
    # feature's dependencies are the targets of its own outgoing edges.
    focus_id = str(focus.get("id"))
    requirement_ids = {str(node.get("id")) for node in requirements}
    dependencies: set[str] = set()
    for edge in edges:
        if _relationship(edge) != "depends on" or str(edge.get("source") or "") != focus_id:
            continue
        target = str(edge.get("target") or "")
        if target in requirement_ids and target != focus_id:
            dependencies.add(target)
    return dependencies


def _statement_and_criteria(node: dict[str, Any] | None) -> tuple[str, list[str]]:
    """Split a requirement body into its statement and acceptance criteria.

    Explicit bullet lists become the criteria. Otherwise the first sentence is
    the statement and any further sentences become criteria — so a requirement
    is rarely left without testable detail and never needs a placeholder.
    """
    content = _content(node)
    title = _title(node)
    if not content:
        return title or "Untitled requirement", []

    statement_lines: list[str] = []
    bullets: list[str] = []
    for raw in content.splitlines():
        line = raw.strip()
        if not line:
            continue
        match = re.match(r"^(?:[-*+]|\d+[.)])\s+(.*)$", line)
        if match:
            text = match.group(1).strip()
            if text:
                bullets.append(text)
        elif not bullets:
            statement_lines.append(line)

    if bullets:
        statement = " ".join(statement_lines).strip() or title or "Untitled requirement"
        return _clip(statement, 280), [_clip(item, 200) for item in bullets]

    prose = " ".join(statement_lines).strip() or content
    sentences = _sentences(prose)
    if len(sentences) > 1:
        return _clip(sentences[0], 280), [_clip(sentence, 200) for sentence in sentences[1:5]]
    return _clip(prose, 280), []


def _must_phrase(statement: str) -> str:
    """Best-effort rewrite of a plain statement into MUST-style FR notation."""
    text = statement.strip()
    if not text:
        return "The system MUST satisfy this requirement"
    low = text.lower()
    if low.startswith("users can "):
        return "Users MUST be able to " + text[len("users can "):]
    if low.startswith("user can "):
        return "Users MUST be able to " + text[len("user can "):]
    if low.startswith(("the system ", "system ", "the system must", "users must")):
        return text
    return "The system MUST support: " + text


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [part.strip() for part in parts if part.strip()]


def _has(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def _canvas_type(node: dict[str, Any] | None) -> str:
    data = node.get("data") if isinstance(node, dict) and isinstance(node.get("data"), dict) else {}
    return str(data.get("canvasType") or "")


def _title(node: dict[str, Any] | None) -> str:
    data = node.get("data") if isinstance(node, dict) and isinstance(node.get("data"), dict) else {}
    return str(data.get("title") or "").strip()


def _content(node: dict[str, Any] | None) -> str:
    data = node.get("data") if isinstance(node, dict) and isinstance(node.get("data"), dict) else {}
    fields = data.get("fields") if isinstance(data.get("fields"), dict) else {}
    return str(fields.get("content") or "").strip()


def _impact(node: dict[str, Any] | None) -> dict[str, Any] | None:
    data = node.get("data") if isinstance(node, dict) and isinstance(node.get("data"), dict) else {}
    impact = data.get("impact")
    return impact if isinstance(impact, dict) else None


def _relationship(edge: dict[str, Any]) -> str:
    data = edge.get("data") if isinstance(edge.get("data"), dict) else {}
    return str(edge.get("label") or data.get("relationship") or "references").strip()


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:48] or "feature"


def _clip(value: str, limit: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    return normalized if len(normalized) <= limit else f"{normalized[: limit - 1].rstrip()}…"


def _utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")

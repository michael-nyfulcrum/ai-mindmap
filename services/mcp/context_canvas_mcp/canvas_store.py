from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import json
import re
import sqlite3
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

from context_canvas_mcp.settings import load_canvas_database_settings


class CanvasProjectSummary(BaseModel):
    id: str
    name: str
    description: str | None = None
    updated_at: str
    node_count: int
    requirement_count: int
    source_count: int


class CanvasNodeSummary(BaseModel):
    id: str
    title: str
    canvas_type: str
    body: str = ""
    tags: list[str] = Field(default_factory=list)
    source_node_ids: list[str] = Field(default_factory=list)


class CanvasRelationshipSummary(BaseModel):
    id: str
    source: str
    target: str
    relationship: str


class CanvasAgentContext(BaseModel):
    project_id: str
    project_name: str
    project_description: str | None = None
    updated_at: str
    task: str | None = None
    summary: str
    requirements: list[CanvasNodeSummary]
    sources: list[CanvasNodeSummary]
    relationships: list[CanvasRelationshipSummary]
    markdown: str


class CanvasMutationResult(BaseModel):
    status: str
    project_id: str
    node_id: str
    title: str
    message: str


@dataclass(slots=True)
class CanvasStore:
    db_path: Path

    @classmethod
    def from_settings(cls) -> "CanvasStore":
        return cls(load_canvas_database_settings().path)

    def list_projects(self, limit: int = 20) -> list[CanvasProjectSummary]:
        if not self.db_path.exists():
            return []
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    p.id,
                    p.name,
                    p.description,
                    p.updated_at,
                    COUNT(n.id) AS node_count,
                    SUM(CASE WHEN json_extract(n.payload_json, '$.data.canvasType') = 'requirement' THEN 1 ELSE 0 END) AS requirement_count,
                    SUM(CASE WHEN json_extract(n.payload_json, '$.data.canvasType') IN ('source_snapshot', 'link') THEN 1 ELSE 0 END) AS source_count
                FROM projects p
                LEFT JOIN canvas_nodes n ON n.project_id = p.id
                GROUP BY p.id
                ORDER BY p.updated_at DESC
                LIMIT ?
                """,
                (max(1, min(limit, 50)),),
            ).fetchall()
        return [
            CanvasProjectSummary(
                id=row["id"],
                name=row["name"],
                description=row["description"],
                updated_at=row["updated_at"],
                node_count=int(row["node_count"] or 0),
                requirement_count=int(row["requirement_count"] or 0),
                source_count=int(row["source_count"] or 0),
            )
            for row in rows
        ]

    def get_snapshot(self, project_id: str | None = None) -> dict[str, Any] | None:
        resolved_project_id = project_id or self._latest_project_id()
        if not resolved_project_id:
            return None
        with self._connect() as connection:
            project = connection.execute("SELECT * FROM projects WHERE id = ?", (resolved_project_id,)).fetchone()
            if not project:
                return None
            nodes = [
                _normalize_canvas_node(json.loads(row["payload_json"]))
                for row in connection.execute(
                    "SELECT payload_json FROM canvas_nodes WHERE project_id = ? ORDER BY created_at ASC",
                    (resolved_project_id,),
                ).fetchall()
            ]
            edges = [
                json.loads(row["payload_json"])
                for row in connection.execute(
                    "SELECT payload_json FROM canvas_edges WHERE project_id = ? ORDER BY created_at ASC",
                    (resolved_project_id,),
                ).fetchall()
            ]
        return {
            "project": {
                "id": project["id"],
                "name": project["name"],
                "description": project["description"],
                "createdAt": project["created_at"],
                "updatedAt": project["updated_at"],
                "viewport": _loads(project["viewport_json"], None),
            },
            "nodes": nodes,
            "edges": edges,
        }

    def get_agent_context(self, project_id: str | None = None, task: str | None = None) -> CanvasAgentContext | None:
        snapshot = self.get_snapshot(project_id)
        if not snapshot:
            return None

        project = snapshot["project"]
        nodes = snapshot["nodes"]
        edges = snapshot["edges"]
        requirements = [_node_summary(node) for node in nodes if _canvas_type(node) == "requirement"]
        sources = [_node_summary(node) for node in nodes if _canvas_type(node) in {"source_snapshot", "link", "project_contract"}]
        relationships = [
            CanvasRelationshipSummary(
                id=str(edge.get("id") or ""),
                source=str(edge.get("source") or ""),
                target=str(edge.get("target") or ""),
                relationship=str(edge.get("label") or (edge.get("data") or {}).get("relationship") or "references"),
            )
            for edge in edges
        ]
        summary = (
            f"{project['name']} has {len(requirements)} requirement nodes, "
            f"{len(sources)} source/contract nodes, and {len(relationships)} relationships."
        )
        return CanvasAgentContext(
            project_id=project["id"],
            project_name=project["name"],
            project_description=project.get("description"),
            updated_at=project["updatedAt"],
            task=task.strip() if task else None,
            summary=summary,
            requirements=requirements,
            sources=sources,
            relationships=relationships,
            markdown=_context_markdown(project, requirements, sources, relationships, task),
        )

    def upsert_requirement(
        self,
        project_id: str,
        title: str,
        content: str,
        source_node_ids: list[str] | None = None,
        tags: list[str] | None = None,
        node_id: str | None = None,
    ) -> CanvasMutationResult:
        clean_title = _required_text(title, "title")
        clean_content = _required_text(content, "content")
        resolved_node_id = node_id or f"node_req_{_slug(clean_title)}_{uuid4().hex[:8]}"
        now = _utc_now()
        node = {
            "id": resolved_node_id,
            "type": "contextNode",
            "position": {"x": 120, "y": 120},
            "data": {
                "canvasType": "requirement",
                "title": clean_title,
                "fields": {
                    "content": clean_content,
                },
                "tags": _clean_tags(tags),
                "updatedAt": now,
            },
        }
        return self._upsert_node(project_id, node, "requirement", source_node_ids=source_node_ids)

    def upsert_source_snapshot(
        self,
        project_id: str,
        title: str,
        source_type: str,
        source_id: str,
        summary: str,
        source_url: str = "",
        raw_text: str = "",
        tags: list[str] | None = None,
        node_id: str | None = None,
    ) -> CanvasMutationResult:
        clean_title = _required_text(title, "title")
        clean_summary = _required_text(summary, "summary")
        resolved_node_id = node_id or f"node_source_{_slug(source_id or clean_title)}_{uuid4().hex[:8]}"
        now = _utc_now()
        node = {
            "id": resolved_node_id,
            "type": "contextNode",
            "position": {"x": 80, "y": 80},
            "data": {
                "canvasType": "source_snapshot",
                "title": clean_title,
                "fields": {
                    "content": _source_snapshot_content(
                        source_type=source_type,
                        source_id=source_id or resolved_node_id,
                        source_url=source_url,
                        raw_text=raw_text,
                        summary=clean_summary,
                        fetched_at=now,
                    ),
                },
                "tags": _clean_tags(tags or ["source"]),
                "updatedAt": now,
            },
        }
        return self._upsert_node(project_id, node, "source snapshot")

    def _upsert_node(
        self,
        project_id: str,
        node: dict[str, Any],
        label: str,
        source_node_ids: list[str] | None = None,
    ) -> CanvasMutationResult:
        node = _normalize_canvas_node(node)
        with self._connect() as connection:
            project = connection.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not project:
                raise ValueError(f"Project not found: {project_id}")
            now = _utc_now()
            existing = connection.execute(
                "SELECT id FROM canvas_nodes WHERE project_id = ? AND id = ?",
                (project_id, node["id"]),
            ).fetchone()
            if existing:
                current_payload = connection.execute(
                    "SELECT payload_json FROM canvas_nodes WHERE project_id = ? AND id = ?",
                    (project_id, node["id"]),
                ).fetchone()
                current_node = _loads(current_payload["payload_json"], {}) if current_payload else {}
                if isinstance(current_node, dict) and isinstance(current_node.get("position"), dict):
                    node["position"] = current_node["position"]
                connection.execute(
                    "UPDATE canvas_nodes SET payload_json = ?, updated_at = ? WHERE project_id = ? AND id = ?",
                    (_json(node), now, project_id, node["id"]),
                )
                status = "updated"
            else:
                connection.execute(
                    "INSERT INTO canvas_nodes (id, project_id, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (node["id"], project_id, _json(node), now, now),
                )
                status = "created"
            if _canvas_type(node) == "requirement":
                self._sync_source_edges(connection, project_id, str(node["id"]), source_node_ids or [], now)
            connection.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
            connection.commit()
        return CanvasMutationResult(
            status=status,
            project_id=project_id,
            node_id=node["id"],
            title=str(node["data"]["title"]),
            message=f"{status.capitalize()} {label} node '{node['data']['title']}'.",
        )

    def _latest_project_id(self) -> str | None:
        if not self.db_path.exists():
            return None
        with self._connect() as connection:
            row = connection.execute("SELECT id FROM projects ORDER BY updated_at DESC LIMIT 1").fetchone()
        return str(row["id"]) if row else None

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @staticmethod
    def _sync_source_edges(
        connection: sqlite3.Connection,
        project_id: str,
        target_id: str,
        source_node_ids: list[str],
        now: str,
    ) -> None:
        source_ids = [item.strip() for item in source_node_ids if item.strip()]
        if not source_ids:
            return
        connection.execute(
            "DELETE FROM canvas_edges WHERE project_id = ? AND target_node_id = ? AND id LIKE 'edge_mcp_%'",
            (project_id, target_id),
        )
        for source_id in source_ids:
            if source_id == target_id:
                continue
            source_exists = connection.execute(
                "SELECT 1 FROM canvas_nodes WHERE project_id = ? AND id = ?",
                (project_id, source_id),
            ).fetchone()
            if not source_exists:
                continue
            edge_id = f"edge_mcp_{_slug(source_id)}_{_slug(target_id)}"
            edge = {
                "id": edge_id,
                "source": source_id,
                "target": target_id,
                "type": "smoothstep",
                "label": "supports",
                "data": {"relationship": "supports", "updatedAt": now, "managedBy": "context_canvas_mcp"},
            }
            connection.execute(
                """
                INSERT INTO canvas_edges (id, project_id, source_node_id, target_node_id, payload_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, id) DO UPDATE SET
                    source_node_id = excluded.source_node_id,
                    target_node_id = excluded.target_node_id,
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
                """,
                (edge_id, project_id, source_id, target_id, _json(edge), now, now),
            )


def _node_summary(node: dict[str, Any]) -> CanvasNodeSummary:
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    fields = data.get("fields") if isinstance(data.get("fields"), dict) else {}
    body = str(fields.get("content") or "")
    return CanvasNodeSummary(
        id=str(node.get("id") or ""),
        title=str(data.get("title") or node.get("id") or "Untitled node"),
        canvas_type=str(data.get("canvasType") or "unknown"),
        body=body,
        tags=[str(tag) for tag in data.get("tags") or []],
        source_node_ids=[],
    )


def _context_markdown(
    project: dict[str, Any],
    requirements: list[CanvasNodeSummary],
    sources: list[CanvasNodeSummary],
    relationships: list[CanvasRelationshipSummary],
    task: str | None,
) -> str:
    lines = [
        f"# {project['name']}",
        "",
        f"Project ID: `{project['id']}`",
        f"Updated: `{project['updatedAt']}`",
    ]
    if project.get("description"):
        lines.extend(["", str(project["description"])])
    if task and task.strip():
        lines.extend(["", "## Current Task", task.strip()])
    lines.extend(["", "## Requirements"])
    lines.extend(_node_lines(requirements) or ["- No requirement nodes saved."])
    lines.extend(["", "## Sources And Contract"])
    lines.extend(_node_lines(sources) or ["- No source or contract nodes saved."])
    lines.extend(["", "## Relationships"])
    lines.extend(
        [f"- `{item.source}` -> `{item.target}`: {item.relationship}" for item in relationships]
        or ["- No relationships saved."]
    )
    return "\n".join(lines)


def _node_lines(nodes: list[CanvasNodeSummary]) -> list[str]:
    return [f"- `{node.id}` {node.title}: {_clip(node.body, 360)}" for node in nodes]


def _canvas_type(node: dict[str, Any]) -> str:
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    return str(data.get("canvasType") or "")


def _loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def _normalize_canvas_node(node: dict[str, Any]) -> dict[str, Any]:
    data = node.get("data")
    if not isinstance(data, dict):
        return node

    fields = data.get("fields")
    if not isinstance(fields, dict):
        normalized = dict(node)
        normalized["data"] = {**data, "fields": {"content": ""}}
        return normalized
    if set(fields.keys()) == {"content"}:
        return node

    normalized = dict(node)
    normalized["data"] = {**data, "fields": {"content": _content_from_legacy_fields(fields)}}
    return normalized


def _source_snapshot_content(
    source_type: str,
    source_id: str,
    source_url: str,
    raw_text: str,
    summary: str,
    fetched_at: str,
) -> str:
    parts = [
        source_url.strip(),
        summary.strip(),
        raw_text.strip(),
        f"Source type\n{source_type.strip() or 'manual'}",
        f"Source ID\n{source_id.strip()}",
        f"Fetched at\n{fetched_at}",
        "Added through Context Canvas MCP.",
    ]
    return "\n\n".join(part for part in parts if part)


def _content_from_legacy_fields(fields: dict[str, Any]) -> str:
    content = str(fields.get("content") or "").strip()
    ordered_keys = [
        "assetUrl",
        "url",
        "sourceUrl",
        "body",
        "summary",
        "rawText",
        "notes",
        "extractedText",
        "goal",
        "scope",
        "nonGoals",
        "requirements",
        "acceptanceCriteria",
        "constraints",
        "definitionOfDone",
        "sourceType",
        "sourceId",
        "priority",
        "status",
        "sourceNodeIds",
        "fetchedAt",
        "lastFetchedAt",
        "metadata",
    ]
    legacy_parts: list[str] = [content] if content else []
    seen = {"content"}
    for key in ordered_keys + sorted(str(field) for field in fields.keys()):
        if key in seen:
            continue
        seen.add(key)
        value = fields.get(key)
        if str(value or "").strip():
            legacy_parts.append(_legacy_field_text(key, value))
    return "\n\n".join(legacy_parts)


def _legacy_field_text(key: str, value: Any) -> str:
    text = str(value).strip()
    if key == "assetUrl":
        return f"![Uploaded image]({text})"
    if key in {"url", "sourceUrl"}:
        return text
    return f"{_title_case_field(key)}\n{text}"


def _title_case_field(value: str) -> str:
    words = value.replace("_", " ").replace("-", " ")
    words = "".join(f" {char}" if char.isupper() else char for char in words).split()
    return " ".join(word.upper() if word.lower() in {"id", "ids", "url", "urls", "api"} else word.capitalize() for word in words)


def _json(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _clip(value: str, limit: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    return normalized if len(normalized) <= limit else f"{normalized[: limit - 1].rstrip()}…"


def _required_text(value: str, field: str) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    if not normalized:
        raise ValueError(f"{field} is required.")
    return normalized


def _clean_tags(tags: list[str] | None) -> list[str]:
    return [tag for tag in [re.sub(r"\s+", "-", item.strip().lower()) for item in tags or []] if tag][:12]


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:40] or "canvas"


def _utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")

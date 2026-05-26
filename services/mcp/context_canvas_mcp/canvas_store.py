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
    impact_status: str | None = None
    impact_reason: str | None = None
    impact_source_node_id: str | None = None


class CanvasChangeSummary(BaseModel):
    id: str
    node_id: str
    node_title: str
    version_number: int
    change_type: str
    summary: str
    created_by: str
    created_at: str


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
    flagged_nodes: list[CanvasNodeSummary] = Field(default_factory=list)
    recent_changes: list[CanvasChangeSummary] = Field(default_factory=list)
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
        flagged_nodes = [_node_summary(node) for node in nodes if _node_impact(node)]
        recent_changes = self._recent_changes(project["id"])
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
            flagged_nodes=flagged_nodes,
            recent_changes=recent_changes,
            relationships=relationships,
            markdown=_context_markdown(project, requirements, sources, flagged_nodes, recent_changes, relationships, task),
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
            current_node: dict[str, Any] | None = None
            existing = connection.execute(
                "SELECT id FROM canvas_nodes WHERE project_id = ? AND id = ?",
                (project_id, node["id"]),
            ).fetchone()
            if existing:
                current_payload = connection.execute(
                    "SELECT payload_json FROM canvas_nodes WHERE project_id = ? AND id = ?",
                    (project_id, node["id"]),
                ).fetchone()
                loaded_node = _loads(current_payload["payload_json"], {}) if current_payload else {}
                current_node = loaded_node if isinstance(loaded_node, dict) else {}
                if isinstance(current_node, dict) and isinstance(current_node.get("position"), dict):
                    node["position"] = current_node["position"]
            changed_fields = _changed_version_fields(current_node, node)
            node = _with_audit_metadata(
                node=node,
                existing=current_node,
                actor="context_canvas_mcp",
                now=now,
                touched=current_node is None or _node_changed(current_node, node),
                clear_impact=bool(changed_fields),
            )
            if existing:
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
            if changed_fields:
                self._ensure_contract_change_table(connection)
                self._insert_change_version(
                    connection=connection,
                    project_id=project_id,
                    before=current_node,
                    after=node,
                    changed_fields=changed_fields,
                    actor="context_canvas_mcp",
                    now=now,
                )
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

    def _recent_changes(self, project_id: str) -> list[CanvasChangeSummary]:
        if not self.db_path.exists():
            return []
        with self._connect() as connection:
            tables = {
                str(row["name"])
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contract_change_versions'"
                ).fetchall()
            }
            if "contract_change_versions" not in tables:
                return []
            rows = connection.execute(
                """
                SELECT id, node_id, node_title, version_number, change_type, summary, created_by, created_at
                FROM contract_change_versions
                WHERE project_id = ?
                ORDER BY created_at DESC
                LIMIT 8
                """,
                (project_id,),
            ).fetchall()
        return [
            CanvasChangeSummary(
                id=row["id"],
                node_id=row["node_id"],
                node_title=row["node_title"],
                version_number=int(row["version_number"]),
                change_type=row["change_type"],
                summary=row["summary"],
                created_by=row["created_by"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    @staticmethod
    def _ensure_contract_change_table(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS contract_change_versions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                node_id TEXT NOT NULL,
                node_title TEXT NOT NULL,
                node_type TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted')),
                summary TEXT NOT NULL,
                changed_fields_json TEXT NOT NULL,
                affected_nodes_json TEXT NOT NULL,
                before_json TEXT,
                after_json TEXT,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_contract_versions_project_node
            ON contract_change_versions (project_id, node_id, version_number DESC);

            CREATE TABLE IF NOT EXISTS schema_migrations (
                id TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            """
        )
        connection.execute(
            """
            INSERT INTO schema_migrations (id, applied_at)
            VALUES (?, ?)
            ON CONFLICT(id) DO NOTHING
            """,
            ("2026_05_26_contract_change_versions", _utc_now()),
        )

    def _insert_change_version(
        self,
        connection: sqlite3.Connection,
        project_id: str,
        before: dict[str, Any] | None,
        after: dict[str, Any],
        changed_fields: list[str],
        actor: str,
        now: str,
    ) -> None:
        node_id = str(after.get("id") or (before or {}).get("id") or "")
        data = after.get("data") if isinstance(after.get("data"), dict) else {}
        version_id = f"version_{uuid4().hex}"
        version_number = self._next_version_number(connection, project_id, node_id)
        change_type = "created" if before is None else "updated"
        node_title = str(data.get("title") or node_id)
        node_type = str(data.get("canvasType") or "requirement")
        summary = f"{change_type.capitalize()} {node_title} through MCP: {', '.join(changed_fields)} changed."
        connection.execute(
            """
            INSERT INTO contract_change_versions (
                id, project_id, node_id, node_title, node_type, version_number,
                change_type, summary, changed_fields_json, affected_nodes_json,
                before_json, after_json, created_by, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                version_id,
                project_id,
                node_id,
                node_title,
                node_type,
                version_number,
                change_type,
                summary,
                _json(changed_fields),
                _json([]),
                _json(before) if before is not None else None,
                _json(after),
                actor,
                now,
            ),
        )

    @staticmethod
    def _next_version_number(connection: sqlite3.Connection, project_id: str, node_id: str) -> int:
        row = connection.execute(
            "SELECT COALESCE(MAX(version_number), 0) AS version_number FROM contract_change_versions WHERE project_id = ? AND node_id = ?",
            (project_id, node_id),
        ).fetchone()
        return int(row["version_number"]) + 1 if row else 1

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
        connection.execute(
            "DELETE FROM canvas_edges WHERE project_id = ? AND target_node_id = ? AND id LIKE 'edge_mcp_%'",
            (project_id, target_id),
        )
        if not source_ids:
            return
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
    impact = _node_impact(node)
    body = str(fields.get("content") or "")
    return CanvasNodeSummary(
        id=str(node.get("id") or ""),
        title=str(data.get("title") or node.get("id") or "Untitled node"),
        canvas_type=str(data.get("canvasType") or "unknown"),
        body=body,
        tags=[str(tag) for tag in data.get("tags") or []],
        source_node_ids=[],
        impact_status=str(impact.get("status")) if impact else None,
        impact_reason=str(impact.get("reason")) if impact else None,
        impact_source_node_id=str(impact.get("sourceNodeId")) if impact else None,
    )


def _context_markdown(
    project: dict[str, Any],
    requirements: list[CanvasNodeSummary],
    sources: list[CanvasNodeSummary],
    flagged_nodes: list[CanvasNodeSummary],
    recent_changes: list[CanvasChangeSummary],
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
    lines.extend(["", "## Active Impact Flags"])
    lines.extend(_flag_lines(flagged_nodes) or ["- No active impact flags."])
    lines.extend(["", "## Recent Contract Changes"])
    lines.extend(_change_lines(recent_changes) or ["- No contract or requirement versions recorded."])
    lines.extend(["", "## Relationships"])
    lines.extend(
        [f"- `{item.source}` -> `{item.target}`: {item.relationship}" for item in relationships]
        or ["- No relationships saved."]
    )
    return "\n".join(lines)


def _node_lines(nodes: list[CanvasNodeSummary]) -> list[str]:
    return [f"- `{node.id}` {node.title}{_impact_suffix(node)}: {_clip(node.body, 360)}" for node in nodes]


def _flag_lines(nodes: list[CanvasNodeSummary]) -> list[str]:
    return [
        f"- `{node.id}` {node.title}: {node.impact_status or 'review'} - {_clip(node.impact_reason or '', 220)}"
        for node in nodes
    ]


def _change_lines(changes: list[CanvasChangeSummary]) -> list[str]:
    return [
        f"- `{change.node_id}` v{change.version_number} {change.change_type}: {_clip(change.summary, 260)}"
        for change in changes
    ]


def _impact_suffix(node: CanvasNodeSummary) -> str:
    if not node.impact_status:
        return ""
    return f" [{node.impact_status}]"


def _node_impact(node: dict[str, Any]) -> dict[str, Any] | None:
    data = node.get("data") if isinstance(node.get("data"), dict) else {}
    impact = data.get("impact")
    return impact if isinstance(impact, dict) else None


def _changed_version_fields(before: dict[str, Any] | None, after: dict[str, Any]) -> list[str]:
    if _canvas_type(after) not in {"project_contract", "requirement"}:
        return []
    if before is None:
        return ["created"]
    fields: list[str] = []
    before_data = before.get("data") if isinstance(before.get("data"), dict) else {}
    after_data = after.get("data") if isinstance(after.get("data"), dict) else {}
    if before_data.get("title") != after_data.get("title"):
        fields.append("title")
    if before_data.get("tags") != after_data.get("tags"):
        fields.append("tags")
    if _node_content(before) != _node_content(after):
        fields.append("content")
    return fields


def _node_changed(before: dict[str, Any] | None, after: dict[str, Any]) -> bool:
    if before is None:
        return True
    before_data = before.get("data") if isinstance(before.get("data"), dict) else {}
    after_data = after.get("data") if isinstance(after.get("data"), dict) else {}
    return (
        before_data.get("title") != after_data.get("title")
        or before_data.get("tags") != after_data.get("tags")
        or _node_content(before) != _node_content(after)
    )


def _with_audit_metadata(
    node: dict[str, Any],
    existing: dict[str, Any] | None,
    actor: str,
    now: str,
    touched: bool,
    clear_impact: bool,
) -> dict[str, Any]:
    data = node.get("data")
    if not isinstance(data, dict):
        return node
    existing_data = existing.get("data") if existing and isinstance(existing.get("data"), dict) else {}
    previous_audit = existing_data.get("audit") if isinstance(existing_data.get("audit"), dict) else {}
    incoming_audit = data.get("audit") if isinstance(data.get("audit"), dict) else {}
    next_data = {key: value for key, value in data.items() if not (clear_impact and key == "impact")}
    next_data["audit"] = {
        "createdAt": previous_audit.get("createdAt") or incoming_audit.get("createdAt") or now,
        "createdBy": previous_audit.get("createdBy") or incoming_audit.get("createdBy") or actor,
        "updatedAt": now if touched else previous_audit.get("updatedAt") or incoming_audit.get("updatedAt") or data.get("updatedAt") or now,
        "updatedBy": actor if touched else previous_audit.get("updatedBy") or incoming_audit.get("updatedBy") or actor,
    }
    if not clear_impact:
        preserved_impact = data.get("impact") or existing_data.get("impact")
        if preserved_impact:
            next_data["impact"] = preserved_impact
    return {**node, "data": next_data}


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

    data = {key: value for key, value in data.items() if key != "highlighted"}
    node = {**node, "data": data}
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

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any
from uuid import uuid4

from context_canvas_api.analyzer import analyze_change_impact
from context_canvas_api.demo import demo_snapshot, utc_now
from context_canvas_api.models import AnalysisResponse, CanvasSnapshot, ChatMessage, ChatThread, ContractChangeVersion, Project


def database_path() -> Path:
    explicit = os.getenv("CONTEXT_CANVAS_DATABASE_URL")
    if explicit:
        if explicit.startswith("sqlite:///"):
            return Path(explicit.removeprefix("sqlite:///")).expanduser()
        return Path(explicit).expanduser()
    return Path(__file__).resolve().parents[1] / "context-canvas.sqlite"


class AppDatabase:
    def __init__(self, path: Path | None = None, seed: bool = True) -> None:
        self.path = path or database_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys = ON")
        self.connection.execute("PRAGMA journal_mode = WAL")
        self.connection.execute("PRAGMA busy_timeout = 5000")
        self._migrate()
        if seed:
            self._seed()

    def close(self) -> None:
        self.connection.close()

    def _migrate(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                viewport_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS canvas_nodes (
                id TEXT NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (project_id, id)
            );

            CREATE TABLE IF NOT EXISTS canvas_edges (
                id TEXT NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                source_node_id TEXT NOT NULL,
                target_node_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (project_id, id)
            );

            CREATE TABLE IF NOT EXISTS uploads (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                content_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS analysis_runs (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                question TEXT NOT NULL,
                response_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_threads (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                analysis_json TEXT,
                created_at TEXT NOT NULL
            );

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

            CREATE INDEX IF NOT EXISTS idx_chat_messages_thread
            ON chat_messages (thread_id, created_at);

            CREATE INDEX IF NOT EXISTS idx_chat_threads_project
            ON chat_threads (project_id, updated_at DESC);

            CREATE INDEX IF NOT EXISTS idx_uploads_project
            ON uploads (project_id);

            CREATE INDEX IF NOT EXISTS idx_analysis_runs_project
            ON analysis_runs (project_id);

            CREATE TABLE IF NOT EXISTS schema_migrations (
                id TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            """
        )
        self._migrate_legacy_canvas_nodes()
        self._migrate_legacy_canvas_edges()
        self._migrate_legacy_uploads()
        self._migrate_legacy_analysis_runs()
        self._record_schema_migration("2026_05_26_contract_change_versions")
        self._record_schema_migration("2026_06_03_fk_indexes")
        self.connection.commit()

    def _record_schema_migration(self, migration_id: str) -> None:
        self.connection.execute(
            """
            INSERT INTO schema_migrations (id, applied_at)
            VALUES (?, ?)
            ON CONFLICT(id) DO NOTHING
            """,
            (migration_id, utc_now()),
        )

    def _migrate_legacy_canvas_nodes(self) -> None:
        columns = self._table_columns("canvas_nodes")
        if not columns or "payload_json" in columns:
            return

        rows = self.connection.execute(
            """
            SELECT id, project_id, type, title, position_json, data_json, created_at, updated_at
            FROM canvas_nodes
            ORDER BY created_at ASC
            """
        ).fetchall()
        self.connection.execute("ALTER TABLE canvas_nodes RENAME TO canvas_nodes_legacy")
        self.connection.execute(
            """
            CREATE TABLE canvas_nodes (
                id TEXT NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (project_id, id)
            )
            """
        )
        for row in rows:
            payload = {
                "id": row["id"],
                "type": "contextNode",
                "position": _loads(row["position_json"], {"x": 0, "y": 0}),
                "data": _loads(row["data_json"], {}),
            }
            if not payload["data"].get("title"):
                payload["data"]["title"] = row["title"]
            if not payload["data"].get("canvasType"):
                payload["data"]["canvasType"] = row["type"]
            self.connection.execute(
                """
                INSERT INTO canvas_nodes (id, project_id, payload_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (row["id"], row["project_id"], _json(payload), row["created_at"], row["updated_at"]),
            )
        self.connection.execute("DROP TABLE canvas_nodes_legacy")

    def _migrate_legacy_canvas_edges(self) -> None:
        columns = self._table_columns("canvas_edges")
        if not columns or "payload_json" in columns:
            return

        rows = self.connection.execute(
            """
            SELECT id, project_id, source_node_id, target_node_id, relationship, label, edge_json, created_at, updated_at
            FROM canvas_edges
            ORDER BY created_at ASC
            """
        ).fetchall()
        self.connection.execute("ALTER TABLE canvas_edges RENAME TO canvas_edges_legacy")
        self.connection.execute(
            """
            CREATE TABLE canvas_edges (
                id TEXT NOT NULL,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                source_node_id TEXT NOT NULL,
                target_node_id TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (project_id, id)
            )
            """
        )
        for row in rows:
            payload = _loads(row["edge_json"], {})
            if not payload:
                payload = {
                    "id": row["id"],
                    "source": row["source_node_id"],
                    "target": row["target_node_id"],
                    "label": row["label"] or row["relationship"],
                    "data": {"relationship": row["relationship"], "updatedAt": row["updated_at"]},
                }
            self.connection.execute(
                """
                INSERT INTO canvas_edges (id, project_id, source_node_id, target_node_id, payload_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    row["project_id"],
                    row["source_node_id"],
                    row["target_node_id"],
                    _json(payload),
                    row["created_at"],
                    row["updated_at"],
                ),
            )
        self.connection.execute("DROP TABLE canvas_edges_legacy")

    def _migrate_legacy_uploads(self) -> None:
        columns = self._table_columns("uploads")
        if not columns or "file_path" in columns:
            return

        rows = self.connection.execute(
            """
            SELECT id, project_id, filename, content_type, url, created_at
            FROM uploads
            ORDER BY created_at ASC
            """
        ).fetchall()
        self.connection.execute("ALTER TABLE uploads RENAME TO uploads_legacy")
        self.connection.execute(
            """
            CREATE TABLE uploads (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                content_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        for row in rows:
            file_path = self._legacy_upload_path(row["id"], row["filename"], row["url"])
            self.connection.execute(
                """
                INSERT INTO uploads (id, project_id, filename, content_type, file_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (row["id"], row["project_id"], row["filename"], row["content_type"], file_path, row["created_at"]),
            )
        self.connection.execute("DROP TABLE uploads_legacy")

    def _migrate_legacy_analysis_runs(self) -> None:
        columns = self._table_columns("analysis_runs")
        if not columns or "question" in columns:
            return

        rows = self.connection.execute(
            """
            SELECT id, project_id, request_json, response_json, created_at
            FROM analysis_runs
            ORDER BY created_at ASC
            """
        ).fetchall()
        self.connection.execute("ALTER TABLE analysis_runs RENAME TO analysis_runs_legacy")
        self.connection.execute(
            """
            CREATE TABLE analysis_runs (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                question TEXT NOT NULL,
                response_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        for row in rows:
            request_payload = _loads(row["request_json"], {})
            question = ""
            if isinstance(request_payload, dict):
                question = str(request_payload.get("question") or "")
            self.connection.execute(
                """
                INSERT INTO analysis_runs (id, project_id, question, response_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (row["id"], row["project_id"], question, row["response_json"], row["created_at"]),
            )
        self.connection.execute("DROP TABLE analysis_runs_legacy")

    def _legacy_upload_path(self, upload_id: str, filename: str, legacy_url: str) -> str:
        if legacy_url and not legacy_url.startswith("/api/uploads/"):
            return legacy_url
        upload_dir = Path(os.getenv("CONTEXT_CANVAS_UPLOAD_DIR", Path(__file__).resolve().parents[1] / "uploads"))
        return str(upload_dir / f"{upload_id}-{filename}")

    def _table_columns(self, table_name: str) -> set[str]:
        rows = self.connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        return {str(row["name"]) for row in rows}

    def _seed(self) -> None:
        row = self.connection.execute("SELECT COUNT(*) AS count FROM projects").fetchone()
        if row and int(row["count"]) == 0:
            self.save_snapshot(demo_snapshot())

    def list_projects(self) -> list[Project]:
        rows = self.connection.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
        return [self._project(row) for row in rows]

    def get_project(self, project_id: str) -> Project | None:
        row = self.connection.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        return self._project(row) if row else None

    def create_project(
        self,
        name: str,
        description: str | None = None,
        viewport: dict[str, Any] | None = None,
        nodes: list[dict[str, Any]] | None = None,
        edges: list[dict[str, Any]] | None = None,
        actor: str = "local user",
    ) -> CanvasSnapshot:
        now = utc_now()
        project = Project(
            id=f"project_{uuid4().hex}",
            name=name.strip() or "Untitled canvas",
            description=description,
            createdAt=now,
            updatedAt=now,
            viewport=viewport or {"x": 0, "y": 0, "zoom": 1},
        )
        incoming_nodes = [
            _with_audit_metadata(
                _normalize_canvas_node({**node, "id": node.get("id") or f"node_{uuid4().hex}"}),
                None,
                actor,
                now,
                semantic_changed=True,
            )
            for node in nodes or []
        ]
        incoming_edges = [{**edge, "id": edge.get("id") or f"edge_{uuid4().hex}"} for edge in edges or []]
        with self.connection:
            self.connection.execute(
                """
                INSERT INTO projects (id, name, description, viewport_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    project.id,
                    project.name,
                    project.description,
                    _json(project.viewport),
                    project.createdAt,
                    project.updatedAt,
                ),
            )
            for node in incoming_nodes:
                self._insert_node(project.id, node, now)
            for edge in incoming_edges:
                self._insert_edge(project.id, edge, now)
        return self.get_snapshot(project.id) or CanvasSnapshot(project=project, nodes=incoming_nodes, edges=incoming_edges)

    def patch_project(self, project_id: str, payload: dict[str, Any]) -> Project | None:
        project = self.get_project(project_id)
        if not project:
            return None
        now = utc_now()
        name = str(payload.get("name") or project.name).strip() or project.name
        description = payload.get("description", project.description)
        viewport = payload.get("viewport", project.viewport)
        self.connection.execute(
            """
            UPDATE projects
            SET name = ?, description = ?, viewport_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (name, description, _json(viewport), now, project_id),
        )
        self.connection.commit()
        return self.get_project(project_id)

    def delete_project(self, project_id: str) -> bool:
        cursor = self.connection.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        self.connection.commit()
        return cursor.rowcount > 0

    def get_snapshot(self, project_id: str) -> CanvasSnapshot | None:
        project = self.get_project(project_id)
        if not project:
            return None
        nodes = [
            _normalize_canvas_node(json.loads(row["payload_json"]))
            for row in self.connection.execute(
                "SELECT payload_json FROM canvas_nodes WHERE project_id = ? ORDER BY created_at ASC",
                (project_id,),
            ).fetchall()
        ]
        edges = [
            json.loads(row["payload_json"])
            for row in self.connection.execute(
                "SELECT payload_json FROM canvas_edges WHERE project_id = ? ORDER BY created_at ASC",
                (project_id,),
            ).fetchall()
        ]
        return CanvasSnapshot(project=project, nodes=nodes, edges=edges)

    def save_snapshot(
        self, snapshot: CanvasSnapshot, actor: str = "local user", commit_message: str | None = None
    ) -> CanvasSnapshot:
        existing = self.get_snapshot(snapshot.project.id)
        if existing and _same_saved_canvas(existing, snapshot):
            return existing

        now = utc_now()
        project = snapshot.project.model_copy(update={"updatedAt": now})
        existing_nodes = {node["id"]: node for node in existing.nodes} if existing else {}
        incoming_nodes = [
            _with_audit_metadata(
                _normalize_canvas_node(node),
                existing_nodes.get(str(node.get("id"))),
                actor,
                now,
                semantic_changed=_semantic_changed(existing_nodes.get(str(node.get("id"))), _normalize_canvas_node(node)),
            )
            for node in snapshot.nodes
        ]
        versions = self._build_change_versions(
            project.id, project, existing_nodes, incoming_nodes, snapshot.edges, actor, now, commit_message
        )
        _apply_change_impacts(incoming_nodes, versions)
        with self.connection:
            self.connection.execute(
                """
                INSERT INTO projects (id, name, description, viewport_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    viewport_json = excluded.viewport_json,
                    updated_at = excluded.updated_at
                """,
                (
                    project.id,
                    project.name,
                    project.description,
                    _json(project.viewport),
                    project.createdAt,
                    project.updatedAt,
                ),
            )
            self.connection.execute("DELETE FROM canvas_nodes WHERE project_id = ?", (project.id,))
            self.connection.execute("DELETE FROM canvas_edges WHERE project_id = ?", (project.id,))
            for node in incoming_nodes:
                self._insert_node(project.id, node, now)
            for edge in snapshot.edges:
                self._insert_edge(project.id, edge, now)
            for version in versions:
                self._insert_change_version(version)
        return self.get_snapshot(project.id) or CanvasSnapshot(project=project, nodes=[], edges=[])

    def create_node(self, project_id: str, node: dict[str, Any], actor: str = "local user") -> dict[str, Any] | None:
        project = self.get_project(project_id)
        if not project:
            return None
        now = utc_now()
        node = _with_audit_metadata(_normalize_canvas_node({**node, "id": node.get("id") or f"node_{uuid4().hex}"}), None, actor, now, True)
        versions = self._build_change_versions(project_id, project, {}, [node], [], actor, now)
        _apply_change_impacts([node], versions)
        self._insert_node(project_id, node, now)
        for version in versions:
            self._insert_change_version(version)
        self._touch_project(project_id, now)
        self.connection.commit()
        return node

    def patch_node(self, project_id: str, node_id: str, patch: dict[str, Any], actor: str = "local user") -> dict[str, Any] | None:
        current = self._get_node(project_id, node_id)
        if not current:
            return None
        project = self.get_project(project_id)
        if not project:
            return None
        updated = _normalize_canvas_node(_deep_merge(current, patch))
        updated["id"] = node_id
        now = utc_now()
        updated = _with_audit_metadata(updated, current, actor, now, _semantic_changed(current, updated))
        snapshot = self.get_snapshot(project_id)
        edges = snapshot.edges if snapshot else []
        existing_nodes = {node_id: current}
        if snapshot:
            existing_nodes.update({node["id"]: node for node in snapshot.nodes})
        incoming_nodes = [updated] + [node for node in (snapshot.nodes if snapshot else []) if node["id"] != node_id]
        versions = self._build_change_versions(project_id, project, existing_nodes, incoming_nodes, edges, actor, now)
        _apply_change_impacts(incoming_nodes, versions)
        updated = next(node for node in incoming_nodes if node["id"] == node_id)
        self.connection.execute(
            "UPDATE canvas_nodes SET payload_json = ?, updated_at = ? WHERE project_id = ? AND id = ?",
            (_json(updated), now, project_id, node_id),
        )
        for node in incoming_nodes:
            if node["id"] != node_id and node.get("data", {}).get("impact"):
                self.connection.execute(
                    "UPDATE canvas_nodes SET payload_json = ?, updated_at = ? WHERE project_id = ? AND id = ?",
                    (_json(node), now, project_id, node["id"]),
                )
        for version in versions:
            self._insert_change_version(version)
        self._touch_project(project_id, now)
        self.connection.commit()
        return updated

    def delete_node(self, project_id: str, node_id: str, actor: str = "local user") -> bool:
        project = self.get_project(project_id)
        current = self._get_node(project_id, node_id)
        snapshot = self.get_snapshot(project_id) if project else None
        versions: list[dict[str, Any]] = []
        incoming_nodes = [node for node in (snapshot.nodes if snapshot else []) if node["id"] != node_id]
        if project and current:
            versions = self._build_change_versions(
                project_id,
                project,
                {node["id"]: node for node in (snapshot.nodes if snapshot else [current])},
                incoming_nodes,
                snapshot.edges if snapshot else [],
                actor,
                utc_now(),
            )
            _apply_change_impacts(incoming_nodes, versions)
        with self.connection:
            self.connection.execute(
                "DELETE FROM canvas_edges WHERE project_id = ? AND (source_node_id = ? OR target_node_id = ?)",
                (project_id, node_id, node_id),
            )
            cursor = self.connection.execute(
                "DELETE FROM canvas_nodes WHERE project_id = ? AND id = ?",
                (project_id, node_id),
            )
            if cursor.rowcount:
                now = utc_now()
                for node in incoming_nodes:
                    if node.get("data", {}).get("impact"):
                        self.connection.execute(
                            "UPDATE canvas_nodes SET payload_json = ?, updated_at = ? WHERE project_id = ? AND id = ?",
                            (_json(node), now, project_id, node["id"]),
                        )
                for version in versions:
                    self._insert_change_version(version)
                self._touch_project(project_id, now)
        return cursor.rowcount > 0

    def create_edge(self, project_id: str, edge: dict[str, Any]) -> dict[str, Any] | None:
        if not self.get_project(project_id):
            return None
        if not self._get_node(project_id, str(edge.get("source"))) or not self._get_node(project_id, str(edge.get("target"))):
            raise ValueError("Both edge nodes must exist")
        now = utc_now()
        edge = {**edge, "id": edge.get("id") or f"edge_{uuid4().hex}"}
        self._insert_edge(project_id, edge, now)
        self._touch_project(project_id, now)
        self.connection.commit()
        return edge

    def patch_edge(self, project_id: str, edge_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
        current = self._get_edge(project_id, edge_id)
        if not current:
            return None
        updated = _deep_merge(current, patch)
        updated["id"] = edge_id
        now = utc_now()
        self.connection.execute(
            """
            UPDATE canvas_edges
            SET payload_json = ?, source_node_id = ?, target_node_id = ?, updated_at = ?
            WHERE project_id = ? AND id = ?
            """,
            (_json(updated), updated.get("source"), updated.get("target"), now, project_id, edge_id),
        )
        self._touch_project(project_id, now)
        self.connection.commit()
        return updated

    def delete_edge(self, project_id: str, edge_id: str) -> bool:
        cursor = self.connection.execute(
            "DELETE FROM canvas_edges WHERE project_id = ? AND id = ?",
            (project_id, edge_id),
        )
        if cursor.rowcount:
            self._touch_project(project_id, utc_now())
        self.connection.commit()
        return cursor.rowcount > 0

    def save_upload(self, project_id: str, filename: str, content_type: str, file_path: Path) -> dict[str, str] | None:
        if not self.get_project(project_id):
            return None
        upload_id = f"upload_{uuid4().hex}"
        now = utc_now()
        self.connection.execute(
            """
            INSERT INTO uploads (id, project_id, filename, content_type, file_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (upload_id, project_id, filename, content_type, str(file_path), now),
        )
        self.connection.commit()
        return {
            "id": upload_id,
            "projectId": project_id,
            "filename": filename,
            "contentType": content_type,
            "filePath": str(file_path),
            "url": f"/api/uploads/{upload_id}",
            "createdAt": now,
        }

    def get_upload(self, upload_id: str) -> dict[str, str] | None:
        row = self.connection.execute("SELECT * FROM uploads WHERE id = ?", (upload_id,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "projectId": row["project_id"],
            "filename": row["filename"],
            "contentType": row["content_type"],
            "filePath": row["file_path"],
            "createdAt": row["created_at"],
        }

    def save_analysis_run(self, project_id: str, question: str, response: AnalysisResponse) -> None:
        self.connection.execute(
            """
            INSERT INTO analysis_runs (id, project_id, question, response_json, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (f"analysis_{uuid4().hex}", project_id, question, response.model_dump_json(), utc_now()),
        )
        self.connection.commit()

    def list_chats(self, project_id: str) -> list[ChatThread]:
        rows = self.connection.execute(
            "SELECT * FROM chat_threads WHERE project_id = ? ORDER BY updated_at DESC",
            (project_id,),
        ).fetchall()
        return [self._chat_thread(row) for row in rows]

    def create_chat(self, project_id: str, title: str = "New chat") -> ChatThread | None:
        if not self.get_project(project_id):
            return None
        now = utc_now()
        thread = ChatThread(
            id=f"chat_{uuid4().hex}",
            projectId=project_id,
            title=title.strip() or "New chat",
            createdAt=now,
            updatedAt=now,
        )
        self.connection.execute(
            "INSERT INTO chat_threads (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (thread.id, project_id, thread.title, now, now),
        )
        self.connection.commit()
        return thread

    def get_chat(self, project_id: str, chat_id: str) -> ChatThread | None:
        row = self.connection.execute(
            "SELECT * FROM chat_threads WHERE project_id = ? AND id = ?",
            (project_id, chat_id),
        ).fetchone()
        return self._chat_thread(row) if row else None

    def delete_chat(self, project_id: str, chat_id: str) -> bool:
        cursor = self.connection.execute(
            "DELETE FROM chat_threads WHERE project_id = ? AND id = ?",
            (project_id, chat_id),
        )
        self.connection.commit()
        return cursor.rowcount > 0

    def list_messages(self, thread_id: str) -> list[ChatMessage]:
        rows = self.connection.execute(
            "SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC",
            (thread_id,),
        ).fetchall()
        return [self._chat_message(row) for row in rows]

    def append_message(
        self,
        thread_id: str,
        role: str,
        content: str,
        analysis: AnalysisResponse | None = None,
    ) -> ChatMessage:
        now = utc_now()
        message = ChatMessage(
            id=f"msg_{uuid4().hex}",
            threadId=thread_id,
            role=role,  # type: ignore[arg-type]
            content=content,
            analysis=analysis,
            createdAt=now,
        )
        self.connection.execute(
            """
            INSERT INTO chat_messages (id, thread_id, role, content, analysis_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                message.id,
                thread_id,
                role,
                content,
                analysis.model_dump_json() if analysis else None,
                now,
            ),
        )
        self.connection.execute("UPDATE chat_threads SET updated_at = ? WHERE id = ?", (now, thread_id))
        self.connection.commit()
        return message

    def rename_chat(self, thread_id: str, title: str) -> None:
        now = utc_now()
        self.connection.execute(
            "UPDATE chat_threads SET title = ?, updated_at = ? WHERE id = ?",
            (title[:80], now, thread_id),
        )
        self.connection.commit()

    def list_change_versions(self, project_id: str, node_id: str | None = None) -> list[ContractChangeVersion]:
        if node_id:
            rows = self.connection.execute(
                """
                SELECT * FROM contract_change_versions
                WHERE project_id = ? AND node_id = ?
                ORDER BY version_number DESC, created_at DESC
                """,
                (project_id, node_id),
            ).fetchall()
        else:
            rows = self.connection.execute(
                """
                SELECT * FROM contract_change_versions
                WHERE project_id = ?
                ORDER BY created_at DESC
                LIMIT 80
                """,
                (project_id,),
            ).fetchall()
        return [self._change_version(row) for row in rows]

    def _build_change_versions(
        self,
        project_id: str,
        project: Project,
        existing_nodes: dict[str, dict[str, Any]],
        incoming_nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
        actor: str,
        now: str,
        commit_message: str | None = None,
    ) -> list[dict[str, Any]]:
        incoming_by_id = {node["id"]: node for node in incoming_nodes}
        semantic_node_ids = {
            node_id
            for node_id, node in {**existing_nodes, **incoming_by_id}.items()
            if _is_versioned_node(node)
        }
        versions: list[dict[str, Any]] = []
        snapshot = CanvasSnapshot(project=project, nodes=incoming_nodes, edges=edges)
        for node_id in sorted(semantic_node_ids):
            before = existing_nodes.get(node_id)
            after = incoming_by_id.get(node_id)
            changed_fields = _changed_fields(before, after)
            if not changed_fields:
                continue
            change_type = "created" if before is None else "deleted" if after is None else "updated"
            source = after or before
            if not source:
                continue
            version_id = f"version_{uuid4().hex}"
            candidate_nodes = _candidate_affected_nodes(node_id, incoming_nodes, edges)
            summary, affected_nodes = analyze_change_impact(
                snapshot,
                before,
                after,
                changed_fields,
                candidate_nodes,
                version_id,
                now,
            )
            if commit_message:
                summary = commit_message
            versions.append(
                {
                    "id": version_id,
                    "projectId": project_id,
                    "nodeId": node_id,
                    "nodeTitle": str(source.get("data", {}).get("title") or node_id),
                    "nodeType": str(source.get("data", {}).get("canvasType") or "requirement"),
                    "versionNumber": self._next_version_number(project_id, node_id) + _pending_version_offset(versions, node_id),
                    "changeType": change_type,
                    "summary": summary,
                    "changedFields": changed_fields,
                    "affectedNodes": [impact.model_dump() for impact in affected_nodes],
                    "before": before,
                    "after": after,
                    "createdBy": actor,
                    "createdAt": now,
                }
            )
        return versions

    def _next_version_number(self, project_id: str, node_id: str) -> int:
        row = self.connection.execute(
            "SELECT COALESCE(MAX(version_number), 0) AS version_number FROM contract_change_versions WHERE project_id = ? AND node_id = ?",
            (project_id, node_id),
        ).fetchone()
        return int(row["version_number"]) + 1 if row else 1

    def _insert_change_version(self, version: dict[str, Any]) -> None:
        self.connection.execute(
            """
            INSERT INTO contract_change_versions (
                id, project_id, node_id, node_title, node_type, version_number,
                change_type, summary, changed_fields_json, affected_nodes_json,
                before_json, after_json, created_by, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                version["id"],
                version["projectId"],
                version["nodeId"],
                version["nodeTitle"],
                version["nodeType"],
                version["versionNumber"],
                version["changeType"],
                version["summary"],
                _json(version["changedFields"]),
                _json(version["affectedNodes"]),
                _json(version["before"]) if version["before"] is not None else None,
                _json(version["after"]) if version["after"] is not None else None,
                version["createdBy"],
                version["createdAt"],
            ),
        )

    def _insert_node(self, project_id: str, node: dict[str, Any], now: str) -> None:
        node = _normalize_canvas_node(node)
        self.connection.execute(
            """
            INSERT INTO canvas_nodes (id, project_id, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (node["id"], project_id, _json(node), now, now),
        )

    def _insert_edge(self, project_id: str, edge: dict[str, Any], now: str) -> None:
        self.connection.execute(
            """
            INSERT INTO canvas_edges (id, project_id, source_node_id, target_node_id, payload_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (edge["id"], project_id, edge.get("source"), edge.get("target"), _json(edge), now, now),
        )

    def _touch_project(self, project_id: str, now: str) -> None:
        self.connection.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))

    def _get_node(self, project_id: str, node_id: str) -> dict[str, Any] | None:
        row = self.connection.execute(
            "SELECT payload_json FROM canvas_nodes WHERE project_id = ? AND id = ?",
            (project_id, node_id),
        ).fetchone()
        return json.loads(row["payload_json"]) if row else None

    def _get_edge(self, project_id: str, edge_id: str) -> dict[str, Any] | None:
        row = self.connection.execute(
            "SELECT payload_json FROM canvas_edges WHERE project_id = ? AND id = ?",
            (project_id, edge_id),
        ).fetchone()
        return json.loads(row["payload_json"]) if row else None

    def _project(self, row: sqlite3.Row) -> Project:
        return Project(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
            viewport=json.loads(row["viewport_json"]) if row["viewport_json"] else None,
        )

    def _chat_thread(self, row: sqlite3.Row) -> ChatThread:
        return ChatThread(
            id=row["id"],
            projectId=row["project_id"],
            title=row["title"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )

    def _chat_message(self, row: sqlite3.Row) -> ChatMessage:
        return ChatMessage(
            id=row["id"],
            threadId=row["thread_id"],
            role=row["role"],
            content=row["content"],
            analysis=AnalysisResponse.model_validate_json(row["analysis_json"]) if row["analysis_json"] else None,
            createdAt=row["created_at"],
        )

    def _change_version(self, row: sqlite3.Row) -> ContractChangeVersion:
        before = _loads(row["before_json"], None)
        after = _loads(row["after_json"], None)
        return ContractChangeVersion(
            id=row["id"],
            projectId=row["project_id"],
            nodeId=row["node_id"],
            nodeTitle=row["node_title"],
            nodeType=row["node_type"],
            versionNumber=row["version_number"],
            changeType=row["change_type"],
            summary=row["summary"],
            changedFields=_loads(row["changed_fields_json"], []),
            affectedNodes=_loads(row["affected_nodes_json"], []),
            titleBefore=_node_title(before),
            titleAfter=_node_title(after),
            contentBefore=_node_content(before) if before else None,
            contentAfter=_node_content(after) if after else None,
            createdBy=row["created_by"],
            createdAt=row["created_at"],
        )


def _json(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _canonical_json(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False, sort_keys=True)


def _same_saved_canvas(existing: CanvasSnapshot, incoming: CanvasSnapshot) -> bool:
    existing_project = existing.project.model_dump(exclude={"updatedAt"})
    incoming_project = incoming.project.model_dump(exclude={"updatedAt"})
    return (
        existing_project == incoming_project
        and _canonical_json(existing.nodes) == _canonical_json(incoming.nodes)
        and _canonical_json(existing.edges) == _canonical_json(incoming.edges)
    )


def _pending_version_offset(versions: list[dict[str, Any]], node_id: str) -> int:
    return sum(1 for version in versions if version["nodeId"] == node_id)


def _is_versioned_node(node: dict[str, Any] | None) -> bool:
    if not node:
        return False
    data = node.get("data")
    if not isinstance(data, dict):
        return False
    return data.get("canvasType") in {"project_contract", "requirement"}


def _changed_fields(before: dict[str, Any] | None, after: dict[str, Any] | None) -> list[str]:
    if not _is_versioned_node(before) and not _is_versioned_node(after):
        return []
    if before is None:
        return ["created"]
    if after is None:
        return ["deleted"]
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


def _semantic_changed(before: dict[str, Any] | None, after: dict[str, Any] | None) -> bool:
    return bool(_changed_fields(before, after))


def _with_audit_metadata(
    node: dict[str, Any],
    existing: dict[str, Any] | None,
    actor: str,
    now: str,
    semantic_changed: bool,
) -> dict[str, Any]:
    data = node.get("data")
    if not isinstance(data, dict):
        return node
    existing_data = existing.get("data") if existing and isinstance(existing.get("data"), dict) else {}
    previous_audit = existing_data.get("audit") if isinstance(existing_data.get("audit"), dict) else {}
    incoming_audit = data.get("audit") if isinstance(data.get("audit"), dict) else {}
    audit = {
        "createdAt": previous_audit.get("createdAt") or incoming_audit.get("createdAt") or now,
        "createdBy": previous_audit.get("createdBy") or incoming_audit.get("createdBy") or actor,
        "updatedAt": now if semantic_changed else previous_audit.get("updatedAt") or incoming_audit.get("updatedAt") or data.get("updatedAt") or now,
        "updatedBy": actor if semantic_changed else previous_audit.get("updatedBy") or incoming_audit.get("updatedBy") or actor,
    }
    # An edit to the node's own content/title resolves any impact flag on it, even for
    # non-versioned node types (notes, links) where _changed_fields short-circuits.
    content_edited = _node_content(existing) != _node_content(node) or _node_title(existing) != _node_title(node)
    clear_impact = semantic_changed or (existing is not None and content_edited)
    preserved_impact = None if clear_impact else data.get("impact") or existing_data.get("impact")
    next_data = {key: value for key, value in data.items() if not (clear_impact and key == "impact")}
    next_data["audit"] = audit
    if preserved_impact:
        next_data["impact"] = preserved_impact
    return {**node, "data": next_data}


def _candidate_affected_nodes(node_id: str, nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    related_ids: set[str] = set()
    for edge in edges:
        source = str(edge.get("source") or "")
        target = str(edge.get("target") or "")
        if source == node_id and target:
            related_ids.add(target)
        elif target == node_id and source:
            related_ids.add(source)
    node_by_id = {str(node.get("id")): node for node in nodes}
    source = node_by_id.get(node_id)
    source_data = source.get("data") if source and isinstance(source.get("data"), dict) else {}
    if source_data.get("canvasType") == "project_contract":
        for node in nodes:
            data = node.get("data") if isinstance(node.get("data"), dict) else {}
            if data.get("canvasType") == "requirement":
                related_ids.add(str(node.get("id")))
    related_ids.discard(node_id)
    return [node_by_id[node_id] for node_id in sorted(related_ids) if node_id in node_by_id]


def _apply_change_impacts(nodes: list[dict[str, Any]], versions: list[dict[str, Any]]) -> None:
    impact_by_node: dict[str, dict[str, Any]] = {}
    rank = {"review": 0, "needs_update": 1, "outdated": 2, "conflict": 3}
    for version in versions:
        for impact in version["affectedNodes"]:
            node_id = str(impact.get("nodeId") or "")
            if not node_id:
                continue
            current = impact_by_node.get(node_id)
            if not current or rank.get(str(impact.get("status")), 0) >= rank.get(str(current.get("status")), 0):
                impact_by_node[node_id] = impact
    for node in nodes:
        node_id = str(node.get("id") or "")
        impact = impact_by_node.get(node_id)
        if not impact:
            continue
        data = node.get("data")
        if isinstance(data, dict):
            node["data"] = {**data, "impact": impact}


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


def _node_title(node: dict[str, Any] | None) -> str | None:
    if not node:
        return None
    data = node.get("data")
    if not isinstance(data, dict):
        return None
    return str(data.get("title") or "")


def _content_from_legacy_fields(fields: dict[str, Any]) -> str:
    content = str(fields.get("content") or "").strip()
    # Only fold human-readable prose fields into the visible content. Machine
    # metadata (priority, status, sourceType, sourceId, sourceNodeIds, fetchedAt,
    # metadata, …) is intentionally dropped so it never renders as raw
    # "Label\nvalue" noise inside a node body.
    prose_keys = [
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
    ]
    legacy_parts: list[str] = [content] if content else []
    for key in prose_keys:
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


def _loads(value: str, fallback: Any) -> Any:
    try:
        return json.loads(value)
    except Exception:
        return fallback


def _deep_merge(base: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged

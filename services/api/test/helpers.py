from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from context_canvas_api.app import create_app


class ApiE2ECase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        self.db_path = self.root / "context-canvas.sqlite"
        self.upload_dir = self.root / "uploads"
        self.client = TestClient(
            create_app(
                self.db_path,
                seed=True,
                upload_dir=self.upload_dir,
                max_upload_bytes=1024 * 1024,
            )
        )
        self.client.__enter__()

    def tearDown(self) -> None:
        self.client.__exit__(None, None, None)
        self.tmpdir.cleanup()

    def create_project(self, name: str = "E2E canvas") -> str:
        response = self.client.post("/api/projects", json={"name": name})
        self.assertEqual(response.status_code, 200)
        return response.json()["project"]["id"]

    def create_node(self, project_id: str, node_id: str, title: str, canvas_type: str = "requirement") -> dict[str, object]:
        node = make_node(node_id, title, canvas_type)
        response = self.client.post(f"/api/projects/{project_id}/nodes", json=node)
        self.assertEqual(response.status_code, 200)
        return response.json()

    def sqlite_scalar(self, sql: str, params: tuple[object, ...] = ()) -> object:
        connection = sqlite3.connect(self.db_path)
        try:
            row = connection.execute(sql, params).fetchone()
            return row[0] if row else None
        finally:
            connection.close()

    def assertOpenAIModel(self, model: object) -> None:
        self.assertIsInstance(model, str)
        normalized = str(model).lower()
        self.assertTrue(normalized.strip())
        self.assertNotIn("local", normalized)


def make_node(node_id: str, title: str, canvas_type: str = "requirement") -> dict[str, object]:
    return {
        "id": node_id,
        "type": "contextNode",
        "position": {"x": 0, "y": 0},
        "data": {
            "canvasType": canvas_type,
            "title": title,
            "fields": {"content": title},
            "tags": [],
            "updatedAt": "2026-05-14T00:00:00.000Z",
        },
    }


def make_edge(edge_id: str, source: str, target: str, relationship: str = "references") -> dict[str, object]:
    return {
        "id": edge_id,
        "source": source,
        "target": target,
        "label": relationship,
        "data": {"relationship": relationship, "updatedAt": "2026-05-14T00:00:00.000Z"},
    }


def create_legacy_database(db_path: Path) -> None:
    connection = sqlite3.connect(db_path)
    now = "2026-05-14T00:00:00.000Z"
    connection.executescript(
        """
        CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            viewport_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE canvas_nodes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            position_json TEXT NOT NULL,
            data_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE canvas_edges (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            source_node_id TEXT NOT NULL,
            target_node_id TEXT NOT NULL,
            relationship TEXT NOT NULL,
            label TEXT,
            edge_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE uploads (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            content_type TEXT NOT NULL,
            url TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE analysis_runs (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            request_json TEXT NOT NULL,
            response_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )
    connection.execute(
        "INSERT INTO projects (id, name, description, viewport_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("project_legacy", "Legacy Project", None, json.dumps({"x": 0, "y": 0, "zoom": 1}), now, now),
    )
    connection.execute(
        """
        INSERT INTO canvas_nodes (id, project_id, type, title, position_json, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "node_legacy",
            "project_legacy",
            "requirement",
            "Legacy Requirement",
            json.dumps({"x": 10, "y": 20}),
            json.dumps(
                {
                    "canvasType": "requirement",
                    "title": "Legacy Requirement",
                    "fields": {"body": "Migrated body"},
                    "tags": [],
                    "updatedAt": now,
                }
            ),
            now,
            now,
        ),
    )
    connection.execute(
        """
        INSERT INTO canvas_edges (id, project_id, source_node_id, target_node_id, relationship, label, edge_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "edge_legacy",
            "project_legacy",
            "node_legacy",
            "node_legacy",
            "references",
            "references",
            json.dumps(make_edge("edge_legacy", "node_legacy", "node_legacy")),
            now,
            now,
        ),
    )
    connection.execute(
        """
        INSERT INTO analysis_runs (id, project_id, request_json, response_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("analysis_legacy", "project_legacy", json.dumps({"question": "Legacy?"}), json.dumps({"status": "ok"}), now),
    )
    connection.commit()
    connection.close()

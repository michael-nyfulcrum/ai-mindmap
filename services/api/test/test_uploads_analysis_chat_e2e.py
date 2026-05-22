from __future__ import annotations

import base64
from fastapi.testclient import TestClient

from context_canvas_api.app import create_app

from test.helpers import ApiE2ECase, create_legacy_database, make_edge, make_node


class UploadAnalysisChatE2ETest(ApiE2ECase):
    def test_uploads_validate_store_and_serve_files(self) -> None:
        project_id = self.create_project()
        data_url = "data:text/plain;base64," + base64.b64encode(b"hello canvas").decode()

        upload = self.client.post(
            "/api/uploads",
            json={
                "projectId": project_id,
                "filename": "../note.txt",
                "contentType": "text/plain",
                "dataUrl": data_url,
            },
        )
        self.assertEqual(upload.status_code, 200)
        self.assertEqual(upload.json()["filename"], "../note.txt")

        served = self.client.get(upload.json()["url"])
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served.content, b"hello canvas")

        stored_path = self.sqlite_scalar("SELECT file_path FROM uploads WHERE id = ?", (upload.json()["id"],))
        self.assertIsInstance(stored_path, str)
        self.assertTrue(str(stored_path).endswith(".._note.txt"))

        invalid_data_url = self.client.post(
            "/api/uploads",
            json={"projectId": project_id, "filename": "bad.txt", "contentType": "text/plain", "dataUrl": "not-base64"},
        )
        self.assertEqual(invalid_data_url.status_code, 400)

        missing_project = self.client.post(
            "/api/uploads",
            json={"projectId": "project_missing", "filename": "x.txt", "contentType": "text/plain", "dataUrl": data_url},
        )
        self.assertEqual(missing_project.status_code, 404)
        self.assertEqual(self.client.get("/api/uploads/upload_missing").status_code, 404)

    def test_analysis_reads_saved_db_canvas_and_survives_restart(self) -> None:
        project_id = self.create_project()
        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        snapshot["nodes"] = [
            make_node("node_contract", "Client CR Contract", "project_contract"),
            make_node("node_requirement_one", "Requirements canvas is saved"),
            make_node("node_requirement_two", "AI uses saved DB context"),
            source_snapshot("node_source_client", "Client change request"),
        ]
        snapshot["edges"] = [
            make_edge("edge_contract_req_one", "node_contract", "node_requirement_one", "defines"),
            make_edge("edge_source_req_two", "node_source_client", "node_requirement_two", "supports"),
        ]
        saved = self.client.put(f"/api/projects/{project_id}/canvas", json=snapshot)
        self.assertEqual(saved.status_code, 200)

        before = self.client.get(f"/api/projects/{project_id}/canvas").json()
        analysis = self.client.post(f"/api/projects/{project_id}/analyze", json={"question": " What is saved? "})
        self.assertEqual(analysis.status_code, 200)
        body = analysis.json()
        self.assertIn(body["status"], {"ok", "needs_context"})
        self.assertOpenAIModel(body["model"])
        self.assertIsInstance(body["summary"], str)
        self.assertGreater(len(body["summary"].strip()), 20)
        self.assertTrue(set(_citation_ids(body)).issubset({"node_contract", "node_requirement_one", "node_requirement_two", "node_source_client"}))
        self.assertEqual(self.sqlite_scalar("SELECT question FROM analysis_runs WHERE project_id = ?", (project_id,)), "What is saved?")
        after = self.client.get(f"/api/projects/{project_id}/canvas").json()
        self.assertEqual(before["nodes"], after["nodes"])
        self.assertEqual(before["edges"], after["edges"])

        with TestClient(
            create_app(
                self.db_path,
                seed=False,
                upload_dir=self.upload_dir,
                max_upload_bytes=1024 * 1024,
            )
        ) as restarted:
            restarted_analysis = restarted.post(f"/api/projects/{project_id}/analyze", json={"question": "Still there?"})
            self.assertEqual(restarted_analysis.status_code, 200)
            self.assertOpenAIModel(restarted_analysis.json()["model"])

        blank = self.client.post(f"/api/projects/{project_id}/analyze", json={"question": "   "})
        self.assertEqual(blank.status_code, 422)

    def test_chat_uses_current_saved_canvas_context_and_persists_messages(self) -> None:
        project_id = self.create_project()
        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        snapshot["nodes"] = [
            make_node("node_contract", "Current Contract", "project_contract"),
            make_node("node_requirement_one", "First saved requirement"),
        ]
        snapshot["edges"] = [make_edge("edge_contract_req_one", "node_contract", "node_requirement_one", "defines")]
        self.assertEqual(self.client.put(f"/api/projects/{project_id}/canvas", json=snapshot).status_code, 200)
        self.assertEqual(self.client.get(f"/api/projects/{project_id}/chats").json()["chats"], [])

        created = self.client.post(f"/api/projects/{project_id}/chats", json={"title": "   "})
        self.assertEqual(created.status_code, 200)
        chat_id = created.json()["thread"]["id"]
        self.assertEqual(created.json()["thread"]["title"], "New chat")

        blank = self.client.post(f"/api/projects/{project_id}/chats/{chat_id}/messages", json={"content": "   "})
        self.assertEqual(blank.status_code, 422)

        first_message = self.client.post(
            f"/api/projects/{project_id}/chats/{chat_id}/messages",
            json={"content": " Summarize this canvas "},
        )
        self.assertEqual(first_message.status_code, 200)
        self.assertOpenAIModel(first_message.json()["analysis"]["model"])
        self.assertEqual([item["role"] for item in first_message.json()["messages"]], ["user", "assistant"])
        self.assertEqual(first_message.json()["thread"]["title"], "Summarize this canvas")
        self.assertIsNotNone(first_message.json()["messages"][1]["analysis"])
        self.assertGreater(len(first_message.json()["messages"][1]["content"].strip()), 20)
        self.assertNotEqual(first_message.json()["messages"][1]["content"], first_message.json()["analysis"]["summary"])

        snapshot["nodes"].append(make_node("node_requirement_two", "Second saved requirement"))
        snapshot["edges"].append(make_edge("edge_contract_req_two", "node_contract", "node_requirement_two", "defines"))
        self.assertEqual(self.client.put(f"/api/projects/{project_id}/canvas", json=snapshot).status_code, 200)

        second_message = self.client.post(
            f"/api/projects/{project_id}/chats/{chat_id}/messages",
            json={"content": "What changed?"},
        )
        self.assertEqual(second_message.status_code, 200)
        self.assertOpenAIModel(second_message.json()["analysis"]["model"])
        self.assertGreater(len(second_message.json()["messages"][3]["content"].strip()), 20)
        self.assertNotEqual(second_message.json()["messages"][3]["content"], second_message.json()["analysis"]["summary"])
        self.assertEqual([item["role"] for item in second_message.json()["messages"]], ["user", "assistant", "user", "assistant"])

        reloaded = self.client.get(f"/api/projects/{project_id}/chats/{chat_id}")
        self.assertEqual(reloaded.status_code, 200)
        self.assertEqual(len(reloaded.json()["messages"]), 4)

        self.assertEqual(self.client.delete(f"/api/projects/{project_id}/chats/{chat_id}").status_code, 204)
        self.assertEqual(self.client.get(f"/api/projects/{project_id}/chats/{chat_id}").status_code, 404)
        self.assertEqual(self.sqlite_scalar("SELECT COUNT(*) FROM chat_messages WHERE thread_id = ?", (chat_id,)), 0)

    def test_legacy_sqlite_schema_is_migrated_on_startup(self) -> None:
        legacy_path = self.root / "legacy.sqlite"
        create_legacy_database(legacy_path)

        with TestClient(
            create_app(
                legacy_path,
                seed=False,
                upload_dir=self.upload_dir,
                max_upload_bytes=1024 * 1024,
            )
        ) as client:
            canvas = client.get("/api/projects/project_legacy/canvas")
            self.assertEqual(canvas.status_code, 200)
            self.assertEqual(canvas.json()["nodes"][0]["data"]["title"], "Legacy Requirement")

            analysis = client.post("/api/projects/project_legacy/analyze", json={"question": "What is migrated?"})
            self.assertEqual(analysis.status_code, 200)

            created = client.post("/api/projects", json={"name": "Post migration project"})
            self.assertEqual(created.status_code, 200)

        connection = self._legacy_connection(legacy_path)
        try:
            analysis_columns = {row[1] for row in connection.execute("PRAGMA table_info(analysis_runs)").fetchall()}
            node_columns = {row[1] for row in connection.execute("PRAGMA table_info(canvas_nodes)").fetchall()}
            self.assertIn("question", analysis_columns)
            self.assertIn("payload_json", node_columns)
            migrated_question = connection.execute("SELECT question FROM analysis_runs WHERE id = ?", ("analysis_legacy",)).fetchone()[0]
            self.assertEqual(migrated_question, "Legacy?")
        finally:
            connection.close()

    @staticmethod
    def _legacy_connection(path):
        import sqlite3

        return sqlite3.connect(path)


def source_snapshot(node_id: str, title: str) -> dict[str, object]:
    node = make_node(node_id, title, "source_snapshot")
    node["data"]["fields"] = {
        "content": title,
    }
    node["data"]["tags"] = ["source"]
    return node


def _citation_ids(analysis: dict[str, object]) -> list[str]:
    citations = analysis.get("citations")
    if not isinstance(citations, list):
        return []
    ids: list[str] = []
    for citation in citations:
        if isinstance(citation, dict) and isinstance(citation.get("nodeId"), str):
            ids.append(citation["nodeId"])
    return ids

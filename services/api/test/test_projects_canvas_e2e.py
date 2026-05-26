from __future__ import annotations

from fastapi.testclient import TestClient

from context_canvas_api.app import create_app

from test.helpers import ApiE2ECase, make_edge, make_node


class ProjectAndCanvasE2ETest(ApiE2ECase):
    def test_seeded_demo_canvas_loads_contract_sources_and_requirements(self) -> None:
        canvas = self.client.get("/api/projects/project_demo_context_canvas/canvas")
        self.assertEqual(canvas.status_code, 200)
        body = canvas.json()
        self.assertEqual(body["project"]["name"], "GGR-5534 Help Center Change Request")
        node_types = {node["data"]["canvasType"] for node in body["nodes"]}
        self.assertIn("project_contract", node_types)
        self.assertIn("requirement", node_types)
        self.assertIn("source_snapshot", node_types)
        self.assertGreaterEqual(len(body["edges"]), 4)

    def test_project_crud_and_delete_cascade(self) -> None:
        created = self.client.post("/api/projects", json={"name": " Client CR ", "description": "Initial"})
        self.assertEqual(created.status_code, 200)
        project_id = created.json()["project"]["id"]

        fetched = self.client.get(f"/api/projects/{project_id}")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()["name"], "Client CR")

        patched = self.client.patch(
            f"/api/projects/{project_id}",
            json={"name": "Updated CR", "description": "Ready", "viewport": {"x": 1, "y": 2, "zoom": 0.75}},
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.json()["description"], "Ready")
        self.assertEqual(patched.json()["viewport"]["zoom"], 0.75)

        self.create_node(project_id, "node_delete_cascade", "Delete cascade")
        self.assertEqual(self.client.delete(f"/api/projects/{project_id}").status_code, 204)
        self.assertEqual(self.client.get(f"/api/projects/{project_id}").status_code, 404)
        self.assertEqual(self.sqlite_scalar("SELECT COUNT(*) FROM canvas_nodes WHERE project_id = ?", (project_id,)), 0)

    def test_canvas_save_reload_restart_and_id_mismatch(self) -> None:
        project_id = self.create_project()
        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        snapshot["project"]["viewport"] = {"x": 44, "y": -9, "zoom": 1.2}
        snapshot["nodes"] = [
            make_node("node_contract", "Contract", "project_contract"),
            make_node("node_requirement", "Requirement"),
        ]
        snapshot["nodes"][1]["data"]["highlighted"] = True
        snapshot["edges"] = [make_edge("edge_contract_requirement", "node_contract", "node_requirement", "requirement source")]

        saved = self.client.put(f"/api/projects/{project_id}/canvas", json=snapshot)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(len(saved.json()["nodes"]), 2)
        self.assertEqual(saved.json()["project"]["viewport"]["zoom"], 1.2)

        identical_save = self.client.put(f"/api/projects/{project_id}/canvas", json=saved.json())
        self.assertEqual(identical_save.status_code, 200)
        self.assertEqual(identical_save.json()["project"]["updatedAt"], saved.json()["project"]["updatedAt"])

        reloaded = self.client.get(f"/api/projects/{project_id}/canvas")
        self.assertEqual(reloaded.status_code, 200)
        self.assertEqual(reloaded.json()["edges"][0]["label"], "requirement source")
        self.assertNotIn("highlighted", reloaded.json()["nodes"][1]["data"])

        mismatched = dict(snapshot)
        mismatched["project"] = {**snapshot["project"], "id": "project_wrong"}
        self.assertEqual(self.client.put(f"/api/projects/{project_id}/canvas", json=mismatched).status_code, 400)

        with TestClient(
            create_app(
                self.db_path,
                seed=False,
                upload_dir=self.upload_dir,
                max_upload_bytes=1024 * 1024,
            )
        ) as restarted:
            after_restart = restarted.get(f"/api/projects/{project_id}/canvas")
            self.assertEqual(after_restart.status_code, 200)
            self.assertEqual(after_restart.json()["nodes"][1]["data"]["title"], "Requirement")

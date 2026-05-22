from __future__ import annotations

from test.helpers import ApiE2ECase, make_edge


class NodeAndEdgeE2ETest(ApiE2ECase):
    def test_node_and_edge_crud_with_validation(self) -> None:
        project_id = self.create_project()
        self.create_node(project_id, "node_a", "Contract", "project_contract")
        self.create_node(project_id, "node_b", "Requirement")

        created_edge = self.client.post(
            f"/api/projects/{project_id}/edges",
            json=make_edge("edge_a_b", "node_a", "node_b", "requirement source"),
        )
        self.assertEqual(created_edge.status_code, 200)

        invalid_edge = self.client.post(
            f"/api/projects/{project_id}/edges",
            json=make_edge("edge_invalid", "node_a", "node_missing"),
        )
        self.assertEqual(invalid_edge.status_code, 400)

        patched_node = self.client.patch(
            f"/api/projects/{project_id}/nodes/node_b",
            json={"data": {"title": "Updated requirement", "fields": {"content": "Updated requirement detail"}}},
        )
        self.assertEqual(patched_node.status_code, 200)
        self.assertEqual(patched_node.json()["data"]["title"], "Updated requirement")
        self.assertEqual(patched_node.json()["data"]["fields"], {"content": "Updated requirement detail"})

        patched_edge = self.client.patch(
            f"/api/projects/{project_id}/edges/edge_a_b",
            json={"label": "implements", "data": {"relationship": "implements"}},
        )
        self.assertEqual(patched_edge.status_code, 200)
        self.assertEqual(patched_edge.json()["label"], "implements")

        self.assertEqual(self.client.delete(f"/api/projects/{project_id}/edges/edge_a_b").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/projects/{project_id}/edges/edge_a_b").status_code, 404)

        self.client.post(f"/api/projects/{project_id}/edges", json=make_edge("edge_a_b_2", "node_a", "node_b"))
        self.assertEqual(self.client.delete(f"/api/projects/{project_id}/nodes/node_a").status_code, 204)
        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        self.assertEqual(snapshot["edges"], [])

    def test_missing_project_and_missing_items_return_404(self) -> None:
        node = self.client.post("/api/projects/project_missing/nodes", json={})
        self.assertEqual(node.status_code, 404)
        self.assertEqual(self.client.patch("/api/projects/project_missing/nodes/node_missing", json={}).status_code, 404)
        self.assertEqual(self.client.delete("/api/projects/project_missing/nodes/node_missing").status_code, 404)
        self.assertEqual(self.client.patch("/api/projects/project_missing/edges/edge_missing", json={}).status_code, 404)
        self.assertEqual(self.client.delete("/api/projects/project_missing/edges/edge_missing").status_code, 404)

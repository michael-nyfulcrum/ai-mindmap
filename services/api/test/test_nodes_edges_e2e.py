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

        non_object_node = self.client.post(f"/api/projects/{project_id}/nodes", json=[])
        self.assertEqual(non_object_node.status_code, 400)
        self.assertEqual(non_object_node.json()["detail"], "JSON body must be an object")

        malformed_node = self.client.post(
            f"/api/projects/{project_id}/nodes",
            content="{",
            headers={"content-type": "application/json"},
        )
        self.assertEqual(malformed_node.status_code, 400)
        self.assertEqual(malformed_node.json()["detail"], "Invalid JSON body")

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

    def test_contract_requirement_changes_create_versions_and_impact_flags(self) -> None:
        project_id = self.create_project()
        self.create_node(project_id, "node_contract", "Contract", "project_contract")
        self.create_node(project_id, "node_requirement", "Requirement")
        self.client.post(
            f"/api/projects/{project_id}/edges",
            json=make_edge("edge_contract_requirement", "node_contract", "node_requirement", "defines"),
        )

        patched = self.client.patch(
            f"/api/projects/{project_id}/nodes/node_contract",
            json={"data": {"fields": {"content": "Contract now requires offline mode."}}},
            headers={"x-context-canvas-actor": "PM"},
        )
        self.assertEqual(patched.status_code, 200)
        self.assertEqual(patched.json()["data"]["audit"]["updatedBy"], "PM")

        versions = self.client.get(f"/api/projects/{project_id}/nodes/node_contract/versions")
        self.assertEqual(versions.status_code, 200)
        self.assertGreaterEqual(len(versions.json()["versions"]), 2)
        latest = versions.json()["versions"][0]
        self.assertEqual(latest["changeType"], "updated")
        self.assertIn("content", latest["changedFields"])
        self.assertEqual(latest["createdBy"], "PM")
        self.assertEqual(latest["affectedNodes"][0]["nodeId"], "node_requirement")
        project_versions = self.client.get(f"/api/projects/{project_id}/versions")
        self.assertEqual(project_versions.status_code, 200)
        self.assertGreaterEqual(len(project_versions.json()["versions"]), len(versions.json()["versions"]))

        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        requirement = next(node for node in snapshot["nodes"] if node["id"] == "node_requirement")
        self.assertEqual(requirement["data"]["impact"]["status"], "needs_update")
        self.assertEqual(requirement["data"]["impact"]["sourceNodeId"], "node_contract")

        addressed = self.client.patch(
            f"/api/projects/{project_id}/nodes/node_requirement",
            json={"data": {"fields": {"content": "Requirement now supports offline mode."}}},
        )
        self.assertEqual(addressed.status_code, 200)
        self.assertNotIn("impact", addressed.json()["data"])

        deleted = self.client.delete(f"/api/projects/{project_id}/nodes/node_requirement", headers={"x-context-canvas-actor": "PM"})
        self.assertEqual(deleted.status_code, 204)
        deleted_versions = self.client.get(f"/api/projects/{project_id}/nodes/node_requirement/versions").json()["versions"]
        self.assertEqual(deleted_versions[0]["changeType"], "deleted")
        self.assertEqual(deleted_versions[0]["createdBy"], "PM")

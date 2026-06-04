from __future__ import annotations

import asyncio
import unittest

from fastmcp import Client

from context_canvas_mcp.app import create_app as create_mcp_app

from test.helpers import ApiE2ECase, make_edge, make_node


def _requirement(node_id: str, title: str, content: str) -> dict[str, object]:
    node = make_node(node_id, title, "requirement")
    node["data"]["fields"]["content"] = content  # type: ignore[index]
    return node


class SpecKitFeatureSpecE2ETest(ApiE2ECase):
    def _seed_project(self) -> str:
        project_id = self.create_project("Customer Portal")
        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        contract = make_node("node_contract", "Portal Contract", "project_contract")
        contract["data"]["fields"]["content"] = "Build a self-service customer portal. Out of scope: billing."  # type: ignore[index]
        link = make_node("node_link", "Figma mockups", "link")
        link["data"]["fields"]["content"] = "https://figma.com/file/portal"  # type: ignore[index]
        snapshot["nodes"] = [
            contract,
            _requirement(
                "node_login",
                "Email sign-in",
                "Users can sign in with email and password.\n- Valid credentials grant access\n- Invalid credentials show an error",
            ),
            _requirement("node_profile", "Edit profile", "Users can edit their profile."),
            link,
        ]
        snapshot["edges"] = [
            make_edge("edge_login_link", "node_login", "node_link", "design reference"),
            # "depends on" is directional: node_profile depends on node_login.
            make_edge("edge_dep", "node_profile", "node_login", "depends on"),
        ]
        self.assertEqual(self.client.put(f"/api/projects/{project_id}/canvas", json=snapshot).status_code, 200)
        return project_id

    def test_spec_focused_on_requirement(self) -> None:
        project_id = self._seed_project()
        result = self.client.post(f"/api/projects/{project_id}/spec", json={"focusNodeId": "node_login"})
        self.assertEqual(result.status_code, 200)
        spec = result.json()

        self.assertEqual(spec["requirementCount"], 1)
        self.assertEqual(spec["title"], "Email sign-in Spec")
        content = spec["content"]
        self.assertIn("FR-001", content)
        self.assertIn("Users can sign in with email and password.", content)
        self.assertIn("Valid credentials grant access", content)
        self.assertIn("node_login", content)  # traceability
        # A focused spec must not pull in unrelated requirements.
        self.assertNotIn("Edit profile", content)
        # The connected Figma link is a referenced entity.
        self.assertIn("Figma mockups", content)
        # A requirement with real criteria must not be littered with placeholders.
        self.assertNotIn("[NEEDS CLARIFICATION", content)

    def test_spec_includes_dependencies(self) -> None:
        project_id = self._seed_project()
        spec = self.client.post(f"/api/projects/{project_id}/spec", json={"focusNodeId": "node_profile"}).json()
        content = spec["content"]
        self.assertIn("## Dependencies", content)
        self.assertIn("Email sign-in", content)
        self.assertIn("node_login", content)
        # A terse requirement is no longer padded with placeholder noise: no
        # [NEEDS CLARIFICATION] markers and no manufactured "no acceptance
        # criteria" open questions. (Real impact flags may still surface.)
        self.assertNotIn("[NEEDS CLARIFICATION", content)
        self.assertNotIn("no acceptance criteria", content)

    def test_spec_whole_project_without_focus(self) -> None:
        project_id = self._seed_project()
        spec = self.client.post(f"/api/projects/{project_id}/spec", json={}).json()
        self.assertEqual(spec["requirementCount"], 2)
        content = spec["content"]
        self.assertIn("FR-001", content)
        self.assertIn("FR-002", content)
        self.assertIn("node_login", content)
        self.assertIn("node_profile", content)

    def test_spec_records_prompt_as_requested_focus(self) -> None:
        project_id = self._seed_project()
        spec = self.client.post(
            f"/api/projects/{project_id}/spec",
            json={"focusNodeId": "node_login", "instruction": "Prioritize SSO over password sign-in."},
        ).json()
        content = spec["content"]
        self.assertIn("## Requested Focus", content)
        self.assertIn("Prioritize SSO over password sign-in.", content)

    def test_spec_returns_404_for_unknown_project(self) -> None:
        self.assertEqual(self.client.post("/api/projects/missing/spec", json={}).status_code, 404)

    def test_mcp_get_canvas_spec_serves_saved_spec_node(self) -> None:
        project_id = self._seed_project()
        # Mirror the UI flow: generate the spec, then store it as a spec node.
        spec = self.client.post(f"/api/projects/{project_id}/spec", json={"focusNodeId": "node_login"}).json()
        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        spec_node = make_node("node_spec_login", spec["title"], "spec")
        spec_node["data"]["fields"]["content"] = spec["content"]  # type: ignore[index]
        snapshot["nodes"].append(spec_node)
        self.assertEqual(self.client.put(f"/api/projects/{project_id}/canvas", json=snapshot).status_code, 200)

        async def scenario() -> None:
            async with Client(create_mcp_app(db_path=self.db_path)) as mcp:
                tool_names = {tool.name for tool in await mcp.list_tools()}
                self.assertIn("get_canvas_spec", tool_names)

                payload = _first_content(
                    await mcp.call_tool("get_canvas_spec", {"project_id": project_id, "spec_id": "node_spec_login"})
                )
                self.assertEqual(payload["status"], "ok")
                self.assertEqual(payload["spec"]["id"], "node_spec_login")
                self.assertIn("FR-001", payload["spec"]["content"])
                self.assertIn("Email sign-in", payload["instruction"])

                # Omitting spec_id falls back to the most recent spec node.
                latest = _first_content(await mcp.call_tool("get_canvas_spec", {"project_id": project_id}))
                self.assertEqual(latest["spec"]["id"], "node_spec_login")

        asyncio.run(scenario())

    def test_mcp_get_canvas_spec_reports_missing_spec(self) -> None:
        project_id = self._seed_project()

        async def scenario() -> None:
            async with Client(create_mcp_app(db_path=self.db_path)) as mcp:
                payload = _first_content(await mcp.call_tool("get_canvas_spec", {"project_id": project_id}))
                self.assertEqual(payload["status"], "no_spec")

        asyncio.run(scenario())


def _first_content(result):
    content = result.content[0]
    if hasattr(content, "data"):
        return content.data
    if hasattr(content, "text"):
        import json

        return json.loads(content.text)
    raise AssertionError(f"Unsupported MCP content result: {content!r}")


if __name__ == "__main__":
    unittest.main()

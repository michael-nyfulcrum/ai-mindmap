from __future__ import annotations

import os
import unittest

from fastmcp import Client

from context_canvas_mcp.app import create_app as create_mcp_app

from test.helpers import ApiE2ECase, make_edge, make_node


class McpCanvasContextE2ETest(ApiE2ECase):
    def setUp(self) -> None:
        super().setUp()
        self.previous_db_path = os.environ.get("CONTEXT_CANVAS_DB_PATH")
        os.environ["CONTEXT_CANVAS_DB_PATH"] = str(self.db_path)

    def tearDown(self) -> None:
        if self.previous_db_path is None:
            os.environ.pop("CONTEXT_CANVAS_DB_PATH", None)
        else:
            os.environ["CONTEXT_CANVAS_DB_PATH"] = self.previous_db_path
        super().tearDown()

    def test_mcp_reads_and_updates_saved_canvas_context_for_coding_agents(self) -> None:
        project_id = self.create_project("MCP agent project")
        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        snapshot["nodes"] = [
            make_node("node_contract", "Agent Contract", "project_contract"),
            make_node("node_requirement_initial", "Initial saved requirement"),
        ]
        snapshot["edges"] = [make_edge("edge_contract_initial", "node_contract", "node_requirement_initial", "defines")]
        self.assertEqual(self.client.put(f"/api/projects/{project_id}/canvas", json=snapshot).status_code, 200)

        async def scenario() -> None:
            async with Client(create_mcp_app()) as mcp:
                projects = await mcp.call_tool("list_canvas_projects", {"limit": 10})
                project_payload = _first_content(projects)
                self.assertIn(project_id, str(project_payload))

                context_result = await mcp.call_tool(
                    "get_canvas_context",
                    {"project_id": project_id, "task": "Implement the agent-facing requirements flow."},
                )
                context_payload = _first_content(context_result)
                self.assertEqual(context_payload["status"], "ok")
                markdown = context_payload["context"]["markdown"]
                self.assertIn("Initial saved requirement", markdown)
                self.assertIn("Implement the agent-facing requirements flow.", markdown)

                upserted = await mcp.call_tool(
                    "upsert_requirement_node",
                    {
                        "project_id": project_id,
                        "node_id": "node_requirement_agent_context",
                        "title": "Agent Context Tooling",
                        "content": "Coding agents can read and update the saved requirements canvas through MCP.",
                        "source_node_ids": ["node_contract"],
                        "tags": ["agent", "mcp"],
                    },
                )
                self.assertEqual(_first_content(upserted)["status"], "created")

                updated_context = await mcp.call_tool("get_canvas_context", {"project_id": project_id})
                self.assertIn("Agent Context Tooling", _first_content(updated_context)["context"]["markdown"])

        import asyncio

        asyncio.run(scenario())

        api_snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        titles = [node["data"]["title"] for node in api_snapshot["nodes"]]
        self.assertIn("Agent Context Tooling", titles)
        stored_node = next(node for node in api_snapshot["nodes"] if node["id"] == "node_requirement_agent_context")
        self.assertEqual(stored_node["data"]["fields"], {"content": "Coding agents can read and update the saved requirements canvas through MCP."})
        self.assertTrue(
            any(
                edge["source"] == "node_contract"
                and edge["target"] == "node_requirement_agent_context"
                and edge["data"]["managedBy"] == "context_canvas_mcp"
                for edge in api_snapshot["edges"]
            )
        )


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

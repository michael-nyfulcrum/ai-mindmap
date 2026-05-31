from __future__ import annotations

import unittest

from fastmcp import Client

from context_canvas_mcp.app import create_app as create_mcp_app

from test.helpers import ApiE2ECase, make_edge, make_node


class McpCanvasContextE2ETest(ApiE2ECase):
    def test_mcp_reads_and_updates_saved_canvas_context_for_coding_agents(self) -> None:
        project_id = self.create_project("MCP agent project")
        snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        snapshot["nodes"] = [
            make_node("node_contract", "Agent Contract", "project_contract"),
            make_node("node_requirement_initial", "Initial saved requirement"),
        ]
        snapshot["edges"] = [make_edge("edge_contract_initial", "node_contract", "node_requirement_initial", "defines")]
        self.assertEqual(self.client.put(f"/api/projects/{project_id}/canvas", json=snapshot).status_code, 200)
        self.assertEqual(
            self.client.patch(
                f"/api/projects/{project_id}/nodes/node_contract",
                json={"data": {"fields": {"content": "Agent contract now requires MCP handoff context."}}},
            ).status_code,
            200,
        )

        async def scenario() -> None:
            async with Client(create_mcp_app(db_path=self.db_path)) as mcp:
                tools = await mcp.list_tools()
                tool_names = {tool.name for tool in tools}
                self.assertTrue(
                    {
                        "list_canvas_projects",
                        "get_canvas_snapshot",
                        "get_canvas_context",
                        "upsert_requirement_node",
                        "upsert_source_snapshot_node",
                        "summarize_canvas_nodes",
                    }.issubset(tool_names)
                )
                prompts = await mcp.list_prompts()
                prompt_names = {prompt.name for prompt in prompts}
                self.assertIn("use_context_canvas_for_task", prompt_names)
                resources = await mcp.list_resources()
                resource_uris = {str(resource.uri) for resource in resources}
                self.assertIn("mindmap://projects", resource_uris)
                prompt = await mcp.get_prompt("use_context_canvas_for_task", {"task": "Implement the agent-facing requirements flow."})
                self.assertIn("get_canvas_context", str(prompt))
                projects_resource = await mcp.read_resource("mindmap://projects")
                self.assertIn(project_id, str(projects_resource))

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
                self.assertIn("## Active Impact Flags", markdown)
                self.assertIn("node_requirement_initial", markdown)
                self.assertIn("## Recent Contract Changes", markdown)

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

                cleared_sources = await mcp.call_tool(
                    "upsert_requirement_node",
                    {
                        "project_id": project_id,
                        "node_id": "node_requirement_agent_context",
                        "title": "Agent Context Tooling",
                        "content": "Coding agents can read and update saved requirements through MCP after implementation decisions.",
                        "source_node_ids": [],
                        "tags": ["agent", "mcp"],
                    },
                )
                self.assertEqual(_first_content(cleared_sources)["status"], "updated")

                updated_context = await mcp.call_tool("get_canvas_context", {"project_id": project_id})
                self.assertIn("Agent Context Tooling", _first_content(updated_context)["context"]["markdown"])
                project_resource = await mcp.read_resource(f"mindmap://project/{project_id}/context")
                self.assertIn("Agent Context Tooling", str(project_resource))

        import asyncio

        asyncio.run(scenario())

        api_snapshot = self.client.get(f"/api/projects/{project_id}/canvas").json()
        titles = [node["data"]["title"] for node in api_snapshot["nodes"]]
        self.assertIn("Agent Context Tooling", titles)
        stored_node = next(node for node in api_snapshot["nodes"] if node["id"] == "node_requirement_agent_context")
        self.assertEqual(
            stored_node["data"]["fields"],
            {"content": "Coding agents can read and update saved requirements through MCP after implementation decisions."},
        )
        self.assertEqual(stored_node["data"]["audit"]["createdBy"], "mindmap_mcp")
        self.assertEqual(
            self.sqlite_scalar(
                "SELECT created_by FROM contract_change_versions WHERE project_id = ? AND node_id = ?",
                (project_id, "node_requirement_agent_context"),
            ),
            "mindmap_mcp",
        )
        self.assertFalse(
            any(
                edge["target"] == "node_requirement_agent_context"
                and edge["data"].get("managedBy") == "mindmap_mcp"
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

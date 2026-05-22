from __future__ import annotations

from typing import Any

from fastmcp import FastMCP
from pydantic import BaseModel, Field

from context_canvas_mcp.canvas_store import CanvasStore
from context_canvas_mcp.sources import (
    feature_status,
    fetch_confluence_page,
    fetch_figma_link_metadata,
    fetch_generic_source,
    fetch_github_issue_or_pr,
    fetch_jira_issue,
    search_confluence_pages,
    search_jira_issues,
    search_sources,
)

CORE_TAGS = {"context-canvas", "source"}


class EchoResponse(BaseModel):
    message: str
    uppercase: str
    character_count: int


class CanvasSummary(BaseModel):
    project_name: str
    node_count: int
    edge_count: int
    requirement_count: int
    source_count: int
    summary: str = Field(description="Plain-language context summary.")


def register_capabilities(app: FastMCP) -> None:
    @app.tool(
        name="echo",
        tags=CORE_TAGS | {"diagnostic"},
        description="Echo a message back for MCP smoke testing.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False},
    )
    def echo(message: str) -> EchoResponse:
        return EchoResponse(message=message, uppercase=message.upper(), character_count=len(message))

    @app.tool(
        name="search_jira_issues",
        tags=CORE_TAGS | {"jira", "retrieval"},
        description="Search Jira issues for requirement source context.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": True},
    )
    def search_jira_issues_tool(query: str, max_results: int = 5):
        return search_jira_issues(query=query, max_results=min(max(max_results, 1), 10))

    @app.tool(
        name="fetch_jira_issue",
        tags=CORE_TAGS | {"jira", "retrieval"},
        description="Fetch a Jira issue by issue key.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": True},
    )
    def fetch_jira_issue_tool(issue_key: str):
        return fetch_jira_issue(issue_key)

    @app.tool(
        name="search_confluence_pages",
        tags=CORE_TAGS | {"confluence", "retrieval"},
        description="Search Confluence pages for requirement source context.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": True},
    )
    def search_confluence_pages_tool(query: str, max_results: int = 5):
        return search_confluence_pages(query=query, max_results=min(max(max_results, 1), 10))

    @app.tool(
        name="fetch_confluence_page",
        tags=CORE_TAGS | {"confluence", "retrieval"},
        description="Fetch a Confluence page by page ID.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": True},
    )
    def fetch_confluence_page_tool(page_id: str):
        return fetch_confluence_page(page_id)

    @app.tool(
        name="fetch_figma_link_metadata",
        tags=CORE_TAGS | {"figma", "retrieval"},
        description="Normalize a Figma URL into source metadata for canvas citation.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": True},
    )
    def fetch_figma_link_metadata_tool(url: str):
        return fetch_figma_link_metadata(url)

    @app.tool(
        name="fetch_github_issue_or_pr",
        tags=CORE_TAGS | {"github", "retrieval"},
        description="Normalize a GitHub issue or pull request URL into source metadata.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": True},
    )
    def fetch_github_issue_or_pr_tool(url: str):
        return fetch_github_issue_or_pr(url)

    @app.tool(
        name="search_sources",
        tags=CORE_TAGS | {"retrieval"},
        description="Search configured source systems and merge normalized source references.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": True},
    )
    def search_sources_tool(query: str, sources: list[str] | None = None, max_results: int = 5):
        return search_sources(query=query, sources=sources, max_results=min(max(max_results, 1), 10))

    @app.tool(
        name="list_canvas_projects",
        tags=CORE_TAGS | {"canvas", "database"},
        description="List saved Context Canvas projects from the shared SQLite database.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False},
    )
    def list_canvas_projects(limit: int = 20):
        return CanvasStore.from_settings().list_projects(limit=limit)

    @app.tool(
        name="get_canvas_snapshot",
        tags=CORE_TAGS | {"canvas", "database"},
        description="Load a saved canvas snapshot from SQLite. Defaults to the most recently updated project.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False},
    )
    def get_canvas_snapshot(project_id: str | None = None):
        snapshot = CanvasStore.from_settings().get_snapshot(project_id)
        if not snapshot:
            return {"status": "not_found", "message": "No matching Context Canvas project was found."}
        return {"status": "ok", "snapshot": snapshot}

    @app.tool(
        name="get_canvas_context",
        tags=CORE_TAGS | {"canvas", "context", "database"},
        description=(
            "Return concise Markdown requirements context for coding agents. "
            "Use this before implementing a task that should honor the saved canvas."
        ),
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False},
    )
    def get_canvas_context(project_id: str | None = None, task: str | None = None):
        context = CanvasStore.from_settings().get_agent_context(project_id=project_id, task=task)
        if not context:
            return {"status": "not_found", "message": "No matching Context Canvas project was found."}
        return {"status": "ok", "context": context}

    @app.tool(
        name="upsert_requirement_node",
        tags=CORE_TAGS | {"canvas", "database", "write"},
        description="Create or update a requirement node in a saved Context Canvas project.",
        annotations={"readOnlyHint": False, "idempotentHint": False, "openWorldHint": False},
    )
    def upsert_requirement_node(
        project_id: str,
        title: str,
        body: str,
        priority: str = "Medium",
        status: str = "Draft",
        source_node_ids: list[str] | None = None,
        tags: list[str] | None = None,
        node_id: str | None = None,
    ):
        return CanvasStore.from_settings().upsert_requirement(
            project_id=project_id,
            title=title,
            body=body,
            priority=priority,
            status=status,
            source_node_ids=source_node_ids,
            tags=tags,
            node_id=node_id,
        )

    @app.tool(
        name="upsert_source_snapshot_node",
        tags=CORE_TAGS | {"canvas", "database", "write"},
        description="Create or update a source snapshot node in a saved Context Canvas project.",
        annotations={"readOnlyHint": False, "idempotentHint": False, "openWorldHint": False},
    )
    def upsert_source_snapshot_node(
        project_id: str,
        title: str,
        source_type: str,
        source_id: str,
        summary: str,
        source_url: str = "",
        raw_text: str = "",
        tags: list[str] | None = None,
        node_id: str | None = None,
    ):
        return CanvasStore.from_settings().upsert_source_snapshot(
            project_id=project_id,
            title=title,
            source_type=source_type,
            source_id=source_id,
            summary=summary,
            source_url=source_url,
            raw_text=raw_text,
            tags=tags,
            node_id=node_id,
        )

    @app.tool(
        name="summarize_canvas_nodes",
        tags=CORE_TAGS | {"canvas", "analysis"},
        description="Summarize a saved canvas snapshot without mutating it.",
        annotations={"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False},
    )
    def summarize_canvas_nodes(snapshot: dict[str, Any]) -> CanvasSummary:
        nodes = snapshot.get("nodes") or []
        edges = snapshot.get("edges") or []
        project = snapshot.get("project") or {}
        requirement_count = _count_type(nodes, "requirement")
        source_count = _count_type(nodes, "source_snapshot") + _count_type(nodes, "link")
        return CanvasSummary(
            project_name=str(project.get("name") or "Untitled canvas"),
            node_count=len(nodes),
            edge_count=len(edges),
            requirement_count=requirement_count,
            source_count=source_count,
            summary=f"{requirement_count} requirements are backed by {source_count} source-oriented nodes.",
        )

    @app.resource(
        uri="info://server",
        name="ServerInfo",
        description="Context Canvas MCP server summary.",
        mime_type="text/plain",
        tags=CORE_TAGS | {"configuration"},
    )
    def server_info() -> str:
        return (
            "Context Canvas MCP v0.1.0\n"
            "Primary tools: search_jira_issues, fetch_jira_issue, search_confluence_pages, "
            "fetch_confluence_page, fetch_figma_link_metadata, fetch_github_issue_or_pr, "
            "search_sources, list_canvas_projects, get_canvas_snapshot, get_canvas_context, "
            "upsert_requirement_node, upsert_source_snapshot_node, summarize_canvas_nodes\n"
            "Purpose: expose saved requirements canvas context to coding agents and normalize "
            "external source context for saved requirements canvases."
        )

    @app.resource("context-canvas://projects", tags=CORE_TAGS | {"canvas", "database"})
    def canvas_projects_resource():
        return CanvasStore.from_settings().list_projects(limit=50)

    @app.resource("context-canvas://project/{project_id}/context", tags=CORE_TAGS | {"canvas", "database"})
    def canvas_project_context_resource(project_id: str):
        context = CanvasStore.from_settings().get_agent_context(project_id=project_id)
        return context or {"status": "not_found", "message": f"Project not found: {project_id}"}

    @app.resource("jira://config", tags=CORE_TAGS | {"jira", "configuration"})
    def jira_config():
        return feature_status("Jira")

    @app.resource("confluence://config", tags=CORE_TAGS | {"confluence", "configuration"})
    def confluence_config():
        return feature_status("Confluence")

    @app.resource("jira://issue/{issue_key}", tags=CORE_TAGS | {"jira", "template"})
    def jira_issue_resource(issue_key: str):
        return fetch_jira_issue(issue_key)

    @app.resource("confluence://page/{page_id}", tags=CORE_TAGS | {"confluence", "template"})
    def confluence_page_resource(page_id: str):
        return fetch_confluence_page(page_id)

    @app.prompt(tags=CORE_TAGS | {"prompt"}, description="Prompt for analyzing saved requirements context.")
    def analyze_requirements_canvas() -> str:
        return (
            "Analyze the saved Context Canvas requirements. Focus on project contract, requirements, "
            "source snapshots, and citation coverage."
        )

    @app.prompt(tags=CORE_TAGS | {"prompt", "coding-agent"}, description="Prompt for coding agents using saved canvas context.")
    def use_context_canvas_for_task(task: str) -> str:
        return (
            "Before changing code, call get_canvas_context with this task and use the returned Markdown "
            "as the source of truth for requirements. Update the canvas with upsert_requirement_node or "
            f"upsert_source_snapshot_node if implementation decisions change. Task: {task}"
        )


def _count_type(nodes: list[dict[str, Any]], canvas_type: str) -> int:
    count = 0
    for node in nodes:
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        if data.get("canvasType") == canvas_type:
            count += 1
    return count

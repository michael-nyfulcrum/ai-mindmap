# MCP Documentation

Current state as of 2026-05-22: the FastMCP service exposes saved Context Canvas state to coding agents and can write requirement/source nodes back to SQLite.

## Run Locally

```sh
make dev-mcp
```

Endpoint:

```text
http://127.0.0.1:8790/mcp
```

By default, MCP reads the local API database:

```text
services/api/context-canvas.sqlite
```

Override the database path when needed:

```sh
CONTEXT_CANVAS_DB_PATH=/absolute/path/to/context-canvas.sqlite make dev-mcp
```

## Coding Agent Workflow

Agents such as Codex or Claude should:

1. Call `list_canvas_projects` to find the relevant project.
2. Call `get_canvas_context` with the project ID and current task.
3. Use the returned Markdown as the source of truth for requirements.
4. Call `upsert_requirement_node` or `upsert_source_snapshot_node` when implementation decisions change the project context.

When `upsert_requirement_node` receives `source_node_ids`, it creates MCP-managed `supports` edges for existing source nodes. The requirement node itself still stores its editable text only in `fields.content`.

## Canvas Tools

- `list_canvas_projects`
- `get_canvas_snapshot`
- `get_canvas_context`
- `upsert_requirement_node`
- `upsert_source_snapshot_node`
- `summarize_canvas_nodes`

`get_canvas_context` returns:

- Project name and description.
- Requirement nodes.
- Source, link, and contract nodes.
- Canvas relationships.
- Markdown formatted for agent prompts.

## Resources

- `context-canvas://projects`
- `context-canvas://project/{project_id}/context`
- `info://server`

## Prompts

- `analyze_requirements_canvas`
- `use_context_canvas_for_task`

## Deferred External Source Tools

The MCP server still includes experimental Jira, Confluence, Figma, GitHub, and generic source helpers. Jira and Confluence require Atlassian credentials:

```sh
ATLASSIAN_URL=
ATLASSIAN_EMAIL=
ATLASSIAN_TOKEN=
```

Slack is not implemented.

## Verification

Backend e2e includes an MCP scenario that uses FastMCP's client against a real temporary SQLite database. It verifies that MCP can read saved API canvas state, return agent-ready context, write a requirement node, and have that node visible through the API.

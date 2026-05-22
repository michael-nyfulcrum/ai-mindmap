# API Documentation

Current state as of 2026-05-22: these routes are implemented by the FastAPI backend in `services/api/context_canvas_api`.

Base URL in local development:

```text
http://127.0.0.1:8787
```

## Health

```http
GET /health
```

Returns:

```json
{ "status": "ok" }
```

## Projects

```http
GET /api/projects
POST /api/projects
GET /api/projects/:projectId
PATCH /api/projects/:projectId
DELETE /api/projects/:projectId
```

Create body:

```json
{
  "name": "Client CR Canvas",
  "description": "Optional description"
}
```

Patch body:

```json
{
  "name": "Updated name",
  "description": "Updated description"
}
```

## Canvas

```http
GET /api/projects/:projectId/canvas
PUT /api/projects/:projectId/canvas
```

The canvas response contains:

```json
{
  "project": {},
  "nodes": [],
  "edges": []
}
```

The web app autosaves by sending the whole current canvas to `PUT /canvas`.

## Nodes

```http
POST /api/projects/:projectId/nodes
PATCH /api/projects/:projectId/nodes/:nodeId
DELETE /api/projects/:projectId/nodes/:nodeId
```

Create body:

```json
{
  "id": "node_requirement_1",
  "type": "contextNode",
  "position": { "x": 100, "y": 100 },
  "data": {
    "canvasType": "requirement",
    "title": "Requirement title",
    "fields": {
      "body": "Requirement body",
      "priority": "High",
      "status": "Draft",
      "sourceNodeIds": ""
    },
    "tags": [],
    "updatedAt": "2026-05-14T00:00:00.000Z"
  }
}
```

Deleting a node also deletes connected edges.

## Edges

```http
POST /api/projects/:projectId/edges
PATCH /api/projects/:projectId/edges/:edgeId
DELETE /api/projects/:projectId/edges/:edgeId
```

Create body:

```json
{
  "id": "edge_1",
  "source": "node_contract",
  "target": "node_requirement_1",
  "label": "implements"
}
```

The API validates that both edge nodes exist.

## Uploads

```http
POST /api/uploads
GET /api/uploads/:uploadId
```

Upload body:

```json
{
  "projectId": "project_demo_context_canvas",
  "filename": "screenshot.png",
  "contentType": "image/png",
  "dataUrl": "data:image/png;base64,..."
}
```

The API stores:

- file bytes in `services/api/uploads`
- upload metadata in SQLite

The response includes a URL usable by Image nodes.

Uploads reject malformed data URLs and files larger than `CONTEXT_CANVAS_MAX_UPLOAD_BYTES`, which defaults to 10 MiB.

## Analysis

```http
POST /api/projects/:projectId/analyze
```

Request:

```json
{
  "question": "What does this change request cover?"
}
```

Response:

```json
{
  "status": "ok",
  "model": "gpt-4.1-mini",
  "summary": "...",
  "findings": [
    {
      "severity": "low",
      "title": "...",
      "detail": "...",
      "citationNodeIds": ["node_contract"]
    }
  ],
  "missingContext": [],
  "suggestedNextSteps": [],
  "citations": [
    {
      "nodeId": "node_contract",
      "title": "GGR-5534 Help Center CR Contract"
    }
  ]
}
```

Analysis reads the saved SQLite canvas for the project, uses OpenAI, and does not mutate the graph. `OPENAI_API_KEY` is required.

## Chats

```http
GET /api/projects/:projectId/chats
POST /api/projects/:projectId/chats
GET /api/projects/:projectId/chats/:chatId
DELETE /api/projects/:projectId/chats/:chatId
POST /api/projects/:projectId/chats/:chatId/messages
```

Create body:

```json
{ "title": "New chat" }
```

Send message body:

```json
{ "content": "Summarize the saved requirements" }
```

The message endpoint saves the user message, reads the current saved SQLite canvas, generates a conversational OpenAI assistant response in GitHub-Flavored Markdown, attaches cited analysis metadata, saves the assistant message, and returns the full thread message list.

## Deferred Sources

```http
POST /api/sources/fetch
POST /api/sources/search
```

These endpoints exist as experimental scaffolding, but Jira, Confluence, Slack, and broader external tooling are deferred from the current production-ready core. They are not part of the required backend e2e gate for the current MVP.

Fetch body:

```json
{
  "sourceType": "figma",
  "url": "https://www.figma.com/design/abc/File"
}
```

Search body:

```json
{
  "query": "GGR-5534",
  "sources": ["jira", "confluence"],
  "maxResults": 5
}
```

The API uses the MCP source layer for normalized source documents.

Current behavior:

- Jira and Confluence search/fetch use Atlassian credentials when configured.
- Jira and Confluence return structured `unconfigured` responses when credentials are absent.
- Figma, GitHub, and generic URL fetches normalize link metadata for source snapshots without external API calls.

Jira and Confluence require:

```sh
ATLASSIAN_URL=
ATLASSIAN_EMAIL=
ATLASSIAN_TOKEN=
```

Figma, GitHub, and generic URL fetches currently normalize link metadata for source snapshots.

## MCP Canvas Context

Local MCP server:

```sh
make dev-mcp
```

Endpoint:

```text
http://127.0.0.1:8790/mcp
```

The MCP server is supported for local coding-agent workflows over the saved SQLite canvas. It reads `services/api/context-canvas.sqlite` by default. Override with `CONTEXT_CANVAS_DB_PATH`.

Canvas tools:

- `list_canvas_projects`
- `get_canvas_snapshot`
- `get_canvas_context`
- `upsert_requirement_node`
- `upsert_source_snapshot_node`
- `summarize_canvas_nodes`

Canvas resources:

- `context-canvas://projects`
- `context-canvas://project/{project_id}/context`
- `info://server`

Coding-agent prompt:

- `use_context_canvas_for_task`

External source tools remain experimental:

- `search_jira_issues`
- `fetch_jira_issue`
- `search_confluence_pages`
- `fetch_confluence_page`
- `fetch_figma_link_metadata`
- `fetch_github_issue_or_pr`
- `search_sources`

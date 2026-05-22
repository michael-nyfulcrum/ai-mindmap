# Context Canvas Product Spec

Current repo state as of 2026-05-22.

## Summary

Context Canvas is a minimal requirements canvas for centralizing project context. The current production-ready core supports a DB-backed React canvas, FastAPI backend, SQLite persistence, AI question answering against the saved canvas, chat history, and uploads.

The product is currently an MVP for local use and change-request preparation. It is not yet a production-authenticated collaboration system.

## Architecture

| Layer | Path | Current Role |
| --- | --- | --- |
| Web app | `apps/web` | Vite React app with ReactFlow canvas, inspector, toolbar, uploads, and chat-style analysis UI. |
| API service | `services/api/context_canvas_api` | FastAPI app for projects, saved canvas state, uploads, analysis, and chat. |
| MCP service | `services/mcp/context_canvas_mcp` | FastMCP service for coding agents to read saved canvas context and write requirement/source nodes back to SQLite. External source tools remain experimental. |
| Database | `services/api/context-canvas.sqlite` | Local SQLite database for persistent MVP state. |
| Tests | `services/api/test` | Backend e2e tests covering core frontend-facing API behavior with no mocks. AI tests call OpenAI through local `.env` configuration. |

## Data Ownership

The FastAPI service is the system of record for product data. It owns:

- Projects.
- Canvas nodes.
- Canvas edges.
- Uploaded file metadata.
- Analysis runs.
- Chat threads.
- Chat messages.

The MCP service can read saved canvas context and write requirement/source nodes to the same SQLite database for coding-agent workflows. Jira, Confluence, Slack, and broader external-app workflows are later improvements.

## Current Feature Progress

| Feature | Status | Evidence |
| --- | --- | --- |
| Project creation/listing/loading | Complete | API routes and backend e2e. |
| Canvas save/load | Complete | SQLite-backed `GET/PUT /canvas`, restart persistence e2e. |
| Node CRUD | Complete | API routes and e2e. |
| Edge CRUD | Complete | API routes and e2e. |
| Image uploads | Complete | `POST /api/uploads`, upload serving, e2e. |
| AI analysis | Complete | `POST /analyze` and chat use OpenAI with saved SQLite canvas context. Chat replies are rendered as Markdown in the UI. |
| Chat history | Complete | Chat threads/messages persisted and reloaded. |
| DB-backed AI context | Complete | E2e proves analysis and chat read the saved SQLite canvas, including after API restart. |
| Source fetch/search | Deferred from core gate | Endpoints exist as experimental scaffolding; external tooling is not currently claimed production-ready. |
| MCP canvas tools | Complete | E2e proves MCP reads saved API canvas state, returns agent-ready context, writes a requirement node, and the API can reload that node. |
| MCP external source tools | Deferred from core gate | Jira/Confluence/Figma/GitHub helpers exist as experimental scaffolding; external tooling is not currently claimed production-ready. |
| Legacy SQLite migration | Complete for current legacy schemas | Shape-based migration covered by e2e. |
| Frontend runtime QA | Manual | Per current project direction, frontend interaction testing is manual; automated frontend checks are TypeScript build and lint. |
| Auth/permissions | Not started | Out of MVP. |
| Slack integration | Not started | Later improvement. |

## Supported API Surface

- `GET /health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`
- `GET /api/projects/:projectId/canvas`
- `PUT /api/projects/:projectId/canvas`
- `POST /api/projects/:projectId/nodes`
- `PATCH /api/projects/:projectId/nodes/:nodeId`
- `DELETE /api/projects/:projectId/nodes/:nodeId`
- `POST /api/projects/:projectId/edges`
- `PATCH /api/projects/:projectId/edges/:edgeId`
- `DELETE /api/projects/:projectId/edges/:edgeId`
- `POST /api/uploads`
- `GET /api/uploads/:uploadId`
- `POST /api/projects/:projectId/analyze`
- `GET /api/projects/:projectId/chats`
- `POST /api/projects/:projectId/chats`
- `GET /api/projects/:projectId/chats/:chatId`
- `DELETE /api/projects/:projectId/chats/:chatId`
- `POST /api/projects/:projectId/chats/:chatId/messages`

## MCP Canvas Surface

Production-supported local canvas tools:

- `list_canvas_projects`
- `get_canvas_snapshot`
- `get_canvas_context`
- `upsert_requirement_node`
- `upsert_source_snapshot_node`
- `summarize_canvas_nodes`

Production-supported local canvas resources:

- `context-canvas://projects`
- `context-canvas://project/{project_id}/context`
- `info://server`

Production-supported prompts:

- `analyze_requirements_canvas`
- `use_context_canvas_for_task`

## Deferred Source Surface

The following external source surfaces are present in the repo but are deferred from the current production-ready core gate:

Tools:

- `search_jira_issues`
- `fetch_jira_issue`
- `search_confluence_pages`
- `fetch_confluence_page`
- `fetch_figma_link_metadata`
- `fetch_github_issue_or_pr`
- `search_sources`

Resources:

- `info://server`
- `jira://config`
- `confluence://config`
- `jira://issue/{issue_key}`
- `confluence://page/{page_id}`

Prompt:

- `analyze_requirements_canvas`

## Source Integration Status

| Source | Current Support |
| --- | --- |
| Jira | Deferred. Experimental code exists but is not in the current core test gate. |
| Confluence | Deferred. Experimental code exists but is not in the current core test gate. |
| Figma | Deferred metadata-only scaffolding. |
| GitHub | Deferred metadata-only scaffolding. |
| Generic URL | Deferred metadata-only scaffolding. |
| Slack | Deferred and not implemented. |

## Current Verification Status

Latest verification run on 2026-05-22:

| Check | Result |
| --- | --- |
| `pnpm test:e2e` | Pass, 9 backend e2e tests |
| `pnpm build` | Pass |
| `pnpm lint` | Pass |

Current backend e2e coverage:

- Project CRUD and delete cascade.
- Whole-canvas save/load, viewport persistence, project-ID mismatch handling, and API restart persistence.
- Node and edge CRUD with validation.
- Upload validation, SQLite metadata persistence, and file serving.
- AI analysis reading the saved SQLite canvas, persisting analysis runs, preserving graph data, and surviving API restart.
- Chat creation, message persistence, automatic title rename, current saved-canvas analysis, reload, and delete cascade.
- MCP agent context flow over the saved SQLite canvas, including write-back visible through the API.
- Legacy SQLite schema migration.

## Current Limitations

- No production authentication or permission model.
- No multi-user realtime collaboration.
- Frontend interaction QA is currently manual by project choice; automated frontend coverage is build and lint.
- Jira, Confluence, Slack, and MCP external source workflows are deferred from the current production-ready core.
- No vector database retrieval.
- No explicit schema version table yet; migrations are currently table-shape based.

## Recommended Next Implementation Order

1. Add explicit SQLite schema version tracking.
2. Add a project switcher for multiple saved canvases.
3. Add MCP project-scoped permission/auth controls before remote deployment.
4. Add UI source capture/import flow with user confirmation.
5. Add source integration settings UI for local Atlassian credentials.
6. Add auth and permissions when preparing for production deployment.

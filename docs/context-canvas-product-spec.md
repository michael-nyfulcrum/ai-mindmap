# Context Canvas Product Spec

Current repo state as of 2026-05-26.

## Summary

Context Canvas is a minimal requirements canvas for centralizing project context. The current production-ready core supports a DB-backed React canvas, FastAPI backend, SQLite persistence, contract and requirement change history, affected-node flags, AI question answering against the saved canvas, chat history, uploads, and local MCP context for coding agents.

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
- Contract and requirement version history.
- Backend-managed audit and affected-node flag metadata.
- Schema migration markers.

All canvas nodes use one large editable `fields.content` body plus node-level
metadata such as title, tags, updated time, and relationships. Nodes should not
be modeled as many separate type-specific detail fields.

The MCP service can read saved canvas context and write requirement/source nodes to the same SQLite database for coding-agent workflows. MCP requirement write-back records audit metadata and version history. Jira, Confluence, Slack, and broader external-app workflows are later improvements.

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
| Contract and requirement version history | Complete | Semantic changes create changelog-style audit rows; layout-only changes do not. |
| Affected-node flags | Complete | Contract and requirement changes flag connected impacted nodes as review, outdated, needs-update, or conflict. |
| Flagged-node plan drafting | Complete | Chat can draft an update plan for a flagged node without mutating the canvas graph. |
| Source fetch/search | Deferred from core gate | Endpoints exist as experimental scaffolding; external tooling is not currently claimed production-ready. |
| MCP canvas tools | Complete | E2e proves MCP reads saved API canvas state, returns agent-ready context/resources/prompts, writes requirement/source nodes with audit history, and the API can reload that state. |
| MCP external source tools | Deferred from core gate | Jira/Confluence/Figma/GitHub helpers exist as experimental scaffolding; external tooling is not currently claimed production-ready. |
| Legacy SQLite migration | Complete for current legacy schemas | Shape-based migration and schema migration tracking covered by e2e. |
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
- `GET /api/projects/:projectId/versions`
- `GET /api/projects/:projectId/nodes/:nodeId/versions`
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

`get_canvas_context` includes active impact flags and recent contract or requirement changes. `upsert_requirement_node` writes audit metadata and version history, including MCP-managed source support edges when source node IDs are supplied.

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

Latest verification run on 2026-05-26:

| Check | Result |
| --- | --- |
| `PYTHONPATH=services/api:services/mcp CONTEXT_CANVAS_DISABLE_CHANGE_AI=1 uv run --project . python -m unittest discover -s services/api/test -t . -v` | Pass, 11 backend e2e tests |
| `pnpm build` | Pass |
| `pnpm lint` | Pass |
| `git diff --check` | Pass |

Current backend e2e coverage:

- Project CRUD and delete cascade.
- Whole-canvas save/load, viewport persistence, project-ID mismatch handling, and API restart persistence.
- Node and edge CRUD with validation.
- Upload validation, SQLite metadata persistence, and file serving.
- AI analysis reading the saved SQLite canvas, persisting analysis runs, preserving graph data, and surviving API restart.
- Chat creation, message persistence, automatic title rename, current saved-canvas analysis, reload, and delete cascade.
- Contract and requirement version history, affected-node flags, and UI-only highlight stripping.
- AI plan chat for flagged nodes without graph mutation.
- Manual source snapshot storage and citation edges.
- MCP agent context flow over the saved SQLite canvas, including resources/prompts and write-back visible through the API.
- Legacy SQLite schema migration with schema migration tracking.

## Current Limitations

- No production authentication or permission model.
- No multi-user realtime collaboration.
- Frontend interaction QA is currently manual by project choice; automated frontend coverage is build and lint.
- Jira, Confluence, Slack, and MCP external source workflows are deferred from the current production-ready core.
- No vector database retrieval.
- Schema migrations are tracked locally, but there is no production migration runner or rollback framework.

## Recommended Next Implementation Order

1. Add a project switcher for multiple saved canvases.
2. Add MCP project-scoped permission/auth controls before remote deployment.
3. Add a review queue for affected-node flags with accept, dismiss, and defer states.
4. Add a version diff viewer for contract and requirement history.
5. Add UI source capture/import flow with user confirmation.
6. Add source integration settings UI for local Atlassian credentials.
7. Add auth and permissions when preparing for production deployment.

# Context Canvas MVP Requirements

Current repo state as of 2026-05-26.

## Product Goal

Context Canvas is a DB-backed project information canvas. Users create a central project contract, add requirement and source nodes around it, connect related information, and ask AI questions against the saved canvas.

The MVP is intentionally minimal. It is not a task tracker, issue tracker, or open-question tracker.

## Current Implementation Status

| Area | Status | Notes |
| --- | --- | --- |
| React canvas UI | Implemented | Vite, ReactFlow, toolbar, node inspector, image upload flow, and chat-style analysis panel. |
| Backend API | Implemented | FastAPI service in `services/api/context_canvas_api`. |
| Persistence | Implemented | SQLite stores projects, nodes, edges, uploads, analysis runs, chat threads, and chat messages. |
| SQLite migrations | Implemented | Startup migrates older local node, edge, upload, and analysis table shapes. |
| AI analysis | Implemented | Uses OpenAI with saved SQLite canvas context. `OPENAI_API_KEY` is required. |
| Chat history | Implemented | New chats, old chats, user messages, assistant responses, and attached analysis metadata are stored in SQLite. |
| Source fetch API | Deferred from core gate | Experimental endpoints remain in the repo, but Jira, Confluence, Slack, and external tooling are later improvements. |
| MCP canvas service | Implemented | FastMCP tools expose saved canvas context to coding agents and can write requirement/source nodes back to SQLite. |
| MCP external source tools | Deferred from core gate | Jira, Confluence, Figma, GitHub, and generic source helpers remain experimental. |
| Backend e2e | Implemented | 11 no-mock e2e tests cover projects, seeded demo loading, canvas persistence, restart persistence, node/edge CRUD, uploads, DB-backed analysis, chat, MCP canvas context/tools/resources/prompts, version history, and legacy DB migration. |
| Frontend runtime QA | Manual | Current frontend automation is TypeScript build and lint; interaction QA is manual. |
| Auth and permissions | Not implemented | Local MVP only. |
| Slack integration | Not implemented | Later improvement. |

## Primary Use Case

Use the canvas to prepare and review a client-facing change request package.

The seeded example is `GGR-5534 Help Center Change Request`, which shows:

- A central project contract and surrounding nodes that each use one large editable content body with lightweight metadata such as title, tags, update time, and relationships.
- Jira and Confluence source snapshots.
- A Figma reference link.
- Requirement nodes for access, content, support submission, and client CR output.
- Edges that show which sources support the contract and requirements.

## Supported User Workflows

### Canvas Management

- Create a new project canvas.
- Load saved project canvases from the API.
- Add, edit, move, connect, and delete canvas nodes.
- Label and delete edges.
- Persist the current canvas to SQLite.
- Reload the browser and keep the saved canvas.
- Restart the API and keep the saved canvas.

### Node Types

- Project Contract
- Requirement
- Source Snapshot
- Link
- Image
- Note

### AI And Chat

- Ask a question against the saved canvas.
- Receive a conversational AI response backed by saved canvas context and citation metadata.
- Create new chat threads.
- Select prior chat threads.
- Reload prior chat messages from SQLite.
- Focus cited nodes from response citation chips.

### Sources

- Add source snapshots and links manually as canvas nodes.
- Cite source node IDs from requirements.
- Coding agents can read and update saved canvas context through MCP.
- External source fetching, search, and Slack workflows are later improvements.

## Node Content Shape

Every canvas node is intentionally minimal:

- `title`
- `tags`
- `updatedAt`
- `fields.content`

Do not split nodes into separate goal, scope, non-goals, requirements,
acceptance criteria, definition-of-done, priority, status, source URL, summary,
or other type-specific form fields. Those details can still exist inside the
single content body when useful.

## In Scope

- Vite React web app.
- ReactFlow canvas.
- FastAPI backend.
- SQLite persistence.
- Project CRUD.
- Canvas load and save.
- Node CRUD.
- Edge CRUD.
- Image upload through the API.
- AI analysis endpoint.
- Chat-style analysis history.
- MCP canvas context tools for coding agents.
- Seeded `GGR-5534` change request example.
- Backend e2e test coverage.

## Out Of Scope

- Open Question nodes.
- Bug tracking.
- Analysis context mode toggles.
- Automatic AI graph mutation.
- Real-time multiplayer editing.
- OAuth.
- External app write-back.
- Jira, Confluence, and MCP external source workflows as production-ready core features.
- Slack integration.
- Automatic import of external sources into the canvas without user confirmation.
- Production auth and permissions.
- Vector database retrieval.

## Persistence Requirements

- Projects are persisted in SQLite.
- Nodes are persisted in SQLite.
- Edges are persisted in SQLite.
- Viewport is persisted in SQLite.
- Upload metadata is persisted in SQLite.
- Uploaded files are stored in the API uploads directory.
- Analysis runs are persisted in SQLite.
- Chat threads and chat messages are persisted in SQLite.
- Startup migrates supported legacy SQLite schema shapes.
- A saved canvas must reload after API restart.

## AI Requirements

- The AI analyzes the saved canvas as a whole.
- The user only sees a question input and chat history.
- The AI response must cite canvas nodes when possible.
- Chat responses must be conversational assistant replies, not raw analysis summaries.
- Analysis must not create, update, delete, or move nodes.
- Analysis runs are recorded for audit/debugging.
- `OPENAI_API_KEY` is required; there is no local AI fallback.

## API Requirements

Implemented API groups:

- `GET /health`
- `/api/projects`
- `/api/projects/:projectId/canvas`
- `/api/projects/:projectId/nodes`
- `/api/projects/:projectId/edges`
- `/api/projects/:projectId/versions`
- `/api/uploads`
- `/api/projects/:projectId/analyze`
- `/api/projects/:projectId/chats`

See [API documentation](api.md) for request and response shapes.

## MCP Canvas Context

The FastMCP service is production-supported for local coding-agent workflows against the saved SQLite canvas.

Supported MCP canvas tools:

- `list_canvas_projects`
- `get_canvas_snapshot`
- `get_canvas_context`
- `upsert_requirement_node`
- `upsert_source_snapshot_node`
- `summarize_canvas_nodes`

`get_canvas_context` includes active impact flags and recent contract changes. Requirement write-back through MCP records audit metadata and contract-change version history.

Supported MCP canvas resources:

- `context-canvas://projects`
- `context-canvas://project/{project_id}/context`
- `info://server`

Supported MCP prompts:

- `analyze_requirements_canvas`
- `use_context_canvas_for_task`

## Deferred MCP External Tooling

The repo also contains experimental FastMCP/source code copied from Nyfulcrum AI patterns for external source lookup. That external tooling is deferred from current production-ready core support.

Experimental MCP tools:

- `search_jira_issues`
- `fetch_jira_issue`
- `search_confluence_pages`
- `fetch_confluence_page`
- `fetch_figma_link_metadata`
- `fetch_github_issue_or_pr`
- `search_sources`

Experimental MCP resources:

- `info://server`
- `jira://config`
- `confluence://config`
- `jira://issue/{issue_key}`
- `confluence://page/{page_id}`

## Acceptance Criteria

| Criteria | Status |
| --- | --- |
| User can create a project. | Pass |
| User can add, edit, move, connect, and delete canvas nodes. | Pass |
| User can label and delete edges. | Pass |
| User can upload an image and see it as an image node. | Pass |
| User can refresh the browser and retain the saved canvas. | Pass |
| User can restart the API and retain the saved canvas. | Pass |
| User can ask a question and receive cited analysis. | Pass |
| User can create a new chat and reload prior chat messages. | Pass |
| User can store and cite source snapshots manually in the saved canvas. | Pass |
| Coding agents can read and update saved canvas context through MCP. | Pass |
| Developer handoff gives Claude Code/Codex-ready project and MCP context. | Pass |
| Contract and requirement changes create audit/version history. | Pass |
| Contract changes visibly flag affected nodes. | Pass |
| Flagged nodes can ask AI for an update plan without automatic mutation. | Pass |
| Existing older local SQLite DBs migrate on startup. | Pass |
| The seeded `GGR-5534` example loads from the database. | Pass |
| Backend e2e tests pass without unit tests or mocks. | Pass |

## Verification

Latest verification run on 2026-05-26:

- `pnpm --filter=@context-canvas/web lint`: passed.
- `pnpm --filter=@context-canvas/web build`: passed.
- `PYTHONPATH=services/api:services/mcp CONTEXT_CANVAS_DISABLE_CHANGE_AI=1 uv run --project . python -m unittest discover -s services/api/test -t . -v`: passed, 11 backend e2e tests.
- `UV_CACHE_DIR=.uv-cache PYTHONPATH=services/api:services/mcp uv run --project . python -m compileall services/api/context_canvas_api services/mcp/context_canvas_mcp services/api/test`: passed.
- `git diff --check`: passed.
- `pnpm build`: passed.
- `pnpm lint`: passed.

Backend e2e covers project creation, seeded demo loading, canvas save/reload, UI-only highlight stripping, API restart persistence, node/edge CRUD, upload validation and serving, manual source snapshot storage and citation edges, AI analysis over the saved SQLite canvas, chat message persistence over the current saved canvas, AI plan chat without graph mutation, contract/requirement version history, affected-node flags, MCP canvas tools/resources/prompts read/write, and legacy SQLite migration with schema migration tracking.

## Next Progress Items

| Priority | Item | Notes |
| --- | --- | --- |
| Medium | Add project switching UI | API supports multiple projects; UI currently starts from first project and can create new projects. |
| Medium | Add MCP auth controls | Required before exposing MCP beyond local development. |
| Medium | Add UI source capture/import flow | Require user confirmation before adding any external context. |
| Medium | Add settings UI for source config | Atlassian config should stay out of the core flow until intentionally reintroduced. |
| Later | Slack integration | Deliberately deferred. |
| Later | Auth and permissions | Needed before production deployment. |

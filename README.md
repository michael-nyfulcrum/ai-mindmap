# Context Canvas

A basic MVP for a human-controlled project context canvas. Users can create and connect requirement/source nodes, save the graph to SQLite, and ask questions against the saved canvas.

Current status: local MVP implemented and verified on 2026-05-22.

## What Is Included

- Vite React app with ReactFlow canvas.
- FastAPI app backed by SQLite.
- Project, canvas, node, edge, upload, and analysis persistence.
- AI analysis endpoint with citations.
- OpenAI-backed AI analysis and chat. `OPENAI_API_KEY` is required.
- FastMCP server for coding agents to read and update saved canvas context.
- Backend e2e tests against the core frontend-facing API contract, including API restart persistence and DB-backed AI context.
- Legacy local SQLite schema migration for the prior MVP table shapes.
- Seeded `GGR-5534 Help Center Change Request` contract example.

The product API and SQLite database are the system of record for saved canvas data. MCP can read/write saved canvas context for coding agents. External tooling such as Jira, Confluence, and Slack remains deferred from the current production-ready core gate.

## Quick Start

```sh
make install
make dev
```

Web app: `http://127.0.0.1:5173`

API: `http://127.0.0.1:8787`

MCP server:

```sh
make dev-mcp
```

MCP endpoint: `http://127.0.0.1:8790/mcp`

## Useful Commands

```sh
make dev-api
make dev-web
make dev-mcp
make build
make lint
make test-e2e
make reset-db
```

## Current Support

| Area | Status |
| --- | --- |
| Canvas CRUD and autosave | Supported |
| SQLite persistence | Supported |
| AI analysis and citations | Supported |
| Chat history | Supported |
| Uploads | Supported |
| MCP canvas context for coding agents | Supported |
| Jira/Confluence/Slack workflows | Deferred |
| Figma/GitHub/generic source metadata | Experimental, not part of current core gate |
| MCP external source tools | Experimental, not part of current core gate |
| Frontend interaction testing | Manual |
| Auth/permissions | Not implemented |

## Documentation

- [Product requirements](docs/product-requirements.md)
- [Current product spec and progress tracker](docs/context-canvas-product-spec.md)
- [API documentation](docs/api.md)
- [MCP documentation](docs/mcp.md)
- [Persistence and local operations](docs/persistence.md)

## Environment

```sh
PORT=8787
CONTEXT_CANVAS_DATABASE_URL=
CONTEXT_CANVAS_DB_PATH=
CONTEXT_CANVAS_UPLOAD_DIR=
CONTEXT_CANVAS_MAX_UPLOAD_BYTES=10485760
CONTEXT_CANVAS_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
VITE_API_BASE_URL=http://127.0.0.1:8787
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
ATLASSIAN_URL=
ATLASSIAN_EMAIL=
ATLASSIAN_TOKEN=
```

AI always uses OpenAI. There is no local AI fallback or runtime AI mode flag.

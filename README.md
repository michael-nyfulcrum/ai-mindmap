# Context Canvas

A basic MVP for a human-controlled project context canvas. Users can create and connect requirement/source nodes, save the graph to SQLite, and ask questions against the saved canvas.

Current status: local MVP implemented and verified on 2026-05-26.

## What Is Included

- Vite React app with ReactFlow canvas.
- FastAPI app backed by SQLite.
- Project, canvas, node, edge, upload, and analysis persistence.
- Contract/requirement version history with audit metadata and affected-node flags.
- Developer handoff prompt for Codex or other MCP-capable coding agents.
- AI plan drafting for flagged nodes through the saved chat workflow.
- AI analysis endpoint with citations.
- OpenAI-backed AI analysis and chat. `OPENAI_API_KEY` is required.
- FastMCP server for coding agents to read and update saved canvas context.
- Backend e2e tests against the core frontend-facing API contract, including API restart persistence and DB-backed AI context.
- Legacy local SQLite schema migration for the prior MVP table shapes.
- Seeded `GGR-5534 Help Center Change Request` contract example.

The product API and SQLite database are the system of record for saved canvas data. MCP can read/write saved canvas context for coding agents. External tooling such as Jira, Confluence, and Slack remains deferred from the current production-ready core gate.

## Quick Start

```sh
git clone git@github.com:michael-nyfulcrum/ai-mindmap.git
cd ai-mindmap
make doctor
make setup
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
make compose-config
make docker-up
make docker-smoke
make live-deploy
make live-status
make server-deploy
make package
make package-check
make reset-db
```

## Docker Demo

```sh
cp .env.example .env
make docker-up
make docker-smoke
```

The Caddy-backed demo runs at `http://127.0.0.1:8080` by default. The API is
proxied at `/api`, health is available at `/health`, and MCP is proxied at
`/mcp`.

For a dedicated EC2 or DigitalOcean server, keep `SITE_ADDRESS=:8080` for local
runs and set `DEMO_SITE_ADDRESS` to the bare domain in `.env`, without
`https://`. Keep `DOCKER_CONTEXT_CANVAS_CORS_ORIGINS` aligned to
`https://<domain>`, point DNS to the server, open ports `80` and `443`, then
run:

```sh
make env-demo
make live-deploy
make live-status
```

Run these on the target server, or with a Docker context that points at it.
`make live-preflight` stops if DNS for the live domain does not resolve back to
that server.

For the current server, deploy from a local checkout with rsync:

```sh
make server-deploy
```

This syncs to `root@143.198.194.117:/root/ai-mindmap`, preserves server `.env`
and data through `.rsyncignore`, then runs `make live-deploy` and
`make live-status` on the server.

See [Deployment](docs/deployment.md) for the full server checklist, monitoring,
packaging, and backup commands.

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

- [Git workflow](docs/git-workflow.md)
- [Product requirements](docs/product-requirements.md)
- [Current product spec and progress tracker](docs/context-canvas-product-spec.md)
- [API documentation](docs/api.md)
- [MCP documentation](docs/mcp.md)
- [Persistence and local operations](docs/persistence.md)
- [Task working sources](docs/task-working-sources.md)

## Environment

```sh
PORT=8787
CONTEXT_CANVAS_DATABASE_URL=
CONTEXT_CANVAS_DB_PATH=
CONTEXT_CANVAS_UPLOAD_DIR=
CONTEXT_CANVAS_MAX_UPLOAD_BYTES=10485760
CONTEXT_CANVAS_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_MCP_URL=http://127.0.0.1:8790/mcp
SITE_ADDRESS=:8080
DEMO_SITE_ADDRESS=
APP_PORT=8080
HTTP_PORT=80
HTTPS_PORT=443
DOCKER_CONTEXT_CANVAS_CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
DOCKER_VITE_API_BASE_URL=
DOCKER_VITE_MCP_URL=/mcp
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
CONTEXT_CANVAS_DISABLE_CHANGE_AI=
ATLASSIAN_URL=
ATLASSIAN_EMAIL=
ATLASSIAN_TOKEN=
```

Chat and analysis always use OpenAI. Contract change impact analysis uses OpenAI when available; tests can set `CONTEXT_CANVAS_DISABLE_CHANGE_AI=1` to use deterministic offline impact rules.

## Git Workflow

The canonical remote is `git@github.com:michael-nyfulcrum/ai-mindmap.git`.
Use `dev` for ongoing work and keep `main` as the stable branch that receives
occasional merges from `dev`. No GitHub Actions are required for this repo; run
the relevant `make` checks locally before pushing.

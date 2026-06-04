# ai-mindmap

ai-mindmap is the single source of truth that finally closes the gap between business intent and engineering execution. Teams map their entire project — contracts, requirements, decisions, and source references — onto a living, collaborative canvas that both humans and AI agents read from in real time. Every change is tracked, every decision is logged, and when requirements evolve the platform automatically surfaces exactly which parts of the project are impacted, so nothing slips through the cracks and no one is working off stale context. Business and tech stay locked in through a shared visual layer that replaces scattered docs, lost Slack threads, and tribal knowledge — and the built-in MCP server plugs directly into any AI coding assistant, giving developers autonomous, context-aware AI that actually understands the project rather than guessing from the codebase. The result is tighter alignment, faster iteration, and a team that ships with confidence because everyone — human and AI — is always working from the same ground truth.

## Live Demo

**[https://7865420.xyz](https://7865420.xyz)**

The live demo starts clean; create a project from a template. No login required.

## What's Working

- [x] Visual canvas — create and connect contracts, requirements, source references, notes, links, and images
- [x] Project templates — start from a real-world example in one click
- [x] Autosave — every canvas change persists to the database automatically
- [x] Change tracking — full version history on contracts and requirements with before/after diffs
- [x] AI impact analysis — when a requirement changes, only the genuinely affected nodes are flagged
- [x] Impact badges — "Needs update", "Outdated", and "Conflict" surface directly on canvas nodes
- [x] MCP server — any MCP-capable coding agent can read the full project context and write back changes
- [x] Spec-driven development — turn a node into a GitHub Spec Kit feature spec via the "Create spec" AI action; coding agents fetch and build it with the `get_canvas_spec` MCP tool
- [x] AI chat — ask questions against the saved canvas and get cited answers
- [x] Developer handoff panel — one-click MCP endpoint and setup instructions for coding agents
- [x] Audit trail — every node change records who made it and when, including agent-originated writes

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

The demo stack is intentionally vendor-neutral: Vite/React, FastAPI, FastMCP,
SQLite, Docker Compose, and Caddy. It does not require Vercel, Supabase, or a
managed database account; the same setup runs locally or on a basic Linux
server. See [Demo](docs/demo.md#demo-positioning) for the customer-facing
positioning.

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

- [Demo](docs/demo.md)
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
CONTEXT_CANVAS_SEED_DEMO=0
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
CONTEXT_CANVAS_DISABLE_SPEC_AI=
ATLASSIAN_URL=
ATLASSIAN_EMAIL=
ATLASSIAN_TOKEN=
```

Chat and analysis always use OpenAI. Contract change impact analysis and spec generation use OpenAI when available; tests can set `CONTEXT_CANVAS_DISABLE_CHANGE_AI=1` and `CONTEXT_CANVAS_DISABLE_SPEC_AI=1` to use the deterministic offline paths.

## Git Workflow

The canonical remote is `git@github.com:michael-nyfulcrum/ai-mindmap.git`.
Use `dev` for ongoing work and keep `main` as the stable branch that receives
occasional merges from `dev`. No GitHub Actions are required for this repo; run
the relevant `make` checks locally before pushing.

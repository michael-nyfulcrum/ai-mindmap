# Agent Notes

Use this guide before changing the repo.

## Project Shape

- `apps/web`: Vite React frontend.
- `services/api`: FastAPI app and backend e2e tests.
- `services/mcp`: FastMCP server that reads/writes the same canvas data.
- `infra/caddy`: Caddy static web and reverse-proxy config.
- `compose.yml` and `compose.demo.yml`: single-server Docker/live stack.

## Local Setup

- Run `make doctor` before assuming the toolchain is ready.
- Run `make setup` for a fresh laptop checkout; it creates `.env` only if missing.
- Use `make env-demo` on a live/demo server to start from `.env.demo.example`.
- The canonical remote is `git@github.com:michael-nyfulcrum/ai-mindmap.git`.
- Use `dev` as the normal working branch; `main` is the stable branch promoted from `dev`.
- Update the live server with `rsync`, not `git pull`; use `make server-rsync` or `make server-deploy`.

## Verification

Prefer the narrowest relevant check first, then broader checks when touching shared surfaces.

- Backend/API or MCP behavior: `make test-e2e`.
- Frontend or TypeScript changes: `make build` and `make lint`.
- Docker/Caddy local changes: `make compose-config`, `make docker-up`, and `make docker-smoke`.
- Live server readiness: `make live-check`, `make live-config`, and `make live-preflight`.
- Live deployment smoke/monitoring: `make live-smoke` and `make live-status`.
- Release/package handoff: `make release-check`.
- Always run `git diff --check` before committing.

The frontend build currently emits warnings about `lottie-web` eval usage and large chunks; those warnings are known and do not fail the build.

## Deployment Notes

- Keep the deployment intentionally basic: one host, Docker Compose, Caddy, SQLite/uploads in the shared Docker volume.
- Public live/demo deploys should set `DEMO_SITE_ADDRESS`, `OPENAI_API_KEY`, and `DOCKER_CONTEXT_CANVAS_CORS_ORIGINS=https://<domain>`.
- `DEMO_SITE_ADDRESS` must be a bare hostname, for example `7865420.xyz`, not `https://7865420.xyz`.
- Run `make live-deploy` on the target server or through a Docker context that points at it; `make live-preflight` blocks when DNS does not point at the current host.
- The current server target is `root@143.198.194.117:/root/ai-mindmap`; `.rsyncignore` preserves `.env`, SQLite, uploads, dependencies, and build artifacts.
- Caddy serves the web app and proxies `/api`, `/health`, and `/mcp`.
- Use `make live-backup` for a SQLite-only backup and `make live-backup-data` for SQLite plus uploads on live deployments.

## Do Not Touch Casually

- Do not commit `.env`, SQLite files, uploads, `dist/`, `.venv`, `.uv-cache`, or `node_modules`.
- Do not rewrite the deployment into Kubernetes, ECS, Terraform, or managed databases unless explicitly asked.
- Do not change public API behavior without backend e2e coverage.

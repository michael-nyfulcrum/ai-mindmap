# Agent Notes

Use this guide before changing the repo.

## Project Shape

- `apps/web`: Vite React frontend.
- `services/api`: FastAPI app and backend e2e tests.
- `services/mcp`: FastMCP server that reads/writes the same canvas data.
- `infra/caddy`: Caddy static web and reverse-proxy config.
- `compose.yml` and `compose.demo.yml`: single-server Docker demo stack.

## Local Setup

- Run `make doctor` before assuming the toolchain is ready.
- Run `make setup` for a fresh laptop checkout; it creates `.env` only if missing.
- Use `make env-demo` on a demo server to start from `.env.demo.example`.

## Verification

Prefer the narrowest relevant check first, then broader checks when touching shared surfaces.

- Backend/API or MCP behavior: `make test-e2e`.
- Frontend or TypeScript changes: `make build` and `make lint`.
- Docker/Caddy/deployment changes: `make compose-config`, `make docker-up`, and `make docker-smoke`.
- Demo server readiness: `make demo-check`, `make demo-config`, and `make server-preflight`.
- Release/package handoff: `make release-check`.
- Always run `git diff --check` before committing.

The frontend build currently emits warnings about `lottie-web` eval usage and large chunks; those warnings are known and do not fail the build.

## Deployment Notes

- Keep the deployment intentionally basic: one host, Docker Compose, Caddy, SQLite/uploads in the shared Docker volume.
- Public demo deploys should set `DEMO_SITE_ADDRESS`, `OPENAI_API_KEY`, and `DOCKER_CONTEXT_CANVAS_CORS_ORIGINS=https://<domain>`.
- Caddy serves the web app and proxies `/api`, `/health`, and `/mcp`.
- Use `make docker-backup` for a SQLite-only backup and `make docker-backup-data` for SQLite plus uploads.

## Do Not Touch Casually

- Do not commit `.env`, SQLite files, uploads, `dist/`, `.venv`, `.uv-cache`, or `node_modules`.
- Do not rewrite the deployment into Kubernetes, ECS, Terraform, or managed databases unless explicitly asked.
- Do not change public API behavior without backend e2e coverage.

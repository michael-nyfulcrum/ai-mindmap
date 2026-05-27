# Demo Deployment

This repo is prepared for a basic single-server demo deployment with Docker
Compose and Caddy. The setup runs three containers:

- `api`: FastAPI on port `8787`
- `mcp`: FastMCP on port `8790`
- `caddy`: static Vite web app plus reverse proxy for `/api`, `/health`, and `/mcp`

SQLite and uploads live in the `context_canvas_data` Docker volume at `/data`.

## Local Docker Demo

```sh
cp .env.example .env
make doctor
make compose-config
make docker-up
make docker-smoke
```

Open `http://127.0.0.1:8080`.

Use `make docker-logs` for logs and `make docker-down` to stop the stack.

## Dedicated Server Demo

On a fresh EC2 or DigitalOcean Ubuntu server:

1. Install Docker and the Compose plugin.
2. Point a DNS `A` record at the server.
3. Open inbound TCP ports `80` and `443`.
4. Copy this repo or a package from `make package` onto the server.
5. Create `.env` from `.env.demo.example` and set at least:

```sh
cp .env.demo.example .env
DEMO_SITE_ADDRESS=demo.example.com
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
DOCKER_CONTEXT_CANVAS_CORS_ORIGINS=https://demo.example.com
```

Then run:

```sh
make demo-check
make demo-config
make server-preflight
make demo-up
make demo-smoke
```

Caddy will request and renew HTTPS certificates automatically when
`DEMO_SITE_ADDRESS` is a real domain reachable on ports `80` and `443`.

## Fresh Laptop Setup

Use this path when setting up the repo from another machine:

```sh
git clone <repo-url>
cd ai-mindmap
make doctor
make setup
make lint
make build
make test-e2e
make docker-up
make docker-smoke
```

`make setup` creates `.env` from `.env.example` only when `.env` does not
already exist. Keep real API keys and server-specific values in `.env`.

## Fresh Ubuntu Server Bootstrap

On a new EC2 or DigitalOcean Ubuntu host, copy the repo first, then run:

```sh
make server-bootstrap
```

The bootstrap installs Docker Engine, the Docker Compose plugin, and `make`.
It adds the SSH user to the `docker` group when run with sudo; log out and back
in before running Docker without sudo.

## Demo Server Runbook

For a package-based deploy:

```sh
mkdir -p context-canvas
tar -xzf context-canvas-demo-*.tar.gz -C context-canvas
cd context-canvas
make env-demo
```

Edit `.env`, replacing `demo.example.com` with the real domain and adding
`OPENAI_API_KEY`. Keep `DOCKER_CONTEXT_CANVAS_CORS_ORIGINS` aligned with the
same `https://<domain>` value. Then run:

```sh
make server-preflight
make demo-up
make demo-smoke
```

Operational checks:

```sh
make docker-ps
make docker-logs
make docker-health BASE_URL=https://demo.example.com
make docker-backup
make docker-backup-data
```

`make docker-backup` exports only SQLite. `make docker-backup-data` creates a
tarball containing a SQLite backup plus uploads.

## Packaging

```sh
make package
```

The archive is written under `dist/packages/` and excludes local dependencies,
virtualenvs, SQLite files, uploads, and `.env` files.

Verify the newest package with:

```sh
make package-check
```

Run `make release-check` before packaging a demo handoff. It validates the
toolchain, Compose config, lint, build, backend e2e tests, package creation,
and package contents.

## Data Operations

The default demo data volume is named `context-canvas_context_canvas_data`.

```sh
make docker-volume-list
make docker-backup
make docker-backup-data
```

`make docker-backup` writes a timestamped SQLite backup under `dist/backups/`.
`make docker-backup-data` writes a timestamped archive with both SQLite and
uploads under `dist/backups/`.

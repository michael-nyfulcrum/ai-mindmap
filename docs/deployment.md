# Deployment

This repo is prepared for a basic single-server deployment with Docker
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

## Live Single-Server Deployment

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

For the current live domain, use:

```sh
DEMO_SITE_ADDRESS=7865420.xyz
DOCKER_CONTEXT_CANVAS_CORS_ORIGINS=https://7865420.xyz
```

`DEMO_SITE_ADDRESS` must be a bare hostname such as `7865420.xyz`, not
`https://7865420.xyz`. Caddy handles HTTPS for that host.

Leave `DOCKER_VITE_API_BASE_URL` empty for normal single-domain deploys. The
web app will call the same origin through Caddy (`/api` and `/mcp`), which
avoids browsers trying to reach local services on a user's device. Set
`DOCKER_VITE_API_BASE_URL` only when intentionally hosting the API on a separate
public origin. `make live-check` rejects localhost or `127.0.0.1` values for
`DOCKER_VITE_API_BASE_URL` and `DOCKER_VITE_MCP_URL` during live deploys.

Then run:

```sh
make live-deploy
```

Run `make live-deploy` on the target server itself, or through a Docker context
that points at that server. `make live-preflight` compares the domain DNS
records with the server's local/public IPs and stops if the domain points
somewhere else. Set `SKIP_DNS_LOCAL_CHECK=1` only for an intentional proxy,
load balancer, or unusual NAT setup.

Caddy will request and renew HTTPS certificates automatically when
`DEMO_SITE_ADDRESS` is a real domain reachable on ports `80` and `443`.
The Caddy config serves hashed Vite assets with long immutable caching and
serves the HTML shell with `Cache-Control: no-cache`, so normal refreshes pick
up newly deployed bundles without requiring users to clear browser cache.

`make live-deploy` runs the deployment flow:

```sh
make live-preflight
make live-up
make live-smoke
```

The older `demo-*` targets remain as compatibility aliases for existing scripts,
but new server work should use `live-*`.

## Rsync-Based Server Update

The live server is updated with `rsync`, not `git pull`. The default Makefile
target is:

```sh
make server-deploy
```

By default this syncs the current checkout to:

```text
root@143.198.194.117:/root/ai-mindmap
```

Then it runs `make live-deploy` and `make live-status` on the server. Override
the destination when needed:

```sh
make server-deploy SERVER_HOST=root@143.198.194.117 SERVER_PATH=/root/ai-mindmap
```

The rsync command uses `.rsyncignore`, which preserves server-local `.env`,
SQLite files, uploads, dependencies, virtualenvs, and build artifacts. Keep
server-specific secrets and deployment values in the server `.env`.

Use the lower-level sync command when you want to copy files without deploying:

```sh
make server-rsync
```

## Deployment Command Log

These are the commands used for a live deploy from a server checkout:

```sh
make doctor
make live-check
make live-config
make live-preflight
make live-up
make live-smoke
make live-status
```

If the server is fresh and does not have Docker yet, run this once first:

```sh
make server-bootstrap
```

## Fresh Laptop Setup

Use this path when setting up the repo from another machine:

```sh
git clone git@github.com:michael-nyfulcrum/ai-mindmap.git
cd ai-mindmap
git checkout dev
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

## Server Runbook

For a package-based deploy:

```sh
mkdir -p context-canvas
tar -xzf context-canvas-demo-*.tar.gz -C context-canvas
cd context-canvas
make env-demo
```

Edit `.env`, replacing `demo.example.com` with the real bare domain and adding
`OPENAI_API_KEY`. Keep `DOCKER_CONTEXT_CANVAS_CORS_ORIGINS` aligned with the
same `https://<domain>` value. Then run:

```sh
make live-deploy
```

Operational checks:

```sh
make live-status
make live-health
make live-logs
make live-backup
make live-backup-data
```

`make live-status` prints the live URL health response, container state, disk
usage, Docker volumes, and recent logs. `make live-logs` follows Caddy/API/MCP
logs, including Caddy access logs.

`make live-backup` exports only SQLite. `make live-backup-data` creates a
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

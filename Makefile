PNPM ?= pnpm
UV ?= uv
COMPOSE ?= docker compose
COMPOSE_FILES ?= -f compose.yml
DEMO_COMPOSE_FILES ?= -f compose.yml -f compose.demo.yml
APP_PORT ?= 8080
BASE_URL ?= http://127.0.0.1:$(APP_PORT)
DEMO_BASE_URL ?= https://$(DEMO_SITE_ADDRESS)

.DEFAULT_GOAL := help

.PHONY: help doctor install setup env env-demo dev dev-api dev-web dev-mcp build lint test-e2e test-backend reset-db clean db-path compose-config docker-build docker-up docker-down docker-restart docker-logs docker-ps docker-smoke docker-health docker-shell-api docker-volume-list docker-backup docker-backup-data docker-clean demo-check demo-config demo-up demo-down demo-smoke server-preflight package package-check release-check server-bootstrap

help:
	@printf "Context Canvas tasks\n\n"
	@printf "Local:\n"
	@printf "  make doctor         Verify required local tools are installed\n"
	@printf "  make setup          Install JS/Python deps and create .env if missing\n"
	@printf "  make env-demo       Create .env from .env.demo.example if missing\n"
	@printf "  make dev            Run API and web locally\n"
	@printf "  make dev-api        Run FastAPI locally\n"
	@printf "  make dev-web        Run Vite locally\n"
	@printf "  make dev-mcp        Run MCP locally\n"
	@printf "  make build          Build all workspaces\n"
	@printf "  make lint           Run lint/compile checks\n"
	@printf "  make test-e2e       Run backend e2e tests\n\n"
	@printf "Docker/demo:\n"
	@printf "  make compose-config Validate local Docker Compose config\n"
	@printf "  make docker-up      Build and start local Docker demo on APP_PORT=8080\n"
	@printf "  make docker-smoke   Check web, health, and projects endpoints\n"
	@printf "  make docker-logs    Follow container logs\n"
	@printf "  make demo-check     Validate required demo deployment env\n"
	@printf "  make demo-config    Validate dedicated-server Compose config\n"
	@printf "  make server-preflight Check server DNS, ports, Docker, and demo config\n"
	@printf "  make demo-up        Start Caddy with DEMO_SITE_ADDRESS for 80/443\n"
	@printf "  make demo-smoke     Check deployed demo BASE_URL=https://DEMO_SITE_ADDRESS\n"
	@printf "  make docker-backup  Copy SQLite DB from the data volume\n"
	@printf "  make docker-backup-data Archive SQLite backup plus uploads\n"
	@printf "  make release-check  Run lint, build, and backend e2e tests\n"
	@printf "  make package        Create deployable source archive\n"
	@printf "  make package-check  Verify release archive contents\n"
	@printf "  make server-bootstrap Install Docker on a fresh Ubuntu server\n"

doctor:
	./scripts/env-check.sh local

install:
	$(PNPM) install
	$(UV) sync

setup: env install

env:
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env from .env.example"; else echo ".env already exists"; fi

env-demo:
	@if [ ! -f .env ]; then cp .env.demo.example .env && echo "Created .env from .env.demo.example"; else echo ".env already exists"; fi

dev:
	$(PNPM) dev

dev-api:
	$(PNPM) dev:api

dev-web:
	$(PNPM) dev:web

dev-mcp:
	UV_CACHE_DIR=.uv-cache PYTHONPATH=services/mcp $(UV) run python -m context_canvas_mcp.main

build:
	$(PNPM) build

lint:
	$(PNPM) lint

test-e2e:
	$(PNPM) test:e2e

test-backend:
	$(PNPM) test:e2e

reset-db:
	rm -f services/api/context-canvas.sqlite

db-path:
	@echo services/api/context-canvas.sqlite

clean:
	rm -rf node_modules .venv apps/web/dist services/api/uploads

compose-config:
	$(COMPOSE) $(COMPOSE_FILES) --env-file .env.example config >/dev/null

docker-build:
	$(COMPOSE) $(COMPOSE_FILES) build

docker-up:
	$(COMPOSE) $(COMPOSE_FILES) up -d --build

docker-down:
	$(COMPOSE) $(COMPOSE_FILES) down

docker-restart:
	$(COMPOSE) $(COMPOSE_FILES) restart

docker-logs:
	$(COMPOSE) $(COMPOSE_FILES) logs -f --tail=200

docker-ps:
	$(COMPOSE) $(COMPOSE_FILES) ps

docker-health:
	curl -fsS "$(BASE_URL)/health"

docker-smoke:
	BASE_URL="$(BASE_URL)" APP_PORT="$(APP_PORT)" ./scripts/docker-smoke.sh

docker-shell-api:
	$(COMPOSE) $(COMPOSE_FILES) exec api sh

docker-volume-list:
	docker volume ls --filter label=com.docker.compose.project=context-canvas

docker-backup:
	@mkdir -p dist/backups
	$(COMPOSE) $(COMPOSE_FILES) exec -T api .venv/bin/python -c 'import pathlib, sqlite3, sys, tempfile; source = pathlib.Path("/data/context-canvas.sqlite"); source.exists() or sys.exit("missing /data/context-canvas.sqlite"); tmp = tempfile.NamedTemporaryFile(delete=False); tmp.close(); src = sqlite3.connect(source); dst = sqlite3.connect(tmp.name); src.backup(dst); dst.close(); src.close(); sys.stdout.buffer.write(pathlib.Path(tmp.name).read_bytes()); pathlib.Path(tmp.name).unlink(missing_ok=True)' > dist/backups/context-canvas-$$(date -u +%Y%m%dT%H%M%SZ).sqlite

docker-backup-data:
	./scripts/docker-backup-data.sh

docker-clean:
	$(COMPOSE) $(COMPOSE_FILES) down --remove-orphans

demo-check:
	./scripts/env-check.sh demo

demo-config:
	$(COMPOSE) $(DEMO_COMPOSE_FILES) config >/dev/null

demo-up: demo-check demo-config
	$(COMPOSE) $(DEMO_COMPOSE_FILES) up -d --build

demo-down:
	$(COMPOSE) $(DEMO_COMPOSE_FILES) down

demo-smoke: demo-check
	@set -a; [ ! -f .env ] || . ./.env; set +a; BASE_URL="$${BASE_URL:-https://$${DEMO_SITE_ADDRESS}}" ./scripts/docker-smoke.sh

server-preflight:
	./scripts/server-preflight.sh

package:
	./scripts/package-release.sh

package-check:
	./scripts/verify-package.sh

release-check: doctor compose-config lint build test-e2e package package-check

server-bootstrap:
	./scripts/install-server-deps.sh

PNPM ?= pnpm
UV ?= uv
COMPOSE ?= docker compose
RSYNC ?= rsync
COMPOSE_FILES ?= -f compose.yml
LIVE_COMPOSE_FILES ?= -f compose.yml -f compose.demo.yml
DEMO_COMPOSE_FILES ?= $(LIVE_COMPOSE_FILES)
APP_PORT ?= 8080
BASE_URL ?= http://127.0.0.1:$(APP_PORT)
LIVE_BASE_URL ?= https://$(DEMO_SITE_ADDRESS)
DEMO_BASE_URL ?= $(LIVE_BASE_URL)
SERVER_HOST ?= root@143.198.194.117
SERVER_PATH ?= /root/ai-mindmap

.DEFAULT_GOAL := help

.PHONY: help doctor install setup env env-demo dev dev-api dev-web dev-mcp build lint test-e2e test-backend reset-db clean db-path compose-config docker-build docker-up docker-down docker-restart docker-logs docker-ps docker-smoke docker-health docker-shell-api docker-volume-list docker-backup docker-backup-data docker-clean live-check live-config live-preflight live-up live-down live-restart live-smoke live-health live-status live-logs live-backup live-backup-data live-deploy demo-check demo-config demo-up demo-down demo-smoke demo-reset server-preflight server-rsync server-deploy server-reset package package-check release-check server-bootstrap

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
	@printf "Docker/local:\n"
	@printf "  make compose-config Validate local Docker Compose config\n"
	@printf "  make docker-up      Build and start local Docker demo on APP_PORT=8080\n"
	@printf "  make docker-smoke   Check web, health, and projects endpoints\n"
	@printf "  make docker-logs    Follow container logs\n"
	@printf "\nLive deployment:\n"
	@printf "  make live-check     Validate required live deployment env\n"
	@printf "  make live-config    Validate live Docker Compose config\n"
	@printf "  make live-preflight Check DNS, ports, Docker, and live config\n"
	@printf "  make live-up        Build and start live stack on 80/443\n"
	@printf "  make live-smoke     Check deployed live site\n"
	@printf "  make live-deploy    Run preflight, start live stack, then smoke-test it\n"
	@printf "  make live-status    Show health, containers, disk, volumes, and recent logs\n"
	@printf "  make live-logs      Follow live container logs\n"
	@printf "  make live-down      Stop the live stack\n"
	@printf "  make demo-reset     Back up, then wipe live data to an empty project list\n"
	@printf "  make server-rsync   Copy this checkout to SERVER_HOST:SERVER_PATH\n"
	@printf "  make server-deploy  Rsync to server, then run live deploy and status there\n"
	@printf "  make server-reset   Reset the live demo DB on SERVER_HOST (backs up first)\n"
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

live-check:
	./scripts/env-check.sh live

live-config:
	$(COMPOSE) $(LIVE_COMPOSE_FILES) config >/dev/null

live-preflight:
	./scripts/server-preflight.sh

live-up: live-check live-config
	$(COMPOSE) $(LIVE_COMPOSE_FILES) up -d --build

live-down:
	$(COMPOSE) $(LIVE_COMPOSE_FILES) down

live-restart:
	$(COMPOSE) $(LIVE_COMPOSE_FILES) restart

live-smoke: live-check
	@set -a; [ ! -f .env ] || . ./.env; set +a; BASE_URL="$${BASE_URL:-https://$${DEMO_SITE_ADDRESS}}" ./scripts/docker-smoke.sh

live-health: live-check
	@set -a; [ ! -f .env ] || . ./.env; set +a; curl -fsS "$${BASE_URL:-https://$${DEMO_SITE_ADDRESS}}/health"

live-status: live-check
	COMPOSE="$(COMPOSE)" COMPOSE_FILES="$(LIVE_COMPOSE_FILES)" ./scripts/live-status.sh

live-logs:
	$(COMPOSE) $(LIVE_COMPOSE_FILES) logs -f --tail=200

live-backup:
	$(MAKE) docker-backup COMPOSE_FILES="$(LIVE_COMPOSE_FILES)"

live-backup-data:
	COMPOSE="$(COMPOSE)" COMPOSE_FILES="$(LIVE_COMPOSE_FILES)" ./scripts/docker-backup-data.sh

live-deploy: live-preflight live-up live-smoke

demo-check: live-check

demo-config: live-config

demo-up: live-up

demo-down: live-down

demo-smoke: live-smoke

demo-reset: live-check
	COMPOSE="$(COMPOSE)" COMPOSE_FILES="$(LIVE_COMPOSE_FILES)" ./scripts/demo-reset.sh

server-preflight:
	./scripts/server-preflight.sh

server-rsync:
	$(RSYNC) -az --delete --exclude-from=.rsyncignore ./ $(SERVER_HOST):$(SERVER_PATH)/

server-deploy: server-rsync
	ssh $(SERVER_HOST) 'cd $(SERVER_PATH) && make live-deploy && make live-status'

server-reset:
	ssh $(SERVER_HOST) 'cd $(SERVER_PATH) && FORCE=1 make demo-reset'

package:
	./scripts/package-release.sh

package-check:
	./scripts/verify-package.sh

release-check: doctor compose-config lint build test-e2e package package-check

server-bootstrap:
	./scripts/install-server-deps.sh

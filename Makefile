PNPM ?= pnpm
UV ?= uv

.PHONY: install dev dev-api dev-web dev-mcp build lint test-e2e test-backend reset-db clean db-path

install:
	$(PNPM) install
	$(UV) sync

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

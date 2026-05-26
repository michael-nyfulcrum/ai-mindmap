# Persistence And Local Operations

## SQLite Database

The API stores data in SQLite.

Default path:

```text
services/api/context-canvas.sqlite
```

Override with:

```sh
CONTEXT_CANVAS_DATABASE_URL=sqlite:///absolute/or/relative/path.sqlite
```

For local development, leaving `CONTEXT_CANVAS_DATABASE_URL` unset is recommended so the API uses the stable package-local default above.

## Stored Data

Tables:

- `projects`
- `canvas_nodes`
- `canvas_edges`
- `uploads`
- `analysis_runs`
- `chat_threads`
- `chat_messages`
- `contract_change_versions`
- `schema_migrations`

Canvas saves are transactional. A save updates the project row, replaces the project's node rows, and replaces the project's edge rows in one transaction.

Identical whole-canvas saves are idempotent. If the submitted project metadata, viewport, nodes, and edges match the stored canvas, the API returns the existing snapshot without rewriting SQLite just to advance `updatedAt`.

Semantic changes to `project_contract` and `requirement` nodes write changelog-style rows to `contract_change_versions`. Layout-only changes do not create versions. Requirement write-back through MCP also records audit metadata and version history with `context_canvas_mcp` as the actor.

## Schema Migration

The API runs table-shape migrations on startup and records applied schema milestones in `schema_migrations`. It currently migrates these older local MVP table shapes:

- `canvas_nodes` rows that stored `type`, `title`, `position_json`, and `data_json`.
- `canvas_edges` rows that stored `relationship`, `label`, and `edge_json`.
- `uploads` rows that stored `url` instead of `file_path`.
- `analysis_runs` rows that stored `request_json` instead of `question`.

This is enough for existing local SQLite databases created by the earlier MVP backend. Future schema work should add new rows to `schema_migrations` for material schema changes.

Current recorded schema milestone:

- `2026_05_26_contract_change_versions`

## Upload Files

Default path:

```text
services/api/uploads
```

Override with:

```sh
CONTEXT_CANVAS_UPLOAD_DIR=./path/to/uploads
CONTEXT_CANVAS_MAX_UPLOAD_BYTES=10485760
```

For local development, leaving `CONTEXT_CANVAS_UPLOAD_DIR` unset stores files in the default package-local uploads directory. `CONTEXT_CANVAS_MAX_UPLOAD_BYTES` defaults to 10 MiB.

## Seed Data

On first API startup, the database is seeded with:

```text
GGR-5534 Help Center Change Request
```

The demo canvas is intentionally a realistic change-request contract example. It includes Jira, Confluence, and Figma references as manually stored citations.

## Proving Persistence

The backend e2e suite proves persistence by:

- creating a project
- saving nodes to SQLite
- loading the canvas back
- closing the API
- reopening the same SQLite file
- loading the same saved canvas again
- analyzing the saved SQLite canvas through `/analyze`
- sending chat messages that analyze the current saved canvas
- migrating a legacy SQLite schema and using it through the API

Run:

```sh
make test-e2e
```

## Reset Local Data

```sh
make reset-db
```

Then restart the API:

```sh
make dev
```

## Common Commands

```sh
make install
make dev
make build
make lint
make test-e2e
make reset-db
```

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(slots=True)
class AtlassianSettings:
    url: str
    email: str | None
    token: str | None

    @property
    def is_configured(self) -> bool:
        return bool(self.url and self.email and self.token)

    @property
    def auth_mode(self) -> str:
        return "basic" if self.is_configured else "unconfigured"

    @property
    def scope_description(self) -> str:
        return "all readable Atlassian content"


def load_atlassian_settings() -> AtlassianSettings:
    return AtlassianSettings(
        url=os.getenv("ATLASSIAN_URL", "").strip(),
        email=os.getenv("ATLASSIAN_EMAIL", "").strip() or None,
        token=os.getenv("ATLASSIAN_TOKEN", "").strip() or None,
    )


@dataclass(slots=True)
class CanvasDatabaseSettings:
    path: Path


def load_canvas_database_settings() -> CanvasDatabaseSettings:
    return CanvasDatabaseSettings(path=_resolve_canvas_db_path())


def _resolve_canvas_db_path() -> Path:
    # Mirror the API's resolution (context_canvas_api.db.database_path) so the
    # MCP server and the API always open the same SQLite file. The shared
    # Docker stack sets CONTEXT_CANVAS_DATABASE_URL, not CONTEXT_CANVAS_DB_PATH.
    database_url = os.getenv("CONTEXT_CANVAS_DATABASE_URL", "").strip()
    if database_url:
        if database_url.startswith("sqlite:///"):
            return Path(database_url.removeprefix("sqlite:///")).expanduser()
        return Path(database_url).expanduser()
    configured = os.getenv("CONTEXT_CANVAS_DB_PATH", "").strip()
    if configured:
        return Path(configured).expanduser()
    return Path(__file__).resolve().parents[2] / "api" / "context-canvas.sqlite"

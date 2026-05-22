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
    configured = os.getenv("CONTEXT_CANVAS_DB_PATH", "").strip()
    default_path = Path(__file__).resolve().parents[2] / "api" / "context-canvas.sqlite"
    return CanvasDatabaseSettings(path=Path(configured).expanduser() if configured else default_path)

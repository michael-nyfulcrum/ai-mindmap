from __future__ import annotations

import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv


def load_project_dotenv(dotenv_path: str | Path | None = None) -> str | None:
    """Load local environment values without overriding exported variables."""
    resolved_path = str(dotenv_path) if dotenv_path is not None else find_dotenv(usecwd=True)
    if not resolved_path:
        fallback = _repo_root_env()
        if not fallback.is_file():
            return None
        resolved_path = str(fallback)

    load_dotenv(resolved_path, override=False)
    return resolved_path


def _repo_root_env() -> Path:
    return Path(__file__).resolve().parents[3] / ".env"


def ai_configuration_status() -> dict[str, str | bool]:
    return {
        "model": "gpt-4.1-mini",
        "openaiConfigured": bool(os.getenv("OPENAI_API_KEY", "").strip()),
    }

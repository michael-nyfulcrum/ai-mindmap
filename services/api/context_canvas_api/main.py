from __future__ import annotations

import logging
import os
from pathlib import Path

import uvicorn

from context_canvas_api.env import load_project_dotenv


def main() -> None:
    load_project_dotenv()
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    in_docker = Path("/data").is_dir()
    uvicorn.run(
        "context_canvas_api.app:app",
        host="0.0.0.0" if in_docker else "127.0.0.1",
        port=8787,
        reload=not in_docker,
    )


if __name__ == "__main__":
    main()

from __future__ import annotations

import os

import uvicorn

from context_canvas_api.env import load_project_dotenv


def main() -> None:
    load_project_dotenv()
    uvicorn.run(
        "context_canvas_api.app:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8787")),
        reload=os.getenv("RELOAD", "1") != "0",
    )


if __name__ == "__main__":
    main()

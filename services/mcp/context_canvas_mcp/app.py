from __future__ import annotations

from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import PlainTextResponse

from context_canvas_mcp.registry import register_capabilities

SERVER_NAME = "Context Canvas MCP"
SERVER_VERSION = "0.1.0"


def create_app() -> FastMCP:
    app = FastMCP(
        name=SERVER_NAME,
        version=SERVER_VERSION,
        on_duplicate="error",
        instructions=(
            "Context Canvas MCP server. Use this server to read saved SQLite requirements "
            "canvas context before coding tasks and to add or update requirement/source "
            "nodes when implementation decisions change. The FastAPI product API and "
            "SQLite database remain the system of record."
        ),
    )
    register_capabilities(app)
    _register_health_route(app)
    return app


def _register_health_route(app: FastMCP) -> None:
    @app.custom_route("/health", methods=["GET"])
    async def health_check(_: Request) -> PlainTextResponse:
        return PlainTextResponse("OK")


app = create_app()

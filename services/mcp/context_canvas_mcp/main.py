from __future__ import annotations

import argparse
from collections.abc import Sequence

from context_canvas_mcp.app import app


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the Context Canvas FastMCP server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8790)
    parser.add_argument("--path", default="/mcp")
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    try:
        app.run(transport="streamable-http", host=args.host, port=args.port, path=args.path)
    except KeyboardInterrupt:
        return


if __name__ == "__main__":
    main()

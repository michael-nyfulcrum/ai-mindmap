FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV HOST=0.0.0.0 \
    PORT=8787 \
    RELOAD=0 \
    PYTHONPATH=/app/services/api:/app/services/mcp \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    CONTEXT_CANVAS_DATABASE_URL=sqlite:////data/context-canvas.sqlite \
    CONTEXT_CANVAS_UPLOAD_DIR=/data/uploads

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY services/api ./services/api
COPY services/mcp ./services/mcp

EXPOSE 8787 8790

CMD ["uv", "run", "--no-sync", "python", "-m", "context_canvas_api.main"]

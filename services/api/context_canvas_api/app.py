from __future__ import annotations

import base64
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ValidationError, field_validator

from context_canvas_api.analyzer import AIProviderError, analyze_canvas, chat_with_canvas
from context_canvas_api.db import AppDatabase, database_path
from context_canvas_api.generator import generate_canvas
from context_canvas_api.suggester import suggest_canvas_changes
from context_canvas_api.demo import utc_now
from context_canvas_api.env import ai_configuration_status, load_project_dotenv
from context_canvas_api.models import CanvasSnapshot
from context_canvas_api.source_fetcher import fetch_source, infer_source_type, search_source_context
from context_canvas_api.spec_kit import build_feature_spec

load_project_dotenv()

logger = logging.getLogger(__name__)


class CreateProjectRequest(BaseModel):
    name: str = Field(max_length=300)
    description: str | None = Field(default=None, max_length=4000)
    viewport: dict[str, Any] | None = None
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip() or "Untitled canvas"


class GenerateProjectRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)

    @field_validator("prompt")
    @classmethod
    def normalize_prompt(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Prompt is required")
        return normalized


class SuggestRequest(BaseModel):
    targetNodeId: str | None = Field(default=None, max_length=128)
    instruction: str | None = Field(default=None, max_length=8000)

    @field_validator("targetNodeId", "instruction")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class SpecRequest(BaseModel):
    focusNodeId: str | None = Field(default=None, max_length=128)
    instruction: str | None = Field(default=None, max_length=2000)

    @field_validator("focusNodeId", "instruction")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class AnalyzeRequest(BaseModel):
    question: str = Field(min_length=1, max_length=8000)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Question is required")
        return normalized


class UploadRequest(BaseModel):
    projectId: str = Field(max_length=128)
    filename: str = Field(max_length=300)
    contentType: str = Field(max_length=200)
    dataUrl: str

    @field_validator("projectId", "filename", "contentType", "dataUrl")
    @classmethod
    def require_non_empty(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value is required")
        return normalized


class ChatRequest(BaseModel):
    title: str = "New chat"

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        return value.strip() or "New chat"


class ChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=16000)

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Message content is required")
        return normalized


def create_app(
    db_path: Path | None = None,
    seed: bool | None = None,
    upload_dir: Path | None = None,
    max_upload_bytes: int | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        app_instance.state.db = AppDatabase(
            db_path or database_path(),
            seed=_seed_enabled() if seed is None else seed,
        )
        logger.info("Context Canvas API started")
        try:
            yield
        finally:
            app_instance.state.db.close()
            logger.info("Context Canvas API stopped")

    app = FastAPI(title="Context Canvas API", version="0.1.0", lifespan=lifespan)
    app.state.upload_dir = upload_dir
    app.state.max_upload_bytes = max_upload_bytes
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "x-context-canvas-actor"],
    )
    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/config/ai")
    def ai_config() -> dict[str, str | bool]:
        return ai_configuration_status()

    @app.get("/api/projects")
    def list_projects(db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        return {"projects": [project.model_dump() for project in db.list_projects()]}

    @app.post("/api/projects")
    def create_project(payload: CreateProjectRequest, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        return db.create_project(
            payload.name,
            payload.description,
            viewport=payload.viewport,
            nodes=payload.nodes,
            edges=payload.edges,
            actor=_actor(request),
        ).model_dump()

    @app.post("/api/projects/generate")
    def generate_project(payload: GenerateProjectRequest) -> dict[str, Any]:
        try:
            return generate_canvas(payload.prompt)
        except AIProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.get("/api/projects/{project_id}")
    def get_project(project_id: str, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project.model_dump()

    @app.patch("/api/projects/{project_id}")
    async def patch_project(project_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        project = db.patch_project(project_id, await _json_object(request))
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project.model_dump()

    @app.delete("/api/projects/{project_id}", status_code=204)
    def delete_project(project_id: str, db: AppDatabase = Depends(_db)) -> None:
        if not db.delete_project(project_id):
            raise HTTPException(status_code=404, detail="Project not found")

    @app.get("/api/projects/{project_id}/canvas")
    def get_canvas(project_id: str, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        snapshot = db.get_snapshot(project_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Project not found")
        return snapshot.model_dump()

    @app.put("/api/projects/{project_id}/canvas")
    async def put_canvas(project_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        body = await _json_object(request)
        commit_message = body.pop("commitMessage", None)
        try:
            payload = CanvasSnapshot.model_validate(body)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=exc.errors()) from exc
        if payload.project.id != project_id:
            raise HTTPException(status_code=400, detail="Canvas project ID does not match URL")
        message = commit_message.strip() if isinstance(commit_message, str) else None
        return db.save_snapshot(payload, actor=_actor(request), commit_message=message or None).model_dump()

    @app.post("/api/projects/{project_id}/nodes")
    async def create_node(project_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        node = db.create_node(project_id, await _json_object(request), actor=_actor(request))
        if not node:
            raise HTTPException(status_code=404, detail="Project not found")
        return node

    @app.patch("/api/projects/{project_id}/nodes/{node_id}")
    async def patch_node(project_id: str, node_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        node = db.patch_node(project_id, node_id, await _json_object(request), actor=_actor(request))
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        return node

    @app.delete("/api/projects/{project_id}/nodes/{node_id}", status_code=204)
    def delete_node(project_id: str, node_id: str, request: Request, db: AppDatabase = Depends(_db)) -> None:
        if not db.delete_node(project_id, node_id, actor=_actor(request)):
            raise HTTPException(status_code=404, detail="Node not found")

    @app.get("/api/projects/{project_id}/versions")
    def list_versions(project_id: str, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        if not db.get_project(project_id):
            raise HTTPException(status_code=404, detail="Project not found")
        return {"versions": [version.model_dump() for version in db.list_change_versions(project_id)]}

    @app.get("/api/projects/{project_id}/nodes/{node_id}/versions")
    def list_node_versions(project_id: str, node_id: str, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        if not db.get_project(project_id):
            raise HTTPException(status_code=404, detail="Project not found")
        return {"versions": [version.model_dump() for version in db.list_change_versions(project_id, node_id)]}

    @app.post("/api/projects/{project_id}/edges")
    async def create_edge(project_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        try:
            edge = db.create_edge(project_id, await _json_object(request))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not edge:
            raise HTTPException(status_code=404, detail="Project not found")
        return edge

    @app.patch("/api/projects/{project_id}/edges/{edge_id}")
    async def patch_edge(project_id: str, edge_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        edge = db.patch_edge(project_id, edge_id, await _json_object(request))
        if not edge:
            raise HTTPException(status_code=404, detail="Edge not found")
        return edge

    @app.delete("/api/projects/{project_id}/edges/{edge_id}", status_code=204)
    def delete_edge(project_id: str, edge_id: str, db: AppDatabase = Depends(_db)) -> None:
        if not db.delete_edge(project_id, edge_id):
            raise HTTPException(status_code=404, detail="Edge not found")

    @app.post("/api/uploads")
    def create_upload(payload: UploadRequest, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        if not db.get_project(payload.projectId):
            raise HTTPException(status_code=404, detail="Project not found")
        resolved_upload_dir = request.app.state.upload_dir or _upload_dir()
        resolved_upload_dir.mkdir(parents=True, exist_ok=True)
        try:
            data = _decode_data_url(payload.dataUrl)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid data URL") from exc
        if len(data) > _max_upload_bytes(request):
            raise HTTPException(status_code=413, detail="Upload is too large")
        file_path = resolved_upload_dir / f"{utc_now().replace(':', '-')}-{_safe_upload_filename(payload.filename)}"
        file_path.write_bytes(data)
        upload = db.save_upload(payload.projectId, payload.filename, payload.contentType, file_path)
        return upload

    @app.get("/api/uploads/{upload_id}")
    def get_upload(upload_id: str, db: AppDatabase = Depends(_db)) -> FileResponse:
        upload = db.get_upload(upload_id)
        if not upload:
            raise HTTPException(status_code=404, detail="Upload not found")
        if not Path(upload["filePath"]).is_file():
            raise HTTPException(status_code=404, detail="Upload file not found")
        return FileResponse(upload["filePath"], media_type=upload["contentType"], filename=upload["filename"])

    @app.post("/api/sources/fetch")
    async def fetch_source_endpoint(request: Request) -> dict[str, Any]:
        payload = await _json_object(request)
        if "sourceType" not in payload and payload.get("url"):
            payload["sourceType"] = infer_source_type(str(payload["url"]))
        return fetch_source(payload)

    @app.post("/api/sources/search")
    async def search_sources_endpoint(request: Request) -> dict[str, Any]:
        return search_source_context(await _json_object(request))

    @app.post("/api/projects/{project_id}/analyze")
    def analyze(project_id: str, payload: AnalyzeRequest, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        snapshot = db.get_snapshot(project_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Project not found")
        try:
            analysis = analyze_canvas(snapshot, payload.question)
        except AIProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        db.save_analysis_run(project_id, payload.question, analysis)
        return analysis.model_dump()

    @app.post("/api/projects/{project_id}/spec")
    def create_spec(project_id: str, payload: SpecRequest, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        snapshot = db.get_snapshot(project_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Project not found")
        return build_feature_spec(
            snapshot.model_dump(),
            focus_node_id=payload.focusNodeId,
            instruction=payload.instruction,
        )

    @app.post("/api/projects/{project_id}/suggest")
    def suggest(project_id: str, payload: SuggestRequest, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        snapshot = db.get_snapshot(project_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Project not found")
        try:
            suggestions = suggest_canvas_changes(snapshot, payload.targetNodeId, payload.instruction)
        except AIProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return suggestions.model_dump()

    @app.get("/api/projects/{project_id}/chats")
    def list_chats(project_id: str, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        if not db.get_project(project_id):
            raise HTTPException(status_code=404, detail="Project not found")
        return {"chats": [chat.model_dump() for chat in db.list_chats(project_id)]}

    @app.post("/api/projects/{project_id}/chats")
    def create_chat(project_id: str, payload: ChatRequest, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        thread = db.create_chat(project_id, payload.title)
        if not thread:
            raise HTTPException(status_code=404, detail="Project not found")
        return {"thread": thread.model_dump(), "messages": []}

    @app.get("/api/projects/{project_id}/chats/{chat_id}")
    def get_chat(project_id: str, chat_id: str, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        thread = db.get_chat(project_id, chat_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Chat not found")
        return {"thread": thread.model_dump(), "messages": [msg.model_dump() for msg in db.list_messages(chat_id)]}

    @app.delete("/api/projects/{project_id}/chats/{chat_id}", status_code=204)
    def delete_chat(project_id: str, chat_id: str, db: AppDatabase = Depends(_db)) -> None:
        if not db.delete_chat(project_id, chat_id):
            raise HTTPException(status_code=404, detail="Chat not found")

    @app.post("/api/projects/{project_id}/chats/{chat_id}/messages")
    def send_chat_message(
        project_id: str,
        chat_id: str,
        payload: ChatMessageRequest,
        request: Request,
        db: AppDatabase = Depends(_db),
    ) -> dict[str, Any]:
        thread = db.get_chat(project_id, chat_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Chat not found")
        snapshot = db.get_snapshot(project_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Project not found")
        history = [message.model_dump() for message in db.list_messages(chat_id)]
        db.append_message(chat_id, "user", payload.content)
        try:
            assistant_content, analysis = chat_with_canvas(
                snapshot,
                payload.content,
                history=history,
            )
        except AIProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        assistant = db.append_message(chat_id, "assistant", assistant_content, analysis)
        if thread.title == "New chat":
            db.rename_chat(chat_id, payload.content.strip() or assistant.content)
        updated_thread = db.get_chat(project_id, chat_id) or thread
        return {
            "thread": updated_thread.model_dump(),
            "messages": [msg.model_dump() for msg in db.list_messages(chat_id)],
            "analysis": analysis.model_dump(),
        }

    return app


def _db(request: Request) -> AppDatabase:
    return request.app.state.db


def _actor(request: Request) -> str:
    actor = request.headers.get("x-context-canvas-actor", "").strip()
    return actor[:120] or "local user"


async def _json_object(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="JSON body must be an object")
    return payload


def _decode_data_url(data_url: str) -> bytes:
    header, encoded = data_url.split(",", 1)
    if not header.startswith("data:"):
        raise ValueError("Invalid data URL header")
    return base64.b64decode(encoded, validate=True)


def _max_upload_bytes(request: Request) -> int:
    return request.app.state.max_upload_bytes or 10 * 1024 * 1024


def _safe_upload_filename(filename: str) -> str:
    return "".join(char if char.isalnum() or char in "._-" else "_" for char in filename)


def _cors_origins() -> list[str]:
    return [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
    ]


def _seed_enabled() -> bool:
    return os.getenv("CONTEXT_CANVAS_SEED_DEMO", "").strip().lower() in {"1", "true", "yes", "on"}


def _upload_dir() -> Path:
    docker_data_dir = Path("/data")
    if docker_data_dir.is_dir():
        return docker_data_dir / "uploads"
    return Path(__file__).resolve().parents[1] / "uploads"


app = create_app()

from __future__ import annotations

import base64
from contextlib import asynccontextmanager
import os
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from context_canvas_api.analyzer import AIProviderError, analyze_canvas, chat_with_canvas
from context_canvas_api.db import AppDatabase, database_path
from context_canvas_api.demo import utc_now
from context_canvas_api.env import ai_configuration_status, load_project_dotenv
from context_canvas_api.models import CanvasSnapshot
from context_canvas_api.source_fetcher import fetch_source, infer_source_type, search_source_context

load_project_dotenv()


class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip() or "Untitled canvas"


class AnalyzeRequest(BaseModel):
    question: str = Field(min_length=1)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Question is required")
        return normalized


class UploadRequest(BaseModel):
    projectId: str
    filename: str
    contentType: str
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
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Message content is required")
        return normalized


def create_app(
    db_path: Path | None = None,
    seed: bool = True,
    upload_dir: Path | None = None,
    max_upload_bytes: int | None = None,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        app_instance.state.db = AppDatabase(db_path or database_path(), seed=seed)
        try:
            yield
        finally:
            app_instance.state.db.close()

    app = FastAPI(title="Context Canvas API", version="0.1.0", lifespan=lifespan)
    app.state.upload_dir = upload_dir
    app.state.max_upload_bytes = max_upload_bytes
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
    def create_project(payload: CreateProjectRequest, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        return db.create_project(payload.name, payload.description).model_dump()

    @app.get("/api/projects/{project_id}")
    def get_project(project_id: str, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        project = db.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project.model_dump()

    @app.patch("/api/projects/{project_id}")
    async def patch_project(project_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        project = db.patch_project(project_id, await request.json())
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
    def put_canvas(project_id: str, payload: CanvasSnapshot, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        if payload.project.id != project_id:
            raise HTTPException(status_code=400, detail="Canvas project ID does not match URL")
        return db.save_snapshot(payload).model_dump()

    @app.post("/api/projects/{project_id}/nodes")
    async def create_node(project_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        node = db.create_node(project_id, await request.json())
        if not node:
            raise HTTPException(status_code=404, detail="Project not found")
        return node

    @app.patch("/api/projects/{project_id}/nodes/{node_id}")
    async def patch_node(project_id: str, node_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        node = db.patch_node(project_id, node_id, await request.json())
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        return node

    @app.delete("/api/projects/{project_id}/nodes/{node_id}", status_code=204)
    def delete_node(project_id: str, node_id: str, db: AppDatabase = Depends(_db)) -> None:
        if not db.delete_node(project_id, node_id):
            raise HTTPException(status_code=404, detail="Node not found")

    @app.post("/api/projects/{project_id}/edges")
    async def create_edge(project_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        try:
            edge = db.create_edge(project_id, await request.json())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not edge:
            raise HTTPException(status_code=404, detail="Project not found")
        return edge

    @app.patch("/api/projects/{project_id}/edges/{edge_id}")
    async def patch_edge(project_id: str, edge_id: str, request: Request, db: AppDatabase = Depends(_db)) -> dict[str, Any]:
        edge = db.patch_edge(project_id, edge_id, await request.json())
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
        configured_upload_dir = request.app.state.upload_dir or os.getenv(
            "CONTEXT_CANVAS_UPLOAD_DIR",
            Path(__file__).resolve().parents[1] / "uploads",
        )
        resolved_upload_dir = Path(configured_upload_dir)
        resolved_upload_dir.mkdir(parents=True, exist_ok=True)
        try:
            header, encoded = payload.dataUrl.split(",", 1)
            if not header.startswith("data:"):
                raise ValueError("Invalid data URL header")
            data = base64.b64decode(encoded, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid data URL") from exc
        configured_max_upload_bytes = request.app.state.max_upload_bytes or int(
            os.getenv("CONTEXT_CANVAS_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024))
        )
        if len(data) > configured_max_upload_bytes:
            raise HTTPException(status_code=413, detail="Upload is too large")
        safe_name = "".join(char if char.isalnum() or char in "._-" else "_" for char in payload.filename)
        file_path = resolved_upload_dir / f"{utc_now().replace(':', '-')}-{safe_name}"
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
        payload = await request.json()
        if "sourceType" not in payload and payload.get("url"):
            payload["sourceType"] = infer_source_type(str(payload["url"]))
        return fetch_source(payload)

    @app.post("/api/sources/search")
    async def search_sources_endpoint(request: Request) -> dict[str, Any]:
        return search_source_context(await request.json())

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


def _cors_origins() -> list[str]:
    configured = os.getenv("CONTEXT_CANVAS_CORS_ORIGINS", "").strip()
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return ["http://127.0.0.1:5173", "http://localhost:5173"]


app = create_app()

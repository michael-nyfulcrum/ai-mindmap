from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SourceKind = Literal["confluence", "jira", "figma", "github", "generic"]
SourceStatus = Literal["ok", "ready", "unconfigured", "dependency_missing", "no_matches", "error"]


class SourceReference(BaseModel):
    kind: SourceKind
    source_id: str
    title: str
    url: str
    excerpt: str
    container_name: str | None = None
    labels: list[str] = Field(default_factory=list)
    last_updated: str | None = None
    relevance_reason: str
    metadata: dict[str, str] = Field(default_factory=dict)


class SourceSearchResult(BaseModel):
    status: SourceStatus
    query: str
    sources_requested: list[SourceKind]
    message: str
    total_matches: int = 0
    sources: list[SourceReference] = Field(default_factory=list)
    recommended_next_steps: list[str] = Field(default_factory=list)


class SourceDocument(BaseModel):
    status: SourceStatus
    kind: SourceKind
    source_id: str
    title: str | None = None
    url: str | None = None
    content: str = ""
    message: str
    metadata: dict[str, str] = Field(default_factory=dict)


class FeatureStatus(BaseModel):
    status: SourceStatus
    configured: bool
    dependency_ready: bool
    base_url: str | None = None
    auth_mode: str
    search_scope: str
    dependency_error: str | None = None

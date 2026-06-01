from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


CanvasNodeType = Literal[
    "project_contract",
    "note",
    "requirement",
    "image",
    "link",
    "source_snapshot",
]


class Project(BaseModel):
    id: str
    name: str
    description: str | None = None
    createdAt: str
    updatedAt: str
    viewport: dict[str, Any] | None = None


class CanvasSnapshot(BaseModel):
    project: Project
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class AnalysisFinding(BaseModel):
    severity: Literal["info", "low", "medium", "high"]
    title: str
    detail: str
    citationNodeIds: list[str] = Field(default_factory=list)


class Citation(BaseModel):
    nodeId: str
    title: str


class AnalysisResponse(BaseModel):
    status: Literal["ok", "needs_context"]
    model: str
    summary: str
    findings: list[AnalysisFinding] = Field(default_factory=list)
    missingContext: list[str] = Field(default_factory=list)
    suggestedNextSteps: list[str] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)


ImpactStatus = Literal["review", "outdated", "needs_update", "conflict"]


class ChangeImpact(BaseModel):
    nodeId: str
    title: str
    status: ImpactStatus
    reason: str
    sourceNodeId: str
    sourceVersionId: str
    updatedAt: str


class ContractChangeVersion(BaseModel):
    id: str
    projectId: str
    nodeId: str
    nodeTitle: str
    nodeType: CanvasNodeType
    versionNumber: int
    changeType: Literal["created", "updated", "deleted"]
    summary: str
    changedFields: list[str] = Field(default_factory=list)
    affectedNodes: list[ChangeImpact] = Field(default_factory=list)
    titleBefore: str | None = None
    titleAfter: str | None = None
    contentBefore: str | None = None
    contentAfter: str | None = None
    createdBy: str
    createdAt: str


class ChatThread(BaseModel):
    id: str
    projectId: str
    title: str
    createdAt: str
    updatedAt: str


class ChatMessage(BaseModel):
    id: str
    threadId: str
    role: Literal["user", "assistant"]
    content: str
    analysis: AnalysisResponse | None = None
    createdAt: str

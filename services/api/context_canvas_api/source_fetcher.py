from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from context_canvas_mcp.sources import (
    fetch_confluence_page,
    fetch_figma_link_metadata,
    fetch_generic_source,
    fetch_github_issue_or_pr,
    fetch_jira_issue,
    search_sources,
)


def fetch_source(payload: dict[str, Any]) -> dict[str, Any]:
    source_type = str(payload.get("sourceType") or "generic").lower()
    identifier = str(payload.get("sourceId") or payload.get("url") or "").strip()
    url = str(payload.get("url") or identifier).strip()

    if source_type == "jira":
        document = fetch_jira_issue(identifier)
    elif source_type == "confluence":
        document = fetch_confluence_page(identifier)
    elif source_type == "figma":
        document = fetch_figma_link_metadata(url)
    elif source_type == "github":
        document = fetch_github_issue_or_pr(url)
    else:
        document = fetch_generic_source(url)

    return {
        "status": document.status,
        "source": document.model_dump(),
        "snapshotNode": _snapshot_from_document(document.model_dump()),
    }


def search_source_context(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()
    sources = payload.get("sources")
    max_results = int(payload.get("maxResults") or 5)
    if not isinstance(sources, list):
        sources = None
    result = search_sources(query=query, sources=sources, max_results=max_results)
    return result.model_dump()


def _snapshot_from_document(document: dict[str, Any]) -> dict[str, Any]:
    source_type = str(document.get("kind") or "generic")
    title = str(document.get("title") or document.get("url") or document.get("source_id") or "Source Snapshot")
    source_url = str(document.get("url") or "")
    source_id = str(document.get("source_id") or source_url)
    content = str(document.get("content") or document.get("message") or "")
    return {
        "type": "contextNode",
        "position": {"x": 120, "y": 120},
        "data": {
            "canvasType": "source_snapshot",
            "title": title,
            "fields": {
                "sourceType": source_type,
                "sourceId": source_id,
                "sourceUrl": source_url,
                "rawText": content,
                "summary": _summary(content),
                "fetchedAt": "",
                "metadata": _metadata(document),
            },
            "tags": ["source", source_type],
            "updatedAt": "",
        },
    }


def infer_source_type(url_or_id: str) -> str:
    parsed = urlparse(url_or_id)
    host = parsed.netloc.lower()
    if "atlassian" in host and "/browse/" in parsed.path:
        return "jira"
    if "atlassian" in host and "/wiki/" in parsed.path:
        return "confluence"
    if "figma.com" in host:
        return "figma"
    if "github.com" in host:
        return "github"
    return "generic"


def _summary(content: str) -> str:
    compact = " ".join(content.split())
    return compact[:240]


def _metadata(document: dict[str, Any]) -> str:
    metadata = document.get("metadata")
    if not isinstance(metadata, dict) or not metadata:
        return ""
    return "\n".join(f"{key}: {value}" for key, value in metadata.items() if value)

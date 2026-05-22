from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import re
from typing import Any
from urllib.parse import urlparse

from context_canvas_mcp.models import FeatureStatus, SourceDocument, SourceReference, SourceSearchResult
from context_canvas_mcp.settings import AtlassianSettings, load_atlassian_settings


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return re.sub(r"\s+", " ", unescape(" ".join(self.parts))).strip()


def feature_status(feature: str) -> FeatureStatus:
    settings = load_atlassian_settings()
    dependency_ready = _atlassian_dependency_ready()
    return FeatureStatus(
        status="ready" if settings.is_configured and dependency_ready else "unconfigured",
        configured=settings.is_configured,
        dependency_ready=dependency_ready,
        base_url=settings.url or None,
        auth_mode=settings.auth_mode,
        search_scope=f"all readable {feature} content",
        dependency_error=None if dependency_ready else "atlassian-python-api is not installed",
    )


def search_jira_issues(query: str, max_results: int = 5) -> SourceSearchResult:
    settings = load_atlassian_settings()
    if not settings.is_configured:
        return _unconfigured_search("jira", query)
    if not _atlassian_dependency_ready():
        return _dependency_missing_search("jira", query)
    try:
        from atlassian import Jira

        client = Jira(url=settings.url, username=settings.email, password=settings.token, cloud=True, api_version="3")
        response = client.jql(_build_jql(query), limit=max_results, fields="summary,description,status,assignee,issuetype,labels,updated,project")
        sources = [_jira_issue_to_source(issue, settings) for issue in response.get("issues", [])]
    except Exception as exc:
        return SourceSearchResult(
            status="error",
            query=query,
            sources_requested=["jira"],
            message=f"Jira search failed: {exc}",
            recommended_next_steps=["Confirm Atlassian credentials and issue permissions."],
        )
    return _search_result("jira", query, sources)


def fetch_jira_issue(issue_key: str) -> SourceDocument:
    settings = load_atlassian_settings()
    normalized = _extract_issue_key(issue_key) or issue_key.strip()
    if not settings.is_configured:
        return _unconfigured_document("jira", normalized)
    if not _atlassian_dependency_ready():
        return _dependency_missing_document("jira", normalized)
    try:
        from atlassian import Jira

        client = Jira(url=settings.url, username=settings.email, password=settings.token, cloud=True, api_version="3")
        issue = client.issue(normalized, fields="summary,description,status,assignee,issuetype,labels,updated,project")
    except Exception as exc:
        return SourceDocument(status="error", kind="jira", source_id=normalized, message=f"Jira issue lookup failed: {exc}")
    fields = issue.get("fields") or {}
    return SourceDocument(
        status="ok",
        kind="jira",
        source_id=normalized,
        title=fields.get("summary"),
        url=f"{settings.url.rstrip('/')}/browse/{normalized}",
        content=_flatten_rich_text(fields.get("description")),
        message=f"Loaded Jira issue {normalized}.",
        metadata={
            "status": str(((fields.get("status") or {}).get("name")) or ""),
            "issue_type": str(((fields.get("issuetype") or {}).get("name")) or ""),
            "assignee": str(((fields.get("assignee") or {}).get("displayName")) or "Unassigned"),
            "updated": str(fields.get("updated") or ""),
        },
    )


def search_confluence_pages(query: str, max_results: int = 5) -> SourceSearchResult:
    settings = load_atlassian_settings()
    if not settings.is_configured:
        return _unconfigured_search("confluence", query)
    if not _atlassian_dependency_ready():
        return _dependency_missing_search("confluence", query)
    try:
        from atlassian import Confluence

        client = Confluence(url=settings.url, username=settings.email, password=settings.token)
        cql = f'type = page AND text ~ "{_escape(query)}" ORDER BY lastmodified DESC'
        response = client.cql(cql, limit=max_results, expand="content.space,content.version")
        results = response.get("results", [])
        sources = [_confluence_result_to_source(result, settings) for result in results]
    except Exception as exc:
        return SourceSearchResult(
            status="error",
            query=query,
            sources_requested=["confluence"],
            message=f"Confluence search failed: {exc}",
            recommended_next_steps=["Confirm Atlassian credentials and Confluence page permissions."],
        )
    return _search_result("confluence", query, sources)


def fetch_confluence_page(page_id: str) -> SourceDocument:
    settings = load_atlassian_settings()
    if not settings.is_configured:
        return _unconfigured_document("confluence", page_id)
    if not _atlassian_dependency_ready():
        return _dependency_missing_document("confluence", page_id)
    try:
        from atlassian import Confluence

        client = Confluence(url=settings.url, username=settings.email, password=settings.token)
        page = client.get_page_by_id(page_id, expand="body.view,version,space,metadata.labels")
    except Exception as exc:
        return SourceDocument(status="error", kind="confluence", source_id=page_id, message=f"Confluence page lookup failed: {exc}")
    body = (((page.get("body") or {}).get("view") or {}).get("value")) or ""
    return SourceDocument(
        status="ok",
        kind="confluence",
        source_id=str(page.get("id") or page_id),
        title=page.get("title"),
        url=f"{settings.url.rstrip()}/wiki/spaces/{((page.get('space') or {}).get('key'))}/pages/{page.get('id')}",
        content=_html_to_text(body),
        message=f"Loaded Confluence page {page.get('title') or page_id}.",
        metadata={
            "space": str(((page.get("space") or {}).get("key")) or ""),
            "version": str(((page.get("version") or {}).get("number")) or ""),
        },
    )


def fetch_figma_link_metadata(url: str) -> SourceDocument:
    parsed = urlparse(url)
    file_key = _path_part(parsed.path, 2)
    title = "Figma reference"
    return SourceDocument(
        status="ok",
        kind="figma",
        source_id=file_key or url,
        title=title,
        url=url,
        content=f"Figma URL captured for requirements citation: {url}",
        message="Captured Figma metadata from the provided URL.",
        metadata={"host": parsed.netloc, "file_key": file_key or "", "node_id": _query_value(parsed.query, "node-id")},
    )


def fetch_github_issue_or_pr(url: str) -> SourceDocument:
    parsed = urlparse(url)
    parts = [part for part in parsed.path.split("/") if part]
    source_id = "/".join(parts[:4]) if len(parts) >= 4 else url
    title = "GitHub issue or pull request"
    return SourceDocument(
        status="ok",
        kind="github",
        source_id=source_id,
        title=title,
        url=url,
        content=f"GitHub URL captured for requirements citation: {url}",
        message="Captured GitHub link metadata from the provided URL.",
        metadata={"host": parsed.netloc, "owner": parts[0] if parts else "", "repo": parts[1] if len(parts) > 1 else ""},
    )


def fetch_generic_source(url: str) -> SourceDocument:
    parsed = urlparse(url)
    return SourceDocument(
        status="ok",
        kind="generic",
        source_id=url,
        title=parsed.netloc or url,
        url=url,
        content=f"External source URL captured for requirements citation: {url}",
        message="Captured generic source metadata from the provided URL.",
        metadata={"host": parsed.netloc},
    )


def search_sources(query: str, sources: list[str] | None = None, max_results: int = 5) -> SourceSearchResult:
    requested = sources or ["jira", "confluence"]
    merged: list[SourceReference] = []
    messages: list[str] = []
    for source in requested:
        if source == "jira":
            result = search_jira_issues(query, max_results=max_results)
        elif source == "confluence":
            result = search_confluence_pages(query, max_results=max_results)
        else:
            result = SourceSearchResult(
                status="no_matches",
                query=query,
                sources_requested=[source],  # type: ignore[list-item]
                message=f"{source} search is not available for this MVP.",
            )
        merged.extend(result.sources)
        messages.append(result.message)
    return SourceSearchResult(
        status="ok" if merged else "no_matches",
        query=query,
        sources_requested=[source for source in requested if source in {"jira", "confluence", "figma", "github", "generic"}],  # type: ignore[list-item]
        message=" ".join(messages) or "No sources searched.",
        total_matches=len(merged),
        sources=merged[:max_results],
        recommended_next_steps=["Add matching sources as source snapshots before finalizing requirements."] if merged else [],
    )


def _atlassian_dependency_ready() -> bool:
    try:
        import atlassian  # noqa: F401
    except ModuleNotFoundError:
        return False
    return True


def _build_jql(query: str) -> str:
    issue_key = _extract_issue_key(query)
    if issue_key:
        return f"issuekey = {issue_key} ORDER BY updated DESC"
    return f'text ~ "{_escape(query)}" ORDER BY updated DESC'


def _extract_issue_key(value: str) -> str | None:
    match = re.search(r"\b[A-Z][A-Z0-9]+-\d+\b", value.upper())
    return match.group(0) if match else None


def _escape(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().replace("\\", "\\\\").replace('"', '\\"')


def _jira_issue_to_source(issue: dict[str, Any], settings: AtlassianSettings) -> SourceReference:
    fields = issue.get("fields") or {}
    key = str(issue.get("key") or "")
    title = str(fields.get("summary") or key or "Untitled Jira issue")
    description = _flatten_rich_text(fields.get("description"))
    return SourceReference(
        kind="jira",
        source_id=key,
        title=title,
        url=f"{settings.url.rstrip('/')}/browse/{key}",
        excerpt=description[:280] or f"Jira issue {key}",
        container_name=str(((fields.get("project") or {}).get("name")) or ""),
        labels=[str(label) for label in fields.get("labels") or []],
        last_updated=str(fields.get("updated") or ""),
        relevance_reason=f"Matched Jira query for {key}.",
        metadata={
            "issue_key": key,
            "status": str(((fields.get("status") or {}).get("name")) or ""),
            "issue_type": str(((fields.get("issuetype") or {}).get("name")) or ""),
        },
    )


def _confluence_result_to_source(result: dict[str, Any], settings: AtlassianSettings) -> SourceReference:
    content = result.get("content") or {}
    page_id = str(content.get("id") or result.get("id") or "")
    title = str(content.get("title") or result.get("title") or "Untitled Confluence page")
    space = content.get("space") or {}
    return SourceReference(
        kind="confluence",
        source_id=page_id,
        title=title,
        url=f"{settings.url.rstrip('/')}/wiki/spaces/{space.get('key')}/pages/{page_id}",
        excerpt=str(result.get("excerpt") or title),
        container_name=str(space.get("name") or space.get("key") or ""),
        last_updated=str(((content.get("version") or {}).get("when")) or ""),
        relevance_reason=f"Matched Confluence search for {title}.",
    )


def _flatten_rich_text(description: Any) -> str:
    if description is None:
        return ""
    if isinstance(description, str):
        return re.sub(r"\s+", " ", description).strip()
    if isinstance(description, list):
        return _flatten_nodes(description)
    if isinstance(description, dict):
        return _flatten_nodes(description.get("content") or [])
    return str(description)


def _flatten_nodes(nodes: list[Any]) -> str:
    parts: list[str] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        if isinstance(node.get("text"), str):
            parts.append(node["text"])
        if isinstance(node.get("content"), list):
            parts.append(_flatten_nodes(node["content"]))
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def _html_to_text(html: str) -> str:
    parser = _HTMLTextExtractor()
    parser.feed(html)
    return parser.text()


def _search_result(kind: str, query: str, sources: list[SourceReference]) -> SourceSearchResult:
    return SourceSearchResult(
        status="ok" if sources else "no_matches",
        query=query,
        sources_requested=[kind],  # type: ignore[list-item]
        message=f"Found {len(sources)} {kind} sources." if sources else f"No {kind} sources matched.",
        total_matches=len(sources),
        sources=sources,
        recommended_next_steps=["Add the strongest match as a source snapshot and cite it from requirement nodes."] if sources else [],
    )


def _unconfigured_search(kind: str, query: str) -> SourceSearchResult:
    return SourceSearchResult(
        status="unconfigured",
        query=query,
        sources_requested=[kind],  # type: ignore[list-item]
        message="Atlassian access is not configured. Set ATLASSIAN_URL, ATLASSIAN_EMAIL, and ATLASSIAN_TOKEN.",
        recommended_next_steps=["Configure Atlassian credentials before live Jira or Confluence retrieval."],
    )


def _dependency_missing_search(kind: str, query: str) -> SourceSearchResult:
    return SourceSearchResult(
        status="dependency_missing",
        query=query,
        sources_requested=[kind],  # type: ignore[list-item]
        message="The atlassian-python-api dependency is not installed.",
        recommended_next_steps=["Install project dependencies with uv sync."],
    )


def _unconfigured_document(kind: str, source_id: str) -> SourceDocument:
    return SourceDocument(
        status="unconfigured",
        kind=kind,  # type: ignore[arg-type]
        source_id=source_id,
        message="Atlassian access is not configured. Set ATLASSIAN_URL, ATLASSIAN_EMAIL, and ATLASSIAN_TOKEN.",
    )


def _dependency_missing_document(kind: str, source_id: str) -> SourceDocument:
    return SourceDocument(
        status="dependency_missing",
        kind=kind,  # type: ignore[arg-type]
        source_id=source_id,
        message="The atlassian-python-api dependency is not installed.",
    )


def _path_part(path: str, index: int) -> str:
    parts = [part for part in path.split("/") if part]
    return parts[index] if len(parts) > index else ""


def _query_value(query: str, key: str) -> str:
    for pair in query.split("&"):
        if pair.startswith(f"{key}="):
            return pair.split("=", 1)[1]
    return ""

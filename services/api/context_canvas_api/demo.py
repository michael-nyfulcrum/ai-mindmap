from __future__ import annotations

from datetime import UTC, datetime

from context_canvas_api.models import CanvasSnapshot, Project


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def demo_snapshot() -> CanvasSnapshot:
    now = "2026-05-14T00:00:00.000Z"
    project = Project(
        id="project_demo_context_canvas",
        name="GGR-5534 Help Center Change Request",
        description="Client-ready change request contract with Jira, estimate, and design citations.",
        createdAt=now,
        updatedAt=now,
        viewport={"x": 120, "y": 90, "zoom": 0.82},
    )
    nodes = [
        _node(
            "node_contract",
            "project_contract",
            "GGR-5534 Help Center CR Contract",
            80,
            80,
            {
                "goal": "Prepare a client-facing change request for a Help Center that improves user self-service and reduces direct support dependency.",
                "scope": "Estimate Help Center access, landing/search, FAQ, multimedia content and tips, contact support, submission feedback, backend content APIs, content management, and integration with existing support flows.",
                "nonGoals": "Do not position this as a full Zendesk replacement, a complete support-operations platform, or an implementation commitment before CR approval.",
                "requirements": "The CR package must cite the Jira request, Figma reference, and Support & Feedback Estimate page; it must separate frontend, backend, and QA effort.",
                "acceptanceCriteria": "The output is suitable for a Change Request proposal, documents assumptions and dependencies, identifies integration points, and explains overall complexity.",
                "constraints": "External-app source fetching is a later product improvement; this canvas stores cited source snapshots and links manually for now.",
                "definitionOfDone": "Client-facing CR summary can be generated from the canvas with cited scope, estimate, assumptions, dependencies, and excluded work.",
            },
            now,
            ["client-cr", "source-of-truth"],
        ),
        _node(
            "node_jira_source",
            "source_snapshot",
            "Jira GGR-5534",
            -300,
            -20,
            {
                "sourceType": "jira",
                "sourceId": "GGR-5534",
                "sourceUrl": "https://gogira-platform.atlassian.net/browse/GGR-5534",
                "rawText": "Estimation Request for Help Center Feature Implementation. The request asks for effort estimation to support a Change Request proposal for Help Center access, FAQ, content, contact support, submission feedback, backend/content management, and non-functional considerations.",
                "summary": "Primary request source. Defines the Help Center estimation scope and requires frontend, backend, QA, assumptions, dependencies, integration points, and CR-ready output.",
                "fetchedAt": now,
                "metadata": "issueType=Story; status=DEV COMPLETE; priority=Medium",
            },
            now,
            ["jira", "request"],
        ),
        _node(
            "node_estimate_source",
            "source_snapshot",
            "Support & Feedback Estimate",
            -310,
            300,
            {
                "sourceType": "confluence",
                "sourceId": "452067329",
                "sourceUrl": "https://gogira-platform.atlassian.net/wiki/spaces/GoGira/pages/452067329/Support+Feedback+Estimate",
                "rawText": "Estimate page includes Help Center access, landing and search shell, FAQ module, Multimedia Content & Tips, Contact Support form, content setup, integration polish, QA/UAT, and workstream-level frontend/backend effort.",
                "summary": "Planning source for the CR estimate. Current page frames Help Center as 3-4 calendar weeks in addition to broader Support & Feedback work.",
                "fetchedAt": now,
                "metadata": "space=GoGira; pageTitle=Support & Feedback Estimate",
            },
            now,
            ["confluence", "estimate"],
        ),
        _node(
            "node_figma",
            "link",
            "Figma Help Center Reference",
            80,
            -160,
            {
                "url": "https://www.figma.com/design/a881lyhzKFF92802CCIuwR/GoGira---School?node-id=3255-38085&t=KKkxU4MN61j1iX34-4",
                "sourceType": "figma",
                "summary": "Design reference cited by GGR-5534 acceptance criteria.",
                "lastFetchedAt": "",
            },
            now,
            ["design"],
        ),
        _node(
            "node_req_access",
            "requirement",
            "Help Center Access",
            540,
            -120,
            {
                "body": "Users can access Help Center globally from side navigation across modules. The entry opens a dedicated Help Center interface with landing and navigation options.",
                "priority": "High",
                "status": "Estimated",
                "sourceNodeIds": "node_jira_source,node_figma",
            },
            now,
            ["frontend"],
        ),
        _node(
            "node_req_content",
            "requirement",
            "FAQ And Helpful Content",
            560,
            120,
            {
                "body": "Help Center includes categorized FAQ with expand/collapse answers and backend-driven articles, guides, videos, thumbnails, list/grid views, and detail pages.",
                "priority": "High",
                "status": "Estimated",
                "sourceNodeIds": "node_jira_source,node_estimate_source,node_figma",
            },
            now,
            ["content", "frontend", "backend"],
        ),
        _node(
            "node_req_contact",
            "requirement",
            "Contact Support Submission",
            555,
            360,
            {
                "body": "Users can submit a support request with identity/contact fields, category or feedback option, description/message, image or file attachment, submit handling, success confirmation, and return to Help Center.",
                "priority": "High",
                "status": "Estimated",
                "sourceNodeIds": "node_jira_source,node_estimate_source",
            },
            now,
            ["support", "upload"],
        ),
        _node(
            "node_req_cr_output",
            "requirement",
            "Client Change Request Output",
            100,
            470,
            {
                "body": "The final client-facing CR package must include scope, estimate, frontend/backend/QA split, assumptions, dependencies, integration points, and excluded work before approval.",
                "priority": "High",
                "status": "Ready",
                "sourceNodeIds": "node_contract,node_jira_source,node_estimate_source",
            },
            now,
            ["client-facing", "estimate"],
        ),
    ]
    edges = [
        _edge("edge_jira_contract", "node_jira_source", "node_contract", "requirement source", now),
        _edge("edge_estimate_contract", "node_estimate_source", "node_contract", "references", now),
        _edge("edge_figma_contract", "node_figma", "node_contract", "design reference", now),
        _edge("edge_access_contract", "node_contract", "node_req_access", "implements", now),
        _edge("edge_content_contract", "node_contract", "node_req_content", "implements", now),
        _edge("edge_contact_contract", "node_contract", "node_req_contact", "implements", now),
        _edge("edge_output_contract", "node_contract", "node_req_cr_output", "implements", now),
    ]
    return CanvasSnapshot(project=project, nodes=nodes, edges=edges)


def _node(
    node_id: str,
    canvas_type: str,
    title: str,
    x: int,
    y: int,
    fields: dict[str, str],
    now: str,
    tags: list[str],
) -> dict[str, object]:
    return {
        "id": node_id,
        "type": "contextNode",
        "position": {"x": x, "y": y},
        "data": {
            "canvasType": canvas_type,
            "title": title,
            "fields": fields,
            "tags": tags,
            "updatedAt": now,
        },
    }


def _edge(edge_id: str, source: str, target: str, relationship: str, now: str) -> dict[str, object]:
    return {
        "id": edge_id,
        "source": source,
        "target": target,
        "label": relationship,
        "data": {"relationship": relationship, "updatedAt": now},
    }

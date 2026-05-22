import type { CanvasSnapshot } from "./canvasTypes";

const createdAt = "2026-05-14T00:00:00.000Z";

export const demoSnapshot: CanvasSnapshot = {
  project: {
    id: "project_demo_context_canvas",
    name: "GGR-5534 Help Center Change Request",
    description: "Client-ready change request contract with Jira, estimate, and design citations.",
    createdAt,
    updatedAt: createdAt,
    viewport: { x: 120, y: 90, zoom: 0.82 },
  },
  nodes: [
    {
      id: "node_contract",
      type: "contextNode",
      position: { x: 80, y: 80 },
      data: {
        canvasType: "project_contract",
        title: "GGR-5534 Help Center CR Contract",
        tags: ["client-cr", "source-of-truth"],
        updatedAt: createdAt,
        fields: {
          goal: "Prepare a client-facing change request for a Help Center that improves user self-service and reduces direct support dependency.",
          scope:
            "Estimate Help Center access, landing/search, FAQ, multimedia content and tips, contact support, submission feedback, backend content APIs, content management, and integration with existing support flows.",
          nonGoals:
            "Do not position this as a full Zendesk replacement, a complete support-operations platform, or an implementation commitment before CR approval.",
          requirements:
            "The CR package must cite the Jira request, Figma reference, and Support & Feedback Estimate page; it must separate frontend, backend, and QA effort.",
          acceptanceCriteria:
            "The output is suitable for a Change Request proposal, documents assumptions and dependencies, identifies integration points, and explains overall complexity.",
          constraints:
            "External-app source fetching is a later product improvement; this canvas stores cited source snapshots and links manually for now.",
          definitionOfDone:
            "Client-facing CR summary can be generated from the canvas with cited scope, estimate, assumptions, dependencies, and excluded work.",
        },
      },
    },
    {
      id: "node_jira_source",
      type: "contextNode",
      position: { x: -300, y: -20 },
      data: {
        canvasType: "source_snapshot",
        title: "Jira GGR-5534",
        tags: ["jira", "request"],
        updatedAt: createdAt,
        fields: {
          sourceType: "jira",
          sourceId: "GGR-5534",
          sourceUrl: "https://gogira-platform.atlassian.net/browse/GGR-5534",
          rawText:
            "Estimation Request for Help Center Feature Implementation. The request asks for effort estimation to support a Change Request proposal for Help Center access, FAQ, content, contact support, submission feedback, backend/content management, and non-functional considerations.",
          summary:
            "Primary request source. Defines the Help Center estimation scope and requires frontend, backend, QA, assumptions, dependencies, integration points, and CR-ready output.",
          fetchedAt: "2026-05-14T00:00:00.000Z",
          metadata: "issueType=Story; status=DEV COMPLETE; priority=Medium",
        },
      },
    },
    {
      id: "node_estimate_source",
      type: "contextNode",
      position: { x: -310, y: 300 },
      data: {
        canvasType: "source_snapshot",
        title: "Support & Feedback Estimate",
        tags: ["confluence", "estimate"],
        updatedAt: createdAt,
        fields: {
          sourceType: "confluence",
          sourceId: "452067329",
          sourceUrl: "https://gogira-platform.atlassian.net/wiki/spaces/GoGira/pages/452067329/Support+Feedback+Estimate",
          rawText:
            "Estimate page includes Help Center access, landing and search shell, FAQ module, Multimedia Content & Tips, Contact Support form, content setup, integration polish, QA/UAT, and workstream-level frontend/backend effort.",
          summary:
            "Planning source for the CR estimate. Current page frames Help Center as 3-4 calendar weeks in addition to broader Support & Feedback work.",
          fetchedAt: "2026-05-14T00:00:00.000Z",
          metadata: "space=GoGira; pageTitle=Support & Feedback Estimate",
        },
      },
    },
    {
      id: "node_figma",
      type: "contextNode",
      position: { x: 80, y: -160 },
      data: {
        canvasType: "link",
        title: "Figma Help Center Reference",
        tags: ["design"],
        updatedAt: createdAt,
        fields: {
          url: "https://www.figma.com/design/a881lyhzKFF92802CCIuwR/GoGira---School?node-id=3255-38085&t=KKkxU4MN61j1iX34-4",
          sourceType: "figma",
          summary: "Design reference cited by GGR-5534 acceptance criteria.",
          lastFetchedAt: "",
        },
      },
    },
    {
      id: "node_req_access",
      type: "contextNode",
      position: { x: 540, y: -120 },
      data: {
        canvasType: "requirement",
        title: "Help Center Access",
        tags: ["frontend"],
        updatedAt: createdAt,
        fields: {
          body:
            "Users can access Help Center globally from side navigation across modules. The entry opens a dedicated Help Center interface with landing and navigation options.",
          priority: "High",
          status: "Estimated",
          sourceNodeIds: "node_jira_source,node_figma",
        },
      },
    },
    {
      id: "node_req_content",
      type: "contextNode",
      position: { x: 560, y: 120 },
      data: {
        canvasType: "requirement",
        title: "FAQ And Helpful Content",
        tags: ["content", "frontend", "backend"],
        updatedAt: createdAt,
        fields: {
          body:
            "Help Center includes categorized FAQ with expand/collapse answers and backend-driven articles, guides, videos, thumbnails, list/grid views, and detail pages.",
          priority: "High",
          status: "Estimated",
          sourceNodeIds: "node_jira_source,node_estimate_source,node_figma",
        },
      },
    },
    {
      id: "node_req_contact",
      type: "contextNode",
      position: { x: 555, y: 360 },
      data: {
        canvasType: "requirement",
        title: "Contact Support Submission",
        tags: ["support", "upload"],
        updatedAt: createdAt,
        fields: {
          body:
            "Users can submit a support request with identity/contact fields, category or feedback option, description/message, image or file attachment, submit handling, success confirmation, and return to Help Center.",
          priority: "High",
          status: "Estimated",
          sourceNodeIds: "node_jira_source,node_estimate_source",
        },
      },
    },
    {
      id: "node_req_cr_output",
      type: "contextNode",
      position: { x: 100, y: 470 },
      data: {
        canvasType: "requirement",
        title: "Client Change Request Output",
        tags: ["client-facing", "estimate"],
        updatedAt: createdAt,
        fields: {
          body:
            "The final client-facing CR package must include scope, estimate, frontend/backend/QA split, assumptions, dependencies, integration points, and excluded work before approval.",
          priority: "High",
          status: "Ready",
          sourceNodeIds: "node_contract,node_jira_source,node_estimate_source",
        },
      },
    },
  ],
  edges: [
    {
      id: "edge_jira_contract",
      source: "node_jira_source",
      target: "node_contract",
      type: "smoothstep",
      label: "requirement source",
      data: { relationship: "requirement source", updatedAt: createdAt },
    },
    {
      id: "edge_estimate_contract",
      source: "node_estimate_source",
      target: "node_contract",
      type: "smoothstep",
      label: "references",
      data: { relationship: "references", updatedAt: createdAt },
    },
    {
      id: "edge_figma_contract",
      source: "node_figma",
      target: "node_contract",
      type: "smoothstep",
      label: "design reference",
      data: { relationship: "design reference", updatedAt: createdAt },
    },
    {
      id: "edge_access_contract",
      source: "node_contract",
      target: "node_req_access",
      type: "smoothstep",
      label: "implements",
      data: { relationship: "implements", updatedAt: createdAt },
    },
    {
      id: "edge_content_contract",
      source: "node_contract",
      target: "node_req_content",
      type: "smoothstep",
      label: "implements",
      data: { relationship: "implements", updatedAt: createdAt },
    },
    {
      id: "edge_contact_contract",
      source: "node_contract",
      target: "node_req_contact",
      type: "smoothstep",
      label: "implements",
      data: { relationship: "implements", updatedAt: createdAt },
    },
    {
      id: "edge_output_contract",
      source: "node_contract",
      target: "node_req_cr_output",
      type: "smoothstep",
      label: "implements",
      data: { relationship: "implements", updatedAt: createdAt },
    },
  ],
};

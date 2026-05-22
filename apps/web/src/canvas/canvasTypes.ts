import type { Edge, Node, Viewport } from "@xyflow/react";

export type CanvasNodeType =
  | "project_contract"
  | "note"
  | "requirement"
  | "image"
  | "link"
  | "source_snapshot";

export type SourceType = "confluence" | "jira" | "figma" | "github" | "generic";

export type CanvasNodeData = {
  canvasType: CanvasNodeType;
  title: string;
  fields: Record<string, string>;
  tags: string[];
  updatedAt: string;
  highlighted?: boolean;
};

export type CanvasEdgeData = {
  relationship: string;
  updatedAt: string;
};

export type CanvasFlowNode = Node<CanvasNodeData, "contextNode">;
export type CanvasFlowEdge = Edge<CanvasEdgeData>;

export type CanvasProject = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  viewport?: Viewport;
};

export type CanvasSnapshot = {
  project: CanvasProject;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
};

export type AnalysisFinding = {
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  citationNodeIds: string[];
};

export type AnalysisResponse = {
  status: "ok" | "needs_context";
  summary: string;
  findings: AnalysisFinding[];
  missingContext: string[];
  suggestedNextSteps: string[];
  citations: Array<{ nodeId: string; title: string }>;
};

export type ChatThread = {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  analysis?: AnalysisResponse;
  createdAt: string;
};

export const NODE_TYPE_LABELS: Record<CanvasNodeType, string> = {
  project_contract: "Project Contract",
  note: "Note",
  requirement: "Requirement",
  image: "Image",
  link: "Link",
  source_snapshot: "Source Snapshot",
};

export const EDGE_RELATIONSHIPS = [
  "references",
  "clarifies",
  "depends on",
  "implements",
  "design reference",
  "requirement source",
  "test coverage",
] as const;

export function defaultFieldsForType(): Record<string, string> {
  return {
    content: "",
  };
}

export function titleForType(type: CanvasNodeType) {
  return NODE_TYPE_LABELS[type];
}

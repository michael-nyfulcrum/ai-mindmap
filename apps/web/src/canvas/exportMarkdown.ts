import type { CanvasFlowEdge, CanvasFlowNode, CanvasProject, CanvasNodeType } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";

const SECTION_ORDER: CanvasNodeType[] = [
  "project_contract",
  "requirement",
  "source_snapshot",
  "link",
  "image",
  "note",
];

/** Render the canvas as a structured Markdown document for sharing or handoff. */
export function buildCanvasMarkdown(
  project: CanvasProject,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string {
  const lines: string[] = [`# ${project.name || "Untitled canvas"}`, ""];
  if (project.description) {
    lines.push(project.description, "");
  }

  const titleById = new Map(nodes.map((node) => [node.id, node.data.title || "Untitled"]));

  for (const type of SECTION_ORDER) {
    const inSection = nodes.filter((node) => node.data.canvasType === type);
    if (inSection.length === 0) {
      continue;
    }
    lines.push(`## ${NODE_TYPE_LABELS[type]}`, "");
    for (const node of inSection) {
      lines.push(`### ${node.data.title || "Untitled"}`);
      if (node.data.tags.length > 0) {
        lines.push(`*Tags: ${node.data.tags.join(", ")}*`);
      }
      const content = (node.data.fields.content ?? "").trim();
      lines.push("", content || "_No content_", "");
    }
  }

  if (edges.length > 0) {
    lines.push("## Relationships", "");
    for (const edge of edges) {
      const relationship = edge.data?.relationship ?? "references";
      lines.push(`- ${titleById.get(edge.source) ?? edge.source} — *${relationship}* → ${titleById.get(edge.target) ?? edge.target}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

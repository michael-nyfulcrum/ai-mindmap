import { Clipboard, X } from "lucide-react";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasProject } from "./canvasTypes";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";

type DeveloperHandoffPanelProps = {
  project: CanvasProject;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  onClose: () => void;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787";
const MCP_URL = import.meta.env.VITE_MCP_URL ?? "http://127.0.0.1:8790/mcp";

export function DeveloperHandoffPanel({ project, nodes, edges, onClose }: DeveloperHandoffPanelProps) {
  const prompt = buildDeveloperPrompt(project, nodes, edges);
  const requirementCount = nodes.filter((node) => node.data.canvasType === "requirement").length;
  const flaggedCount = nodes.filter((node) => node.data.impact).length;

  return (
    <div className="handoff-backdrop" role="dialog" aria-modal="true" aria-label="Developer handoff">
      <Panel
        title="Developer Handoff"
        className="handoff-panel"
        actions={
          <Button icon={<X size={15} />} variant="ghost" onClick={onClose} aria-label="Close developer handoff" title="Close developer handoff" />
        }
      >
        <div className="handoff-content">
          <div className="handoff-stats">
            <span>{project.id}</span>
            <span>{requirementCount} requirements</span>
            <span>{flaggedCount} flags</span>
            <span>{edges.length} relationships</span>
          </div>

          <section className="handoff-section">
            <h3>Endpoints</h3>
            <code>{API_BASE_URL}</code>
            <code>{MCP_URL}</code>
          </section>

          <section className="handoff-section">
            <h3>Agent Prompt</h3>
            <textarea value={prompt} readOnly rows={14} />
            <Button
              icon={<Clipboard size={15} />}
              variant="primary"
              onClick={() => {
                void navigator.clipboard?.writeText(prompt);
              }}
            >
              Copy
            </Button>
          </section>
        </div>
      </Panel>
    </div>
  );
}

function buildDeveloperPrompt(project: CanvasProject, nodes: CanvasFlowNode[], edges: CanvasFlowEdge[]) {
  const requirements = nodes.filter((node) => node.data.canvasType === "requirement");
  const contract = nodes.find((node) => node.data.canvasType === "project_contract");
  const flagged = nodes.filter((node) => node.data.impact);

  return [
    "Use Context Canvas as the source of truth before coding.",
    "",
    `Project ID: ${project.id}`,
    `Project name: ${project.name}`,
    `MCP endpoint: ${MCP_URL}`,
    "",
    "In Claude Code, Codex, or another MCP-capable coding agent:",
    "1. Connect the Context Canvas MCP server.",
    "2. Call list_canvas_projects and select the project above.",
    "3. Call get_canvas_context with this project ID and your current implementation task.",
    "4. Treat project contract, requirement nodes, active impact flags, and recent contract changes as required context.",
    "5. If implementation decisions change requirements, call upsert_requirement_node or upsert_source_snapshot_node instead of editing hidden state.",
    "",
    contract ? `Contract: ${contract.data.title} (${contract.id})` : "Contract: not saved yet",
    `Requirements: ${requirements.map((node) => `${node.data.title} (${node.id})`).join(", ") || "none"}`,
    `Relationships: ${edges.length}`,
    "",
    "Active impact flags:",
    ...(flagged.length
      ? flagged.map((node) => `- ${node.data.title} (${node.id}): ${node.data.impact?.status} - ${node.data.impact?.reason}`)
      : ["- none"]),
  ].join("\n");
}

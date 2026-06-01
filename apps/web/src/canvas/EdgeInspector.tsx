import { PanelRightClose } from "lucide-react";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { EDGE_RELATIONSHIPS, type CanvasFlowEdge, type CanvasFlowNode } from "./canvasTypes";

type EdgeInspectorProps = {
  edge: CanvasFlowEdge;
  nodes: CanvasFlowNode[];
  onUpdateLabel: (edgeId: string, relationship: string) => void;
  onCollapse: () => void;
};

export function EdgeInspector({ edge, nodes, onUpdateLabel, onCollapse }: EdgeInspectorProps) {
  const sourceTitle = nodeTitle(nodes, edge.source);
  const targetTitle = nodeTitle(nodes, edge.target);
  const relationship = String(edge.label || edge.data?.relationship || "references");

  return (
    <Panel
      title="Details"
      className="inspector-panel"
      actions={
        <Button icon={<PanelRightClose size={15} />} variant="ghost" onClick={onCollapse} aria-label="Collapse details" title="Collapse details" />
      }
    >
      <div className="inspector-content">
        <header className="inspector-head inspector-head-link">
          <div className="inspector-head-row">
            <span className="inspector-kicker">Connection</span>
          </div>
          <input
            className="inspector-title-input"
            list="edge-relationship-options"
            value={relationship}
            placeholder="How are these related?"
            aria-label="Relationship"
            onChange={(event) => onUpdateLabel(edge.id, event.target.value)}
          />
          <datalist id="edge-relationship-options">
            {EDGE_RELATIONSHIPS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </header>

        <section className="inspector-section relationship-list">
          <h3>Linked Nodes</h3>
          <span>From: {sourceTitle}</span>
          <span>To: {targetTitle}</span>
        </section>
      </div>
    </Panel>
  );
}

function nodeTitle(nodes: CanvasFlowNode[], nodeId: string) {
  return nodes.find((node) => node.id === nodeId)?.data.title ?? nodeId;
}

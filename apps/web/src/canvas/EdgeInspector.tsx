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
      title="Inspector"
      className="inspector-panel"
      actions={
        <Button icon={<PanelRightClose size={15} />} variant="ghost" onClick={onCollapse} aria-label="Collapse inspector" title="Collapse inspector" />
      }
    >
      <div className="inspector-content">
        <section className="inspector-summary">
          <span>Relationship</span>
          <strong>{relationship}</strong>
        </section>

        <section className="inspector-section relationship-list">
          <h3>Connected Nodes</h3>
          <span>From: {sourceTitle}</span>
          <span>To: {targetTitle}</span>
        </section>

        <section className="inspector-section">
          <h3>Label</h3>
          <div className="form-stack">
            <label>
              <span>Relationship</span>
              <input
                list="edge-relationship-options"
                value={relationship}
                onChange={(event) => onUpdateLabel(edge.id, event.target.value)}
              />
            </label>
            <datalist id="edge-relationship-options">
              {EDGE_RELATIONSHIPS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
        </section>
      </div>
    </Panel>
  );
}

function nodeTitle(nodes: CanvasFlowNode[], nodeId: string) {
  return nodes.find((node) => node.id === nodeId)?.data.title ?? nodeId;
}

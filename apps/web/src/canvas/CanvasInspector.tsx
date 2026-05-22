import { useMemo } from "react";
import { PanelRightClose } from "lucide-react";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeData } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { Textarea } from "../shared/ui/Textarea";

type CanvasInspectorProps = {
  activeNode: CanvasFlowNode;
  allEdges: CanvasFlowEdge[];
  onUpdateNode: (nodeId: string, data: CanvasNodeData) => void;
  onCollapse: () => void;
};

export function CanvasInspector({
  activeNode,
  allEdges,
  onUpdateNode,
  onCollapse,
}: CanvasInspectorProps) {
  const relationships = useMemo(() => {
    return allEdges.filter((edge) => edge.source === activeNode.id || edge.target === activeNode.id);
  }, [activeNode, allEdges]);

  const updateField = (field: string, value: string) => {
    onUpdateNode(activeNode.id, {
      ...activeNode.data,
      fields: { ...activeNode.data.fields, [field]: value },
      updatedAt: new Date().toISOString(),
    });
  };

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
          <span>{NODE_TYPE_LABELS[activeNode.data.canvasType]}</span>
          <strong>{activeNode.data.title}</strong>
        </section>

        <section className="inspector-section">
          <h3>Details</h3>
          <div className="form-stack">
            <label>
              <span>Title</span>
              <input
                value={activeNode.data.title}
                onChange={(event) =>
                  onUpdateNode(activeNode.id, {
                    ...activeNode.data,
                    title: event.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
            </label>
            <label>
              <span>Tags</span>
              <input
                value={activeNode.data.tags.join(", ")}
                onChange={(event) =>
                  onUpdateNode(activeNode.id, {
                    ...activeNode.data,
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
            </label>
          </div>
        </section>

        <section className="inspector-section">
          <h3>Fields</h3>
          <div className="form-stack">
            {Object.entries(activeNode.data.fields).map(([field, value]) => (
              <label key={field}>
                <span>{titleCaseField(field)}</span>
                {value.length > 80 || ["body", "summary", "rawText", "scope", "requirements", "acceptanceCriteria"].includes(field) ? (
                  <Textarea value={value} onChange={(event) => updateField(field, event.target.value)} rows={5} />
                ) : (
                  <input value={value} onChange={(event) => updateField(field, event.target.value)} />
                )}
              </label>
            ))}
          </div>
        </section>

        <section className="inspector-section relationship-list">
          <h3>Relationships</h3>
          {relationships.length === 0 ? (
            <p>No connected relationships.</p>
          ) : (
            relationships.map((edge) => (
              <span key={edge.id}>
                {edge.source === activeNode.id ? "Outgoing" : "Incoming"}: {titleCaseField(String(edge.label || edge.data?.relationship || ""))}
              </span>
            ))
          )}
        </section>
      </div>
    </Panel>
  );
}

function titleCaseField(value: string) {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (["id", "ids", "url", "urls", "api"].includes(lower)) {
        return lower.toUpperCase();
      }
      if (lower === "ai") {
        return "AI";
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

import { useEffect, useMemo, useState } from "react";
import { History, PanelRightClose, WandSparkles } from "lucide-react";
import { listNodeVersions } from "../api/canvasApi";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeData, ContractChangeVersion, ImpactStatus } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { Textarea } from "../shared/ui/Textarea";

type CanvasInspectorProps = {
  projectId: string;
  activeNode: CanvasFlowNode;
  allEdges: CanvasFlowEdge[];
  onUpdateNode: (nodeId: string, data: CanvasNodeData) => void;
  onRequestImpactPlan: (node: CanvasFlowNode) => void;
  onCollapse: () => void;
};

export function CanvasInspector({
  projectId,
  activeNode,
  allEdges,
  onUpdateNode,
  onRequestImpactPlan,
  onCollapse,
}: CanvasInspectorProps) {
  const [versionResult, setVersionResult] = useState<{
    nodeId: string;
    versions: ContractChangeVersion[];
    status: "idle" | "error";
  }>({ nodeId: "", versions: [], status: "idle" });
  const relationships = useMemo(() => {
    return allEdges.filter((edge) => edge.source === activeNode.id || edge.target === activeNode.id);
  }, [activeNode, allEdges]);
  const audit = activeNode.data.audit;
  const impact = activeNode.data.impact;
  const isVersionedNode = ["project_contract", "requirement"].includes(activeNode.data.canvasType);
  const versions = isVersionedNode && versionResult.nodeId === activeNode.id ? versionResult.versions : [];
  const versionState = !isVersionedNode
    ? "idle"
    : versionResult.nodeId === activeNode.id
      ? versionResult.status
      : "loading";

  useEffect(() => {
    let cancelled = false;
    if (!projectId || !isVersionedNode) {
      return;
    }

    listNodeVersions({ projectId, nodeId: activeNode.id })
      .then((result) => {
        if (!cancelled) {
          setVersionResult({ nodeId: activeNode.id, versions: result.versions, status: "idle" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersionResult({ nodeId: activeNode.id, versions: [], status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeNode.id, isVersionedNode, projectId]);

  const updateContent = (value: string) => {
    onUpdateNode(activeNode.id, {
      ...activeNode.data,
      fields: { content: value },
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
          {impact ? <ImpactBadge status={impact.status} /> : null}
        </section>

        {impact ? (
          <section className="inspector-section impact-panel">
            <h3>Change Impact</h3>
            <p>{impact.reason}</p>
            <small>
              Flagged from version {shortVersionId(impact.sourceVersionId)} on {formatAuditDate(impact.updatedAt)}
            </small>
            <Button icon={<WandSparkles size={14} />} variant="primary" onClick={() => onRequestImpactPlan(activeNode)}>
              Draft Plan
            </Button>
          </section>
        ) : null}

        {audit ? (
          <section className="inspector-section audit-grid">
            <h3>Audit</h3>
            <dl>
              <div>
                <dt>Created</dt>
                <dd>{audit.createdBy} - {formatAuditDate(audit.createdAt)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{audit.updatedBy} - {formatAuditDate(audit.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        ) : null}

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
          <h3>Content</h3>
          <div className="form-stack">
            <label>
              <span>Content</span>
              <Textarea value={activeNode.data.fields.content ?? ""} onChange={(event) => updateContent(event.target.value)} rows={10} />
            </label>
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

        {isVersionedNode ? (
          <section className="inspector-section version-history">
            <h3>
              <History size={13} />
              Version History
            </h3>
            {versionState === "loading" ? <p>Loading history...</p> : null}
            {versionState === "error" ? <p>Version history unavailable.</p> : null}
            {versionState === "idle" && versions.length === 0 ? <p>No semantic changes recorded yet.</p> : null}
            {versions.slice(0, 6).map((version) => (
              <article key={version.id}>
                <div>
                  <strong>v{version.versionNumber}</strong>
                  <span>{version.changeType}</span>
                </div>
                <p>{version.summary}</p>
                <small>
                  {version.createdBy} - {formatAuditDate(version.createdAt)}
                  {version.affectedNodes.length > 0 ? ` - ${version.affectedNodes.length} affected` : ""}
                </small>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </Panel>
  );
}

function ImpactBadge({ status }: { status: ImpactStatus }) {
  return <em className={`impact-badge impact-badge-${status}`}>{impactLabel(status)}</em>;
}

function impactLabel(status: ImpactStatus) {
  if (status === "needs_update") {
    return "Needs update";
  }
  return titleCaseField(status);
}

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortVersionId(value: string) {
  return value.replace(/^version_/, "").slice(0, 8);
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

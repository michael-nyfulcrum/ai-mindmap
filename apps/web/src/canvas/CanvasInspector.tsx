import { memo, useEffect, useState } from "react";
import { History, Maximize2, PanelRightClose, WandSparkles } from "lucide-react";
import { listNodeVersions } from "../api/canvasApi";
import type { CanvasFlowNode, CanvasNodeData, ContractChangeVersion, ImpactStatus } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { Textarea } from "../shared/ui/Textarea";
import { ContentEditorModal } from "./ContentEditorModal";
import { DiffStat, DiffView } from "./DiffView";

type CanvasInspectorProps = {
  projectId: string;
  activeNode: CanvasFlowNode;
  onUpdateNode: (nodeId: string, data: CanvasNodeData) => void;
  onRequestImpactPlan: (node: CanvasFlowNode) => void;
  onCollapse: () => void;
};

export const CanvasInspector = memo(function CanvasInspector({
  projectId,
  activeNode,
  onUpdateNode,
  onRequestImpactPlan,
  onCollapse,
}: CanvasInspectorProps) {
  const [versionResult, setVersionResult] = useState<{
    nodeId: string;
    versions: ContractChangeVersion[];
    status: "idle" | "error";
  }>({ nodeId: "", versions: [], status: "idle" });
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [editorBaseline, setEditorBaseline] = useState<string | null>(null);

  const audit = activeNode.data.audit;
  const impact = activeNode.data.impact;
  const content = activeNode.data.fields.content ?? "";
  const isVersionedNode = ["project_contract", "requirement"].includes(activeNode.data.canvasType);
  const versions = isVersionedNode && versionResult.nodeId === activeNode.id ? versionResult.versions : [];
  const versionState = !isVersionedNode
    ? "idle"
    : versionResult.nodeId === activeNode.id
      ? versionResult.status
      : "loading";
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;

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

  const patchNode = (patch: Partial<CanvasNodeData>) => {
    onUpdateNode(activeNode.id, {
      ...activeNode.data,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateContent = (value: string) => {
    patchNode({ fields: { content: value } });
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
          <div className="inspector-summary-row">
            <span>{NODE_TYPE_LABELS[activeNode.data.canvasType]}</span>
            {impact ? <ImpactBadge status={impact.status} /> : null}
          </div>
          <strong>{activeNode.data.title || "Untitled"}</strong>
        </section>

        {impact ? (
          <section className="inspector-card impact-panel">
            <div className="inspector-card-head">
              <h3>Change Impact</h3>
            </div>
            <p>{impact.reason}</p>
            <small>
              Flagged from version {shortVersionId(impact.sourceVersionId)} on {formatAuditDate(impact.updatedAt)}
            </small>
            <Button icon={<WandSparkles size={14} />} variant="primary" onClick={() => onRequestImpactPlan(activeNode)}>
              Draft Plan
            </Button>
          </section>
        ) : null}

        <section className="inspector-section">
          <h3>Details</h3>
          <div className="form-stack">
            <label>
              <span>Title</span>
              <input value={activeNode.data.title} onChange={(event) => patchNode({ title: event.target.value })} />
            </label>
            <label>
              <span>Tags</span>
              <input
                value={activeNode.data.tags.join(", ")}
                placeholder="comma, separated"
                onChange={(event) =>
                  patchNode({
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-section-head">
            <h3>Content</h3>
            <button
              type="button"
              className="inspector-link-button"
              onClick={() => setEditorBaseline(content)}
              title="Open full editor"
            >
              <Maximize2 size={13} /> Expand
            </button>
          </div>
          <Textarea
            className="inspector-content-area"
            value={content}
            onChange={(event) => updateContent(event.target.value)}
            rows={9}
            placeholder="Write in Markdown… click Expand for the full editor."
          />
        </section>

        {isVersionedNode ? (
          <section className="inspector-section version-history">
            <div className="inspector-section-head">
              <h3>
                <History size={13} /> Version History
              </h3>
              {versions.length > 0 ? (
                <select
                  className="version-select"
                  value={selectedVersion?.id ?? ""}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  aria-label="Select version"
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      v{version.versionNumber} · {titleCaseField(version.changeType)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {versionState === "loading" ? <p className="version-note">Loading history…</p> : null}
            {versionState === "error" ? <p className="version-note">Version history unavailable.</p> : null}
            {versionState === "idle" && versions.length === 0 ? (
              <p className="version-note">No semantic changes recorded yet.</p>
            ) : null}

            {selectedVersion ? (
              <article className="version-detail">
                <div className="version-detail-head">
                  <span className={`change-pill change-pill-${selectedVersion.changeType}`}>
                    {titleCaseField(selectedVersion.changeType)}
                  </span>
                  <DiffStat before={selectedVersion.contentBefore ?? ""} after={selectedVersion.contentAfter ?? ""} />
                </div>
                <p className="version-summary">{selectedVersion.summary}</p>
                {selectedVersion.changedFields.length > 0 ? (
                  <div className="version-fields">
                    {selectedVersion.changedFields.map((field) => (
                      <span key={field}>{titleCaseField(field)}</span>
                    ))}
                  </div>
                ) : null}
                <DiffView
                  before={selectedVersion.contentBefore ?? ""}
                  after={selectedVersion.contentAfter ?? ""}
                  emptyLabel="No content changes in this version."
                />
                <small className="version-foot">
                  {selectedVersion.createdBy} · {formatAuditDate(selectedVersion.createdAt)}
                  {selectedVersion.affectedNodes.length > 0
                    ? ` · ${selectedVersion.affectedNodes.length} node${selectedVersion.affectedNodes.length === 1 ? "" : "s"} affected`
                    : ""}
                </small>
              </article>
            ) : null}
          </section>
        ) : null}

        {audit ? (
          <section className="inspector-section audit-grid">
            <h3>Audit</h3>
            <dl>
              <div>
                <dt>Created</dt>
                <dd>{audit.createdBy} · {formatAuditDate(audit.createdAt)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{audit.updatedBy} · {formatAuditDate(audit.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>

      {editorBaseline !== null ? (
        <ContentEditorModal
          title={activeNode.data.title || "Untitled"}
          typeLabel={NODE_TYPE_LABELS[activeNode.data.canvasType]}
          value={content}
          baseline={editorBaseline}
          onChange={updateContent}
          onClose={() => setEditorBaseline(null)}
        />
      ) : null}
    </Panel>
  );
});

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

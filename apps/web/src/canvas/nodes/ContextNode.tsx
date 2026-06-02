import { memo } from "react";
import { Handle, NodeResizer, NodeToolbar, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { AlertCircle, CheckCircle2, Crosshair, FileText, Image, Link2, ScrollText, Trash2 } from "lucide-react";
import type { CanvasFlowNode, CanvasNodeType, ImpactStatus } from "../canvasTypes";
import { NODE_TYPE_LABELS } from "../canvasTypes";

const nodeIcons: Record<CanvasNodeType, typeof FileText> = {
  project_contract: ScrollText,
  note: FileText,
  requirement: CheckCircle2,
  image: Image,
  link: Link2,
  source_snapshot: AlertCircle,
};

export const ContextNode = memo(function ContextNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const Icon = nodeIcons[data.canvasType];
  const content = data.fields.content ?? "";
  const imageUrl = data.canvasType === "image" ? imageUrlFromContent(content) : "";
  const preview = previewText(content);
  const { deleteElements, fitView } = useReactFlow();

  const impact = data.impact;
  const proposed = data.proposed;

  return (
    <article
      className={[
        "context-node",
        `context-node-${data.canvasType}`,
        selected ? "is-active" : "",
        data.highlighted ? "is-highlighted" : "",
        impact ? `has-impact impact-${impact.status}` : "",
        proposed ? `is-proposed proposed-${proposed}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {proposed ? <span className="context-node-proposed-badge">Proposed</span> : null}
      {!proposed && data.canvasType === "project_contract" ? (
        <NodeResizer isVisible={selected} minWidth={240} minHeight={140} lineClassName="context-node-resize-line" handleClassName="context-node-resize-handle" />
      ) : null}
      {!proposed ? (
        <NodeToolbar isVisible={selected} position={Position.Top} className="node-toolbar-actions">
          <button
            type="button"
            title="Focus node"
            onClick={() => void fitView({ nodes: [{ id }], duration: 320, padding: 0.6 })}
          >
            <Crosshair size={14} />
          </button>
          <button
            type="button"
            title="Delete node"
            className="node-toolbar-danger"
            onClick={() => void deleteElements({ nodes: [{ id }] })}
          >
            <Trash2 size={14} />
          </button>
        </NodeToolbar>
      ) : null}
      <Handle type="target" position={Position.Left} />
      <header className="context-node-header">
        <span className="context-node-icon">
          <Icon size={15} />
        </span>
        <div>
          <div className="context-node-kicker">{NODE_TYPE_LABELS[data.canvasType]}</div>
          <h3>{data.title}</h3>
        </div>
      </header>
      {impact ? (
        <div className="context-node-impact">
          <span>{impactLabel(impact.status)}</span>
        </div>
      ) : null}
      <div className="context-node-body">
        {imageUrl ? (
          <img className="context-node-image-preview" src={imageUrl} alt={data.title} />
        ) : null}
        {preview ? <p>{preview}</p> : null}
      </div>
      {data.tags.length > 0 ? (
        <footer className="context-node-tags">
          {data.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </footer>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </article>
  );
});

function imageUrlFromContent(content: string) {
  const markdownImage = content.match(/!\[[^\]]*]\(([^)]+)\)/);
  if (markdownImage?.[1]) {
    return markdownImage[1].trim();
  }
  const firstUrl = content.match(/https?:\/\/\S+/);
  return firstUrl?.[0] ?? "";
}

function impactLabel(status: ImpactStatus) {
  if (status === "needs_update") {
    return "Needs update";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function previewText(content: string) {
  return content
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

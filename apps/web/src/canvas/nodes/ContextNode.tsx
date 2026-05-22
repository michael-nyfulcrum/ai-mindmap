import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertCircle, CheckCircle2, FileText, Image, Link2, ScrollText } from "lucide-react";
import type { CanvasFlowNode, CanvasNodeType } from "../canvasTypes";
import { NODE_TYPE_LABELS } from "../canvasTypes";

const nodeIcons: Record<CanvasNodeType, typeof FileText> = {
  project_contract: ScrollText,
  note: FileText,
  requirement: CheckCircle2,
  image: Image,
  link: Link2,
  source_snapshot: AlertCircle,
};

const previewFields: Partial<Record<CanvasNodeType, string[]>> = {
  project_contract: ["goal", "scope"],
  note: ["body"],
  requirement: ["body", "priority", "status"],
  image: ["altText", "notes"],
  link: ["sourceType", "url", "summary"],
  source_snapshot: ["sourceType", "summary", "fetchedAt"],
};

export const ContextNode = memo(function ContextNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const Icon = nodeIcons[data.canvasType];
  const fieldKeys = previewFields[data.canvasType] ?? [];

  return (
    <article className={`context-node context-node-${data.canvasType} ${selected ? "is-active" : ""} ${data.highlighted ? "is-highlighted" : ""}`}>
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
      <div className="context-node-body">
        {data.canvasType === "image" && data.fields.assetUrl ? (
          <img className="context-node-image-preview" src={data.fields.assetUrl} alt={data.fields.altText || data.title} />
        ) : null}
        {fieldKeys.map((key) => {
          const value = data.fields[key];
          if (!value) {
            return null;
          }

          return (
            <p key={key}>
              <strong>{titleCaseField(key)}</strong>
              <span>{value}</span>
            </p>
          );
        })}
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

function titleCaseField(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["id", "ids", "url", "urls", "api"].includes(lower)) {
        return lower.toUpperCase();
      }
      return lower === "ai" ? "AI" : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

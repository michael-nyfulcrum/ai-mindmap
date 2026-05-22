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

export const ContextNode = memo(function ContextNode({ data, selected }: NodeProps<CanvasFlowNode>) {
  const Icon = nodeIcons[data.canvasType];
  const content = data.fields.content ?? "";
  const imageUrl = data.canvasType === "image" ? imageUrlFromContent(content) : "";
  const preview = previewText(content);

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

function previewText(content: string) {
  return content
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

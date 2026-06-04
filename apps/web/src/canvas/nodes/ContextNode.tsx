import { memo } from "react";
import { Handle, NodeToolbar, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, CheckCircle2, Crosshair, FileCode2, FileText, Image, Link2, Lock, LockOpen, ScrollText, Trash2 } from "lucide-react";
import type { CanvasFlowNode, CanvasNodeType, ImpactStatus } from "../canvasTypes";
import { NODE_TYPE_LABELS } from "../canvasTypes";

const nodeIcons: Record<CanvasNodeType, typeof FileText> = {
  project_contract: ScrollText,
  note: FileText,
  requirement: CheckCircle2,
  image: Image,
  link: Link2,
  source_snapshot: AlertCircle,
  spec: FileCode2,
};

const NOTE_ACCENTS = ["#f0a429", "#3fc46b", "#4a9eff", "#e879b9", "#b78cff"];

export const ContextNode = memo(function ContextNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const Icon = nodeIcons[data.canvasType];
  const content = data.fields.content ?? "";
  const imageUrl = data.canvasType === "image" ? imageUrlFromContent(content) : "";
  // The image is shown as a preview above, so strip its Markdown from the body.
  const markdownBody = (imageUrl ? content.replace(/!\[[^\]]*]\([^)]+\)/g, "") : content).trim();
  const { deleteElements, fitView, updateNodeData } = useReactFlow();
  const locked = data.locked ?? false;
  const accent = data.accent;

  const impact = data.impact;
  const proposed = data.proposed;

  return (
    <article
      style={accent ? { borderTopColor: accent, borderTopWidth: 2 } : undefined}
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
            title={locked ? "Unlock node" : "Lock node position"}
            onClick={() => updateNodeData(id, { locked: !locked })}
          >
            {locked ? <Lock size={14} /> : <LockOpen size={14} />}
          </button>
          {data.canvasType === "note" ? (
            <span className="node-toolbar-swatches">
              {NOTE_ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={accent === color ? "Clear color" : "Set color"}
                  className={accent === color ? "node-swatch is-on" : "node-swatch"}
                  style={{ background: color }}
                  onClick={() => updateNodeData(id, { accent: accent === color ? undefined : color })}
                />
              ))}
            </span>
          ) : null}
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
        {locked ? (
          <span className="context-node-lock" title="Locked">
            <Lock size={12} />
          </span>
        ) : null}
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
        {markdownBody ? (
          <div className="context-node-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="nodrag"
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {markdownBody}
            </ReactMarkdown>
          </div>
        ) : null}
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

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, Search } from "lucide-react";
import type { CanvasFlowNode } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";
import { useModalDismiss } from "../shared/useModalDismiss";

type CommandPaletteProps = {
  nodes: CanvasFlowNode[];
  onSelect: (nodeId: string) => void;
  onHighlight?: (nodeIds: string[]) => void;
  onClose: () => void;
};

export function CommandPalette({ nodes, onSelect, onHighlight, onClose }: CommandPaletteProps) {
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = nodes.filter((node) => {
      if (node.data.proposed) {
        return false;
      }
      if (!q) {
        return true;
      }
      const title = node.data.title.toLowerCase();
      const type = NODE_TYPE_LABELS[node.data.canvasType].toLowerCase();
      const content = (node.data.fields.content ?? "").toLowerCase();
      return title.includes(q) || type.includes(q) || content.includes(q);
    });
    return matches.slice(0, 50);
  }, [nodes, query]);

  // Keep the highlighted row valid as the result set shrinks.
  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  // Spotlight matching nodes on the canvas while searching; clear on close.
  useEffect(() => {
    onHighlight?.(query.trim() ? results.map((node) => node.id) : []);
  }, [query, results, onHighlight]);

  useEffect(() => {
    return () => onHighlight?.([]);
  }, [onHighlight]);

  const choose = (node: CanvasFlowNode | undefined) => {
    if (!node) {
      return;
    }
    onSelect(node.id);
    onClose();
  };

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="command-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Find a node"
      onMouseDown={onClose}
    >
      <div className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search">
          <Search size={16} />
          <input
            autoFocus
            type="text"
            value={query}
            placeholder="Find a node by title, type, or content…"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex(Math.min(safeIndex + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex(Math.max(safeIndex - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(results[safeIndex]);
              }
            }}
          />
        </div>
        <ul className="command-results" role="listbox">
          {results.length === 0 ? (
            <li className="command-empty">No matching nodes.</li>
          ) : (
            results.map((node, index) => (
              <li key={node.id} role="option" aria-selected={index === safeIndex}>
                <button
                  type="button"
                  className={index === safeIndex ? "command-item is-active" : "command-item"}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(node)}
                >
                  <span className="command-item-type">{NODE_TYPE_LABELS[node.data.canvasType]}</span>
                  <span className="command-item-title">{node.data.title || "Untitled"}</span>
                  {index === safeIndex ? <CornerDownLeft size={13} className="command-item-enter" /> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

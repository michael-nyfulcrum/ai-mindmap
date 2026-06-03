import { useEffect, useRef, useState } from "react";
import { Check, Filter } from "lucide-react";
import type { CanvasNodeType } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";

const TYPES: CanvasNodeType[] = ["project_contract", "requirement", "source_snapshot", "link", "image", "note"];

type CanvasTypeFilterProps = {
  active: Set<CanvasNodeType>;
  onToggle: (type: CanvasNodeType) => void;
  onClear: () => void;
};

export function CanvasTypeFilter({ active, onToggle, onClear }: CanvasTypeFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="canvas-filter" ref={ref}>
      <button
        type="button"
        className={active.size ? "canvas-filter-btn is-on" : "canvas-filter-btn"}
        onClick={() => setOpen((value) => !value)}
        aria-label="Filter by node type"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Filter by node type"
      >
        <Filter size={15} />
        {active.size ? <span className="canvas-filter-count">{active.size}</span> : null}
      </button>
      {open ? (
        <div className="canvas-filter-menu" role="menu">
          <div className="canvas-filter-heading">Spotlight types</div>
          {TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="menuitemcheckbox"
              aria-checked={active.has(type)}
              className={active.has(type) ? "canvas-filter-item is-on" : "canvas-filter-item"}
              onClick={() => onToggle(type)}
            >
              <span className="canvas-filter-check">{active.has(type) ? <Check size={13} /> : null}</span>
              {NODE_TYPE_LABELS[type]}
            </button>
          ))}
          {active.size ? (
            <button type="button" className="canvas-filter-clear" onClick={onClear}>
              Show all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

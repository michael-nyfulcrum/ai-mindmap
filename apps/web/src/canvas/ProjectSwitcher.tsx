import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import type { CanvasProject } from "./canvasTypes";

type ProjectSwitcherProps = {
  projects: CanvasProject[];
  currentId: string;
  currentName: string;
  onSelect: (id: string) => void;
};

export function ProjectSwitcher({ projects, currentId, currentName, onSelect }: ProjectSwitcherProps) {
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
    <div className="project-switcher" ref={ref}>
      <button
        type="button"
        className="project-switcher-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch project"
      >
        <Sparkles size={18} />
        <span>{currentName}</span>
        <ChevronDown size={15} className="project-switcher-chevron" />
      </button>
      {open ? (
        <div className="project-switcher-menu" role="menu">
          {projects.length === 0 ? (
            <p className="project-switcher-empty">No other projects.</p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                role="menuitem"
                className={project.id === currentId ? "project-switcher-item is-current" : "project-switcher-item"}
                onClick={() => {
                  setOpen(false);
                  if (project.id !== currentId) {
                    onSelect(project.id);
                  }
                }}
              >
                <span className="project-switcher-check">{project.id === currentId ? <Check size={13} /> : null}</span>
                <span className="project-switcher-name">{project.name}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

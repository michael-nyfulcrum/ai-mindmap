import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { CanvasProject } from "./canvasTypes";

type ProjectCarouselProps = {
  projects: CanvasProject[];
  isLoading: boolean;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onRenameProject: (projectId: string, name: string) => void;
  onDeleteProject: (projectId: string) => void;
};

const CARD_GRADIENTS: [string, string][] = [
  ["#1f6feb", "#7b3fe4"],
  ["#238636", "#0a7f8f"],
  ["#bf3989", "#7b3fe4"],
  ["#e6a72e", "#d94f4f"],
  ["#0a7f8f", "#1f6feb"],
  ["#d94f4f", "#bf3989"],
];

function gradientForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  }
  const [a, b] = CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
  return `linear-gradient(145deg, ${a} 0%, ${b} 100%)`;
}

export function ProjectCarousel({
  projects,
  isLoading,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: ProjectCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -260 : 260, behavior: "smooth" });
  }

  return (
    <main className="project-picker">
      <header className="project-picker-header">
        <h1>
          <Sparkles size={22} />
          Context Canvas
        </h1>
        <p>Select a project to open, or start a new one</p>
      </header>

      <div className="project-carousel-wrapper">
        <button className="carousel-nav-btn" onClick={() => scroll("left")} aria-label="Scroll left">
          <ChevronLeft size={22} />
        </button>

        <div className="project-carousel" ref={scrollRef}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              gradient={gradientForId(project.id)}
              disabled={isLoading}
              onSelect={() => onSelectProject(project.id)}
              onRename={(name) => onRenameProject(project.id, name)}
              onDelete={() => onDeleteProject(project.id)}
            />
          ))}

          <button className="project-card-new" onClick={onCreateProject} disabled={isLoading}>
            <Plus size={36} strokeWidth={1.5} />
            <span>New Project</span>
          </button>
        </div>

        <button className="carousel-nav-btn" onClick={() => scroll("right")} aria-label="Scroll right">
          <ChevronRight size={22} />
        </button>
      </div>
    </main>
  );
}

type ProjectCardProps = {
  project: CanvasProject;
  gradient: string;
  disabled: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

function ProjectCard({ project, gradient, disabled, onSelect, onRename, onDelete }: ProjectCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draftName, setDraftName] = useState(project.name);

  function commitRename() {
    const name = draftName.trim() || project.name;
    if (name !== project.name) onRename(name);
    setIsRenaming(false);
  }

  function startRename(e: React.MouseEvent) {
    e.stopPropagation();
    setDraftName(project.name);
    setIsRenaming(true);
  }

  function startDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setIsConfirmingDelete(true);
  }

  const date = new Date(project.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const canOpen = !disabled && !isRenaming && !isConfirmingDelete;

  return (
    <article className={`project-card${canOpen ? " project-card-selectable" : ""}`}>
      <button
        className="project-card-main"
        style={{ background: gradient }}
        onClick={canOpen ? onSelect : undefined}
        disabled={!canOpen}
        aria-label={`Open ${project.name}`}
      >
        {isRenaming ? (
          <input
            className="project-card-rename-input"
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h2 className="project-card-title">{project.name}</h2>
        )}
        <time className="project-card-date">{date}</time>
      </button>

      <footer className="project-card-footer" onClick={(e) => e.stopPropagation()}>
        {isConfirmingDelete ? (
          <>
            <span className="project-card-confirm-label">Delete?</span>
            <button className="project-card-action project-card-action-danger" onClick={onDelete}>
              <Check size={12} /> Yes
            </button>
            <button className="project-card-action" onClick={() => setIsConfirmingDelete(false)}>
              <X size={12} /> No
            </button>
          </>
        ) : (
          <>
            <button className="project-card-action" onClick={startRename} title="Rename">
              <Pencil size={12} /> Rename
            </button>
            <button className="project-card-action project-card-action-danger" onClick={startDelete} title="Delete">
              <Trash2 size={12} /> Delete
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

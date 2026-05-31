import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, HelpCircle, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { PROJECT_TEMPLATES } from "./projectTemplates";
import type { CanvasProject } from "./canvasTypes";
import { TutorialDialog } from "./TutorialDialog";

type ProjectCarouselProps = {
  projects: CanvasProject[];
  isLoading: boolean;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (templateId?: string) => void;
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
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTemplateMenu) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowTemplateMenu(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showTemplateMenu]);

  return (
    <>
      <main className="project-picker">
        <header className="project-picker-header">
          <div>
            <h1 className="project-picker-title">
              <Sparkles size={24} />
              AI Mindmap
            </h1>
            <p className="project-picker-subtitle">
              Map out project context, contracts, and requirements.
            </p>
          </div>
          <div className="project-picker-actions">
            <button type="button" className="project-picker-help" onClick={() => setShowTutorial(true)}>
              <HelpCircle size={15} />
              How it works
            </button>
            <div className="project-picker-new-wrapper" ref={menuRef}>
              <button
                type="button"
                className="project-picker-cta project-picker-cta-main"
                onClick={() => {
                  setShowTemplateMenu(false);
                  onCreateProject();
                }}
                disabled={isLoading}
              >
                <Plus size={16} />
                New Project
              </button>
              <button
                type="button"
                className="project-picker-cta project-picker-cta-chevron"
                onClick={() => setShowTemplateMenu((v) => !v)}
                disabled={isLoading}
                aria-label="Choose template"
                aria-expanded={showTemplateMenu}
                aria-haspopup="menu"
              >
                <ChevronDown size={14} />
              </button>

              {showTemplateMenu && (
                <div className="template-menu" role="menu">
                  <div className="template-menu-heading">Start from template</div>
                  {PROJECT_TEMPLATES.map((tpl) => (
                    <button
                      type="button"
                      key={tpl.id}
                      className="template-menu-item"
                      role="menuitem"
                      onClick={() => {
                        onCreateProject(tpl.id);
                        setShowTemplateMenu(false);
                      }}
                    >
                      <strong>{tpl.name}</strong>
                      <span>{tpl.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="project-grid">
          {projects.length === 0 && !isLoading ? (
            <div className="project-grid-empty">
              <p>No projects yet.</p>
              <button type="button" className="project-picker-cta" onClick={() => onCreateProject()}>
                <Plus size={16} />
                Create your first project
              </button>
            </div>
          ) : (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                gradient={gradientForId(project.id)}
                disabled={isLoading}
                onSelect={() => onSelectProject(project.id)}
                onRename={(name) => onRenameProject(project.id, name)}
                onDelete={() => onDeleteProject(project.id)}
              />
            ))
          )}
        </section>
      </main>

      {showTutorial ? <TutorialDialog onClose={() => setShowTutorial(false)} /> : null}
    </>
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
      <div
        className={`project-card-thumbnail${!canOpen ? " is-disabled" : ""}`}
        style={{ background: gradient }}
        onClick={canOpen ? onSelect : undefined}
        role={canOpen ? "button" : undefined}
        aria-label={canOpen ? `Open ${project.name}` : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onKeyDown={canOpen ? (e) => { if (e.key === "Enter" || e.key === " ") onSelect(); } : undefined}
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
          <span className="project-card-title">{project.name}</span>
        )}
        <time className="project-card-date">{date}</time>
      </div>

      <footer className="project-card-footer" onClick={(e) => e.stopPropagation()}>
        {isConfirmingDelete ? (
          <>
            <span className="project-card-confirm-label">Delete?</span>
            <button type="button" className="project-card-action project-card-action-danger" onClick={onDelete}>
              <Check size={12} /> Yes
            </button>
            <button type="button" className="project-card-action" onClick={() => setIsConfirmingDelete(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button type="button" className="project-card-action" onClick={startRename} title="Rename">
              <Pencil size={12} /> Rename
            </button>
            <button type="button" className="project-card-action project-card-action-danger" onClick={startDelete} title="Delete">
              <Trash2 size={12} /> Delete
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

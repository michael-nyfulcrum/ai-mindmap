import { useState } from "react";
import { Check, HelpCircle, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import type { CanvasProject } from "./canvasTypes";
import { GalaxyBackground } from "./GalaxyBackground";
import { NewProjectModal } from "./NewProjectModal";
import { TutorialDialog } from "./TutorialDialog";

type ProjectCarouselProps = {
  projects: CanvasProject[];
  isLoading: boolean;
  loadingLabel: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (templateId?: string) => void;
  onGenerateProject: (prompt: string) => void;
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
  loadingLabel,
  onSelectProject,
  onCreateProject,
  onGenerateProject,
  onRenameProject,
  onDeleteProject,
}: ProjectCarouselProps) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  return (
    <>
      <main className="project-picker" aria-busy={isLoading}>
        <GalaxyBackground />
        <header className="project-picker-header">
          <div>
            <h1 className="project-picker-title">
              <Sparkles size={24} />
              AI Mindmap
            </h1>
            <p className="project-picker-subtitle">
              Map your ideas as a constellation of nodes — and think them through with AI.
            </p>
          </div>
          <div className="project-picker-actions">
            <button type="button" className="project-picker-help" onClick={() => setShowTutorial(true)}>
              <HelpCircle size={15} />
              How it works
            </button>
            <button
              type="button"
              className="project-picker-cta"
              onClick={() => setShowNewProject(true)}
              disabled={isLoading}
            >
              <Plus size={16} />
              New Project
            </button>
          </div>
        </header>

        <section className="project-grid">
          {projects.length === 0 && !isLoading ? (
            <div className="project-grid-empty">
              <p>No projects yet.</p>
              <button type="button" className="project-picker-cta" onClick={() => setShowNewProject(true)}>
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

        {isLoading ? (
          <div className="project-picker-loading" role="status" aria-live="polite">
            <span className="project-picker-spinner" aria-hidden="true" />
            <span>{loadingLabel}</span>
          </div>
        ) : null}
      </main>

      {showNewProject ? (
        <NewProjectModal
          isLoading={isLoading}
          onClose={() => setShowNewProject(false)}
          onGenerate={(prompt) => onGenerateProject(prompt)}
          onCreateBlank={() => {
            setShowNewProject(false);
            onCreateProject();
          }}
          onCreateTemplate={(id) => {
            setShowNewProject(false);
            onCreateProject(id);
          }}
        />
      ) : null}

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

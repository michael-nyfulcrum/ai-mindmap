import { useCallback, useState } from "react";
import { ArrowRight, FilePlus2, LayoutTemplate, Sparkles, Wand2, X } from "lucide-react";
import { PROJECT_TEMPLATES } from "./projectTemplates";
import { useModalDismiss } from "../shared/useModalDismiss";

type NewProjectModalProps = {
  isLoading: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
  onCreateBlank: () => void;
  onCreateTemplate: (templateId: string) => void;
};

const GENERATE_EXAMPLES = [
  "Internal tool for support to manage refund requests",
  "Mobile app for booking dog walkers",
  "Inventory dashboard for a small warehouse",
];

export function NewProjectModal({
  isLoading,
  onClose,
  onGenerate,
  onCreateBlank,
  onCreateTemplate,
}: NewProjectModalProps) {
  const [prompt, setPrompt] = useState("");
  const handleClose = useCallback(() => {
    if (!isLoading) onClose();
  }, [isLoading, onClose]);
  const dialogRef = useModalDismiss<HTMLDivElement>(handleClose);

  function submitPrompt() {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;
    onGenerate(trimmed);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  }

  return (
    <div className="tutorial-backdrop" onClick={handleBackdropClick}>
      <div ref={dialogRef} tabIndex={-1} className="new-project-modal" role="dialog" aria-modal="true" aria-label="New project">
        <div className="tutorial-header">
          <h2>New project</h2>
          <button onClick={onClose} aria-label="Close" disabled={isLoading}>
            <X size={18} />
          </button>
        </div>

        <div className="new-project-body">
          <section className="project-generate">
            <div className="project-generate-label">
              <Wand2 size={16} />
              <span>Generate from a prompt — AI builds the canvas for you</span>
            </div>
            <div className="project-generate-bar">
              <textarea
                className="project-generate-input"
                value={prompt}
                placeholder="e.g. Internal tool for support to manage refund requests"
                rows={2}
                autoFocus
                disabled={isLoading}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
              />
              <button
                type="button"
                className="project-generate-submit"
                onClick={submitPrompt}
                disabled={isLoading || !prompt.trim()}
              >
                <Sparkles size={16} />
                Generate
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="project-generate-examples">
              {GENERATE_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="project-generate-chip"
                  disabled={isLoading}
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </section>

          <div className="new-project-divider">
            <span>or start manually</span>
          </div>

          <section className="new-project-manual">
            <button
              type="button"
              className="new-project-option"
              disabled={isLoading}
              onClick={onCreateBlank}
            >
              <span className="new-project-option-icon">
                <FilePlus2 size={18} />
              </span>
              <span className="new-project-option-text">
                <strong>Blank canvas</strong>
                <span>Start from an empty mindmap</span>
              </span>
            </button>

            <div className="new-project-templates-heading">
              <LayoutTemplate size={14} />
              Start from a template
            </div>
            {PROJECT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="new-project-option"
                disabled={isLoading}
                onClick={() => onCreateTemplate(template.id)}
              >
                <span className="new-project-option-text">
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                </span>
              </button>
            ))}
          </section>
        </div>

        {isLoading ? (
          <div className="new-project-loading" role="status" aria-live="polite">
            <span className="project-picker-spinner" aria-hidden="true" />
            <span>Planning your project…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

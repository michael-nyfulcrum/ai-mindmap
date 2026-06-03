import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { useModalDismiss } from "../shared/useModalDismiss";
import { DiffStat } from "./DiffView";
import { RichContentEditor } from "./RichContentEditor";

type ContentEditorModalProps = {
  title: string;
  typeLabel: string;
  value: string;
  baseline: string;
  onChange: (value: string) => void;
  onClose: () => void;
};

export function ContentEditorModal({ title, typeLabel, value, baseline, onChange, onClose }: ContentEditorModalProps) {
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);

  const isDirty = value !== baseline;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="editor-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${title}`}
      onMouseDown={onClose}
    >
      <Panel className="editor-modal">
        <div className="editor-modal-inner" onMouseDown={(event) => event.stopPropagation()}>
          <header className="editor-head">
            <div className="editor-head-meta">
              <span className="editor-kicker">{typeLabel}</span>
              <strong className="editor-title">{title}</strong>
            </div>
            <div className="editor-head-actions">
              <DiffStat before={baseline} after={value} />
              <Button icon={<X size={15} />} variant="ghost" onClick={onClose} aria-label="Close editor" title="Close editor" />
            </div>
          </header>

          <RichContentEditor
            className="rich-editor-modal"
            value={value}
            baseline={baseline}
            onChange={onChange}
            placeholder="Write the contract, requirement, or note in Markdown…"
            autoFocus
          />

          <footer className="editor-foot">
            <span className={`editor-status ${isDirty ? "is-dirty" : ""}`}>
              {isDirty ? "Edited — save in the inspector to create a version" : "No changes since last save"}
            </span>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </footer>
        </div>
      </Panel>
    </div>,
    document.body,
  );
}

import { useEffect, useRef, useState } from "react";
import { Eye, GitCompareArrows, Pencil, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { DiffStat, DiffView } from "./DiffView";

type EditorTab = "edit" | "preview" | "diff";

type ContentEditorModalProps = {
  title: string;
  typeLabel: string;
  value: string;
  baseline: string;
  onChange: (value: string) => void;
  onClose: () => void;
};

export function ContentEditorModal({ title, typeLabel, value, baseline, onChange, onClose }: ContentEditorModalProps) {
  const [tab, setTab] = useState<EditorTab>("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (tab === "edit") {
      textareaRef.current?.focus();
    }
  }, [tab]);

  const isDirty = value !== baseline;

  return (
    <div className="editor-backdrop" role="dialog" aria-modal="true" aria-label={`Edit ${title}`} onMouseDown={onClose}>
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

          <nav className="editor-tabs" aria-label="Editor view">
            <button type="button" className={tabClass(tab === "edit")} onClick={() => setTab("edit")}>
              <Pencil size={13} /> Edit
            </button>
            <button type="button" className={tabClass(tab === "preview")} onClick={() => setTab("preview")}>
              <Eye size={13} /> Preview
            </button>
            <button type="button" className={tabClass(tab === "diff")} onClick={() => setTab("diff")} disabled={!isDirty}>
              <GitCompareArrows size={13} /> Changes
            </button>
          </nav>

          <div className="editor-body">
            {tab === "edit" ? (
              <textarea
                ref={textareaRef}
                className="editor-surface"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Write the contract, requirement, or note in Markdown…"
                spellCheck
              />
            ) : null}

            {tab === "preview" ? (
              <div className="editor-preview chat-markdown">
                {value.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
                ) : (
                  <p className="editor-empty">Nothing to preview yet.</p>
                )}
              </div>
            ) : null}

            {tab === "diff" ? (
              <div className="editor-diff">
                <DiffView before={baseline} after={value} emptyLabel="No unsaved changes in this session." />
              </div>
            ) : null}
          </div>

          <footer className="editor-foot">
            <span className={`editor-status ${isDirty ? "is-dirty" : ""}`}>
              {isDirty ? "Unsaved edits in this session — autosaving" : "All changes saved"}
            </span>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </footer>
        </div>
      </Panel>
    </div>
  );
}

function tabClass(active: boolean) {
  return ["editor-tab", active ? "is-active" : ""].filter(Boolean).join(" ");
}

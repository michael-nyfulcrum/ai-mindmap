import { useRef, useState } from "react";
import { Eye, GitCompareArrows, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DiffView } from "./DiffView";

type EditorTab = "edit" | "preview" | "diff";

type RichContentEditorProps = {
  value: string;
  baseline: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
};

// Tabbed Markdown editor (write / preview / changes) shared by the inspector's
// inline content area and the full-screen content editor modal.
export function RichContentEditor({
  value,
  baseline,
  onChange,
  className = "",
  placeholder,
  autoFocus = false,
}: RichContentEditorProps) {
  const [tab, setTab] = useState<EditorTab>("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDirty = value !== baseline;

  const goEdit = () => {
    setTab("edit");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <div className={`rich-editor ${className}`.trim()}>
      <nav className="editor-tabs" aria-label="Editor view">
        <button type="button" className={tabClass(tab === "edit")} onClick={goEdit}>
          <Pencil size={13} /> Write
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
            placeholder={placeholder ?? "Write in Markdown — headings, lists, **bold**, links…"}
            spellCheck
            autoFocus={autoFocus}
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
    </div>
  );
}

function tabClass(active: boolean) {
  return ["editor-tab", active ? "is-active" : ""].filter(Boolean).join(" ");
}

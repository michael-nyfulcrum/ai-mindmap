import { memo, useEffect, useMemo, useState, type ReactNode } from "react";
import { Clipboard, FileCode2, History, Maximize2, MessagesSquare, PanelRightClose, Save, Sparkles, Undo2, WandSparkles } from "lucide-react";
import { listNodeVersions } from "../api/canvasApi";
import type { CanvasFlowNode, CanvasNodeData, ContractChangeVersion, ImpactStatus } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { Spinner } from "../shared/ui/Spinner";
import { ContentEditorModal } from "./ContentEditorModal";
import { DiffStat, DiffView } from "./DiffView";
import { RichContentEditor } from "./RichContentEditor";
import { copyText } from "../shared/clipboard";
import { toast } from "../shared/toast";

// Expands a thin requirement into everything a full spec needs.
const FLESH_OUT_INSTRUCTION =
  "Flesh out this requirement so it is complete enough for a full specification: rewrite it with clear functional behavior and 3-5 testable acceptance criteria, and propose any missing related requirements, edge cases, and dependencies needed to build it.";

// Quick-fill prompts that customise what the AI suggests for the selected node.
// Each chip sets the instruction sent with the Improve action.
const SUGGEST_PRESETS: { label: string; instruction: string }[] = [
  { label: "Flesh out for a full spec", instruction: FLESH_OUT_INSTRUCTION },
  { label: "Add acceptance criteria", instruction: "Add acceptance criteria" },
  { label: "Surface risks & edge cases", instruction: "Surface risks & edge cases" },
  { label: "Suggest related requirements", instruction: "Suggest related requirements" },
];

// Spec nodes refine the generated spec rather than the underlying requirement.
const SPEC_PRESETS: { label: string; instruction: string }[] = [
  {
    label: "Refine functional requirements",
    instruction:
      "Refine the functional requirements: make each FR a single, testable 'the system MUST…' statement with clear acceptance criteria.",
  },
  {
    label: "Add development requirements",
    instruction:
      "Improve the Development Requirements section: list the technical work (data, API, UI, validation, integration, auth, testing) needed to build this spec.",
  },
  {
    label: "Tighten acceptance criteria",
    instruction: "Tighten the acceptance criteria so each one is specific, measurable, and testable.",
  },
];

type CanvasInspectorProps = {
  projectId: string;
  projectName: string;
  activeNode: CanvasFlowNode;
  saveState: "loading" | "saved" | "saving" | "error";
  isSuggesting: boolean;
  aiBusy: boolean;
  onSaveNode: (nodeId: string, data: CanvasNodeData, commitMessage: string) => Promise<void>;
  onChatAboutNode: (node: CanvasFlowNode, instruction?: string) => void;
  onRequestSuggestions: (nodeId: string, instruction?: string) => void;
  onCreateSpec: (nodeId: string, instruction?: string) => void;
  onCollapse: () => void;
};

export const CanvasInspector = memo(function CanvasInspector({
  projectId,
  projectName,
  activeNode,
  saveState,
  isSuggesting,
  aiBusy,
  onSaveNode,
  onChatAboutNode,
  onRequestSuggestions,
  onCreateSpec,
  onCollapse,
}: CanvasInspectorProps) {
  const [versionResult, setVersionResult] = useState<{
    nodeId: string;
    versions: ContractChangeVersion[];
    status: "idle" | "error";
  }>({ nodeId: "", versions: [], status: "idle" });
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Draft edits are held locally and only committed (with a version) on Save.
  const [draftTitle, setDraftTitle] = useState(activeNode.data.title);
  const [draftTags, setDraftTags] = useState(activeNode.data.tags.join(", "));
  const [draftContent, setDraftContent] = useState(activeNode.data.fields.content ?? "");
  const [commitMessage, setCommitMessage] = useState("");
  const [suggestPrompt, setSuggestPrompt] = useState("");

  const audit = activeNode.data.audit;
  const impact = activeNode.data.impact;
  const savedContent = activeNode.data.fields.content ?? "";
  const isSpecNode = activeNode.data.canvasType === "spec";
  // What the Improve action asks for: the user's own words, or a sensible
  // default — refine the spec, or fix the flag a node carries.
  const suggestInstruction =
    suggestPrompt.trim() ||
    (isSpecNode
      ? `Refine and improve the spec "${activeNode.data.title}": tighten the functional requirements (FR-###) and their acceptance criteria, and improve the development requirements. Return the full updated spec body.`
      : impact
        ? `Suggest a concrete content update for "${activeNode.data.title}". It is flagged ${impact.status}: ${impact.reason}`
        : undefined);
  const handoffPrompt = buildSpecHandoffPrompt(projectId, projectName, activeNode);
  const isVersionedNode = ["project_contract", "requirement"].includes(activeNode.data.canvasType);
  const versions = isVersionedNode && versionResult.nodeId === activeNode.id ? versionResult.versions : [];
  const versionState = !isVersionedNode
    ? "idle"
    : versionResult.nodeId === activeNode.id
      ? versionResult.status
      : "loading";
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null;

  const parsedTags = useMemo(
    () => draftTags.split(",").map((tag) => tag.trim()).filter(Boolean),
    [draftTags],
  );
  const isDirty =
    draftTitle.trim() !== activeNode.data.title ||
    draftContent !== savedContent ||
    parsedTags.join("\u0000") !== activeNode.data.tags.join("\u0000");

  useEffect(() => {
    let cancelled = false;
    if (!projectId || !isVersionedNode) {
      return;
    }

    listNodeVersions({ projectId, nodeId: activeNode.id })
      .then((result) => {
        if (!cancelled) {
          setVersionResult({ nodeId: activeNode.id, versions: result.versions, status: "idle" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersionResult({ nodeId: activeNode.id, versions: [], status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
    // Re-fetch after each successful save so a freshly created version appears.
  }, [activeNode.id, isVersionedNode, projectId, saveState]);

  const handleSave = async () => {
    if (!isDirty || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await onSaveNode(
        activeNode.id,
        {
          ...activeNode.data,
          title: draftTitle.trim(),
          tags: parsedTags,
          fields: { ...activeNode.data.fields, content: draftContent },
          updatedAt: new Date().toISOString(),
        },
        commitMessage.trim(),
      );
      setCommitMessage("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraftTitle(activeNode.data.title);
    setDraftTags(activeNode.data.tags.join(", "));
    setDraftContent(savedContent);
    setCommitMessage("");
  };

  return (
    <Panel
      title="Details"
      className="inspector-panel"
      actions={
        <Button icon={<PanelRightClose size={15} />} variant="ghost" onClick={onCollapse} aria-label="Collapse inspector" title="Collapse inspector" />
      }
    >
      <div className="inspector-content">
        <header className={`inspector-head inspector-head-${activeNode.data.canvasType}`}>
          <div className="inspector-head-row">
            <span className="inspector-kicker">{NODE_TYPE_LABELS[activeNode.data.canvasType]}</span>
            {impact ? <ImpactBadge status={impact.status} /> : null}
          </div>
          <input
            className="inspector-title-input"
            value={draftTitle}
            placeholder="Name this node…"
            aria-label="Title"
            onChange={(event) => setDraftTitle(event.target.value)}
          />
        </header>

        {impact ? (
          <section className="inspector-alert">
            <span className="inspector-alert-head">
              <WandSparkles size={12} /> Needs your attention
            </span>
            <p>{impact.reason}</p>
            <small>
              Flagged from version {shortVersionId(impact.sourceVersionId)} · {formatAuditDate(impact.updatedAt)}
            </small>
          </section>
        ) : null}

        <section className="inspector-section inspector-ai-actions">
          <div className="inspector-section-head">
            <h3>
              <Sparkles size={13} /> AI actions
            </h3>
          </div>

          <input
            className="inspector-inline-input ai-action-input"
            value={suggestPrompt}
            placeholder={impact ? "What's on your mind? (or leave blank to fix the flag)" : "What's on your mind? (optional)"}
            aria-label="AI instruction"
            disabled={aiBusy}
            onChange={(event) => setSuggestPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onRequestSuggestions(activeNode.id, suggestInstruction);
              }
            }}
          />

          <div className="ai-action-chips">
            {(isSpecNode ? SPEC_PRESETS : SUGGEST_PRESETS).map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="ai-action-chip"
                disabled={aiBusy}
                onClick={() => setSuggestPrompt(preset.instruction)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p className="ai-action-hint">Your note above steers each action.</p>

          <div className="ai-action-list">
            <AiActionButton
              icon={<MessagesSquare size={16} />}
              label="Talk it through"
              description="Open a focused chat thread about this node."
              disabled={aiBusy}
              onClick={() => onChatAboutNode(activeNode, suggestPrompt.trim() || undefined)}
            />
            <AiActionButton
              primary
              icon={isSuggesting ? <Spinner size={16} /> : <WandSparkles size={16} />}
              label={isSuggesting ? "Improving…" : "Improve"}
              description={
                isSpecNode
                  ? "Refine functional & development requirements — preview edits, then accept."
                  : "Flesh out criteria, fill gaps & refine — preview edits, then accept."
              }
              disabled={aiBusy}
              onClick={() => onRequestSuggestions(activeNode.id, suggestInstruction)}
            />
            {isSpecNode ? null : (
              <AiActionButton
                icon={<FileCode2 size={16} />}
                label="Create spec"
                description="Generate a Spec Kit spec node to hand to a coding agent."
                disabled={aiBusy}
                onClick={() => onCreateSpec(activeNode.id, suggestPrompt.trim() || undefined)}
              />
            )}
          </div>
        </section>

        {isSpecNode ? (
          <section className="inspector-section spec-handoff">
            <div className="inspector-section-head">
              <h3>
                <FileCode2 size={13} /> Coding agent handoff
              </h3>
            </div>
            <p className="spec-handoff-hint">
              Paste this into your coding agent (Claude Code, Codex, Cursor). It pulls this spec over
              MCP and builds the feature.
            </p>
            <textarea className="spec-handoff-prompt" value={handoffPrompt} readOnly rows={9} spellCheck={false} />
            <Button
              icon={<Clipboard size={15} />}
              variant="primary"
              onClick={() => {
                void copyText(handoffPrompt).then((ok) =>
                  ok
                    ? toast.success("Handoff prompt copied", "spec-handoff")
                    : toast.error("Couldn’t copy to clipboard", "spec-handoff", "Select the text and copy manually."),
                );
              }}
            >
              Copy prompt
            </Button>
          </section>
        ) : null}

        <div className="inspector-field">
          <span className="inspector-field-label">Tags</span>
          <input
            className="inspector-inline-input"
            value={draftTags}
            placeholder="Add tags, separated by commas"
            aria-label="Tags"
            onChange={(event) => setDraftTags(event.target.value)}
          />
        </div>

        <section className="inspector-section inspector-content-section">
          <div className="inspector-section-head">
            <h3>Content</h3>
            <button
              type="button"
              className="inspector-link-button"
              onClick={() => setIsEditorOpen(true)}
              title="Open the full editor"
            >
              <Maximize2 size={13} /> Expand
            </button>
          </div>
          <RichContentEditor
            className="rich-editor-inline"
            value={draftContent}
            baseline={savedContent}
            onChange={setDraftContent}
          />
        </section>

        {isVersionedNode ? (
          <section className="inspector-section version-history">
            <div className="inspector-section-head">
              <h3>
                <History size={13} /> History
              </h3>
              {versions.length > 0 ? (
                <select
                  className="version-select"
                  value={selectedVersion?.id ?? ""}
                  onChange={(event) => setSelectedVersionId(event.target.value)}
                  aria-label="Select version"
                >
                  {versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      v{version.versionNumber} · {titleCaseField(version.changeType)}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {versionState === "loading" ? <p className="version-note">Loading history…</p> : null}
            {versionState === "error" ? <p className="version-note">Version history unavailable.</p> : null}
            {versionState === "idle" && versions.length === 0 ? (
              <p className="version-note">No versions yet — edit and save to create one.</p>
            ) : null}

            {selectedVersion ? (
              <article className="version-detail">
                <div className="version-detail-head">
                  <span className={`change-pill change-pill-${selectedVersion.changeType}`}>
                    {titleCaseField(selectedVersion.changeType)}
                  </span>
                  <DiffStat before={selectedVersion.contentBefore ?? ""} after={selectedVersion.contentAfter ?? ""} />
                </div>
                <p className="version-summary">{selectedVersion.summary}</p>
                {selectedVersion.changedFields.length > 0 ? (
                  <div className="version-fields">
                    {selectedVersion.changedFields.map((field) => (
                      <span key={field}>{titleCaseField(field)}</span>
                    ))}
                  </div>
                ) : null}
                <DiffView
                  split
                  before={selectedVersion.contentBefore ?? ""}
                  after={selectedVersion.contentAfter ?? ""}
                  emptyLabel="No content changes in this version."
                />
                <small className="version-foot">
                  {selectedVersion.createdBy} · {formatAuditDate(selectedVersion.createdAt)}
                  {selectedVersion.affectedNodes.length > 0
                    ? ` · ${selectedVersion.affectedNodes.length} node${selectedVersion.affectedNodes.length === 1 ? "" : "s"} affected`
                    : ""}
                </small>
              </article>
            ) : null}
          </section>
        ) : null}

        {audit ? (
          <section className="inspector-section">
            <h3>Activity</h3>
            <dl className="inspector-meta">
              <div>
                <dt>Created</dt>
                <dd>{audit.createdBy} · {formatAuditDate(audit.createdAt)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{audit.updatedBy} · {formatAuditDate(audit.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        <footer className="inspector-save">
          <div className="inspector-save-head">
            <span className={`inspector-save-status ${isDirty ? "is-dirty" : ""}`}>
              {isSaving || saveState === "saving"
                ? "Saving…"
                : isDirty
                  ? "Unsaved changes"
                  : "All changes saved"}
            </span>
            {isDirty ? <DiffStat before={savedContent} after={draftContent} /> : null}
          </div>
          <input
            className="inspector-commit-input"
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            placeholder={isVersionedNode ? "Summary of changes (commit message)" : "Note for this save (optional)"}
            disabled={!isDirty || isSaving}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                void handleSave();
              }
            }}
          />
          <div className="inspector-save-actions">
            <Button icon={<Undo2 size={14} />} variant="ghost" onClick={handleDiscard} disabled={!isDirty || isSaving}>
              Discard
            </Button>
            <Button
              icon={isSaving ? <Spinner size={14} /> : <Save size={14} />}
              variant="primary"
              onClick={() => void handleSave()}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? "Saving…" : isVersionedNode ? "Save version" : "Save"}
            </Button>
          </div>
        </footer>
      </div>

      {isEditorOpen ? (
        <ContentEditorModal
          title={draftTitle || "Untitled"}
          typeLabel={NODE_TYPE_LABELS[activeNode.data.canvasType]}
          value={draftContent}
          baseline={savedContent}
          onChange={setDraftContent}
          onClose={() => setIsEditorOpen(false)}
        />
      ) : null}
    </Panel>
  );
});

function AiActionButton({
  icon,
  label,
  description,
  disabled,
  primary = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={primary ? "ai-action-item ai-action-item--primary" : "ai-action-item"}
      disabled={disabled}
      onClick={onClick}
      title={description}
    >
      <span className="ai-action-item-icon">{icon}</span>
      <span className="ai-action-item-text">
        <span className="ai-action-item-label">{label}</span>
        <span className="ai-action-item-desc">{description}</span>
      </span>
    </button>
  );
}

function buildSpecHandoffPrompt(projectId: string, projectName: string, node: CanvasFlowNode) {
  return [
    `Implement the "${node.data.title}" spec for the "${projectName}" project.`,
    "",
    "Connect to the AI Mindmap MCP server, then call get_canvas_spec with:",
    `  project_id: ${projectId}`,
    `  spec_id: ${node.id}`,
    "",
    "Treat the returned spec as the single source of truth. Build exactly the functional",
    "requirements (FR-###) it lists, cite each one back to its canvas node ID, and do not add",
    "scope that the spec does not call for. If anything is marked [NEEDS CLARIFICATION], ask",
    "before implementing it.",
  ].join("\n");
}

function ImpactBadge({ status }: { status: ImpactStatus }) {
  return <em className={`impact-badge impact-badge-${status}`}>{impactLabel(status)}</em>;
}

function impactLabel(status: ImpactStatus) {
  if (status === "needs_update") {
    return "Needs update";
  }
  return titleCaseField(status);
}

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortVersionId(value: string) {
  return value.replace(/^version_/, "").slice(0, 8);
}

function titleCaseField(value: string) {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (["id", "ids", "url", "urls", "api"].includes(lower)) {
        return lower.toUpperCase();
      }
      if (lower === "ai") {
        return "AI";
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

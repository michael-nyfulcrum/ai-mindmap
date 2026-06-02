import { Check, Crosshair, GitBranch, Plus, Sparkles, X } from "lucide-react";
import type { ProposedChange, SuggestionResponse } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";
import { DiffStat, DiffView } from "./DiffView";

type SuggestionReviewProps = {
  proposal: SuggestionResponse;
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onAcceptAll: () => void;
  onDismiss: () => void;
  onFocus: (change: ProposedChange) => void;
};

export function SuggestionReview({
  proposal,
  onAccept,
  onReject,
  onAcceptAll,
  onDismiss,
  onFocus,
}: SuggestionReviewProps) {
  const count = proposal.changes.length;

  return (
    <aside className="suggestion-review" aria-label="AI suggestions">
      <header className="suggestion-review-head">
        <div className="suggestion-review-title">
          <Sparkles size={15} />
          <span>AI suggestions</span>
        </div>
        <button type="button" className="suggestion-review-close" onClick={onDismiss} aria-label="Dismiss suggestions">
          <X size={16} />
        </button>
      </header>

      <p className="suggestion-review-summary">{proposal.summary}</p>

      {count === 0 ? (
        <div className="suggestion-review-empty">
          <p>No suggestions to review.</p>
        </div>
      ) : (
        <div className="suggestion-review-list">
          {proposal.changes.map((change) => (
            <SuggestionRow
              key={change.id}
              change={change}
              onAccept={() => onAccept(change.id)}
              onReject={() => onReject(change.id)}
              onFocus={() => onFocus(change)}
            />
          ))}
        </div>
      )}

      {count > 0 ? (
        <footer className="suggestion-review-foot">
          <button type="button" className="suggestion-btn-ghost" onClick={onDismiss}>
            Dismiss all
          </button>
          <button type="button" className="suggestion-btn-accept-all" onClick={onAcceptAll}>
            <Check size={14} /> Accept all ({count})
          </button>
        </footer>
      ) : null}
    </aside>
  );
}

type SuggestionRowProps = {
  change: ProposedChange;
  onAccept: () => void;
  onReject: () => void;
  onFocus: () => void;
};

function SuggestionRow({ change, onAccept, onReject, onFocus }: SuggestionRowProps) {
  const meta = describeChange(change);

  return (
    <article className={`suggestion-row suggestion-row-${change.op}`}>
      <button type="button" className="suggestion-row-main" onClick={onFocus} title="Focus on canvas">
        <span className="suggestion-row-icon">{meta.icon}</span>
        <span className="suggestion-row-text">
          <span className="suggestion-row-label">{meta.label}</span>
          <strong className="suggestion-row-name">{meta.name}</strong>
        </span>
        <Crosshair size={13} className="suggestion-row-focus" />
      </button>

      {change.rationale ? <p className="suggestion-row-rationale">{change.rationale}</p> : null}

      {change.op === "update_node" ? (
        <div className="suggestion-row-diff">
          <DiffStat before={change.contentBefore ?? ""} after={change.contentAfter ?? ""} />
          <DiffView
            before={change.contentBefore ?? ""}
            after={change.contentAfter ?? ""}
            emptyLabel="No content change."
          />
        </div>
      ) : null}

      <div className="suggestion-row-actions">
        <button type="button" className="suggestion-btn-reject" onClick={onReject}>
          <X size={13} /> Reject
        </button>
        <button type="button" className="suggestion-btn-accept" onClick={onAccept}>
          <Check size={13} /> Accept
        </button>
      </div>
    </article>
  );
}

function describeChange(change: ProposedChange): { icon: React.ReactNode; label: string; name: string } {
  if (change.op === "add_node") {
    const typeLabel = change.nodeType ? NODE_TYPE_LABELS[change.nodeType] : "Node";
    return { icon: <Plus size={14} />, label: `Add ${typeLabel.toLowerCase()}`, name: change.title ?? "Untitled" };
  }
  if (change.op === "add_edge") {
    return { icon: <GitBranch size={14} />, label: "New connection", name: change.relationship ?? "references" };
  }
  return { icon: <Sparkles size={14} />, label: "Update node", name: change.titleAfter ?? change.titleBefore ?? "Node" };
}

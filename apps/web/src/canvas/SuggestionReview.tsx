import { useEffect, useState } from "react";
import { Check, Crosshair, GitBranch, Plus, Sparkles, X } from "lucide-react";
import type { ProposedChange, SuggestionResponse } from "./canvasTypes";
import { NODE_TYPE_LABELS } from "./canvasTypes";
import { DiffStat, DiffView } from "./DiffView";

type SuggestionReviewProps = {
  proposal: SuggestionResponse | null;
  isLoading: boolean;
  onAccept: (changeId: string) => void;
  onReject: (changeId: string) => void;
  onAcceptAll: () => void;
  onDismiss: () => void;
  onFocus: (change: ProposedChange) => void;
};

const LOADING_STEPS = [
  "Reading your canvas…",
  "Mapping requirements and gaps…",
  "Drafting high-value changes…",
  "Preparing a preview…",
];

export function SuggestionReview({
  proposal,
  isLoading,
  onAccept,
  onReject,
  onAcceptAll,
  onDismiss,
  onFocus,
}: SuggestionReviewProps) {
  const count = proposal?.changes.length ?? 0;

  return (
    <aside className="suggestion-review" aria-label="AI suggestions" aria-busy={isLoading}>
      <header className="suggestion-review-head">
        <div className="suggestion-review-title">
          <span className="suggestion-review-orb">
            <Sparkles size={15} />
          </span>
          <div>
            <strong>AI suggestions</strong>
            <span className="suggestion-review-sub">
              {isLoading ? "Thinking…" : count > 0 ? `${count} proposed change${count === 1 ? "" : "s"}` : "Review"}
            </span>
          </div>
        </div>
        {!isLoading ? (
          <button type="button" className="suggestion-review-close" onClick={onDismiss} aria-label="Dismiss suggestions">
            <X size={16} />
          </button>
        ) : null}
      </header>

      {isLoading ? (
        <LoadingBody />
      ) : !proposal || count === 0 ? (
        <div className="suggestion-review-empty">
          <p>No suggestions for this canvas right now.</p>
          <button type="button" className="suggestion-btn-ghost" onClick={onDismiss}>
            Close
          </button>
        </div>
      ) : (
        <>
          <p className="suggestion-review-summary">{proposal.summary}</p>
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
          <footer className="suggestion-review-foot">
            <button type="button" className="suggestion-btn-ghost" onClick={onDismiss}>
              Dismiss all
            </button>
            <button type="button" className="suggestion-btn-accept-all" onClick={onAcceptAll}>
              <Check size={14} /> Accept all ({count})
            </button>
          </footer>
        </>
      )}
    </aside>
  );
}

function LoadingBody() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % LOADING_STEPS.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="suggestion-loading">
      <div className="suggestion-loading-orb">
        <Sparkles size={22} />
      </div>
      <strong className="suggestion-loading-title">Analyzing your canvas</strong>
      <span className="suggestion-loading-status">{LOADING_STEPS[step]}</span>
      <div className="suggestion-skeletons" aria-hidden="true">
        <span className="suggestion-skeleton" />
        <span className="suggestion-skeleton" />
        <span className="suggestion-skeleton" />
      </div>
    </div>
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

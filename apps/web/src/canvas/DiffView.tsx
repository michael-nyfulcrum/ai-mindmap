import { useMemo } from "react";
import { diffWords, wordDiffStat, type WordSegment } from "./diff";

type DiffViewProps = {
  before: string;
  after: string;
  emptyLabel?: string;
  className?: string;
  /** Render before/after side by side instead of a single merged stream. */
  split?: boolean;
};

export function DiffView({
  before,
  after,
  emptyLabel = "No content changes",
  className = "",
  split = false,
}: DiffViewProps) {
  const segments = useMemo(() => diffWords(before, after), [before, after]);
  const hasChanges = segments.some((segment) => segment.type !== "unchanged" && segment.text.trim().length > 0);

  if (!hasChanges) {
    return <div className="diff-empty">{emptyLabel}</div>;
  }

  if (split) {
    // Taking unchanged+del reconstructs `before` exactly; unchanged+add reconstructs
    // `after` exactly, since the LCS walk keeps every token in original order.
    return (
      <div className={`diff-view diff-split ${className}`.trim()} role="group" aria-label="Content diff">
        <DiffPane label="Before" keep="del" segments={segments} />
        <DiffPane label="After" keep="add" segments={segments} />
      </div>
    );
  }

  return (
    <div className={`diff-view diff-words ${className}`.trim()} role="group" aria-label="Content diff">
      {segments.map((segment, index) => {
        // Render whitespace-only changes as plain text so the layout never shows
        // oddly coloured gaps; only real words get add/del highlighting.
        if (segment.type === "unchanged" || segment.text.trim().length === 0) {
          return <span key={`${index}-${segment.type}`}>{segment.text}</span>;
        }
        return (
          <span key={`${index}-${segment.type}`} className={`diff-word diff-word-${segment.type}`}>
            {segment.text}
          </span>
        );
      })}
    </div>
  );
}

function DiffPane({ label, keep, segments }: { label: string; keep: "add" | "del"; segments: WordSegment[] }) {
  const drop = keep === "add" ? "del" : "add";
  return (
    <div className={`diff-pane diff-pane-${keep}`}>
      <span className="diff-pane-label">{label}</span>
      <div className="diff-pane-body">
        {segments
          .filter((segment) => segment.type !== drop)
          .map((segment, index) =>
            segment.type === keep && segment.text.trim().length > 0 ? (
              <span key={`${index}-${segment.type}`} className={`diff-word diff-word-${keep}`}>
                {segment.text}
              </span>
            ) : (
              <span key={`${index}-${segment.type}`}>{segment.text}</span>
            ),
          )}
      </div>
    </div>
  );
}

export function DiffStat({ before, after }: { before: string; after: string }) {
  const { additions, deletions } = useMemo(() => wordDiffStat(diffWords(before, after)), [before, after]);
  if (additions === 0 && deletions === 0) {
    return null;
  }
  return (
    <span className="diff-stat" aria-label={`${additions} words added, ${deletions} words removed`}>
      {additions > 0 ? <em className="diff-stat-add">+{additions}</em> : null}
      {deletions > 0 ? <em className="diff-stat-del">−{deletions}</em> : null}
    </span>
  );
}

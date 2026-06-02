import { useMemo } from "react";
import { diffWords, wordDiffStat } from "./diff";

type DiffViewProps = {
  before: string;
  after: string;
  emptyLabel?: string;
  className?: string;
};

export function DiffView({ before, after, emptyLabel = "No content changes", className = "" }: DiffViewProps) {
  const segments = useMemo(() => diffWords(before, after), [before, after]);
  const hasChanges = segments.some((segment) => segment.type !== "unchanged" && segment.text.trim().length > 0);

  if (!hasChanges) {
    return <div className="diff-empty">{emptyLabel}</div>;
  }

  return (
    <div className={`diff-view diff-words ${className}`.trim()} role="group" aria-label="Content diff">
      {segments.map((segment, index) => {
        // Render whitespace-only changes as plain text so the layout never shows
        // oddly coloured gaps; only real words get add/del highlighting.
        if (segment.type === "unchanged" || segment.text.trim().length === 0) {
          return <span key={index}>{segment.text}</span>;
        }
        return (
          <span key={index} className={`diff-word diff-word-${segment.type}`}>
            {segment.text}
          </span>
        );
      })}
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

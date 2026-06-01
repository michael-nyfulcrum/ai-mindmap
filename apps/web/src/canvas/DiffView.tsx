import { useMemo } from "react";
import { diffLines, diffStat } from "./diff";

type DiffViewProps = {
  before: string;
  after: string;
  emptyLabel?: string;
  className?: string;
};

export function DiffView({ before, after, emptyLabel = "No content changes", className = "" }: DiffViewProps) {
  const rows = useMemo(() => diffLines(before, after), [before, after]);
  const hasChanges = rows.some((row) => row.type !== "unchanged");

  if (!hasChanges) {
    return <div className="diff-empty">{emptyLabel}</div>;
  }

  return (
    <div className={`diff-view ${className}`.trim()} role="table" aria-label="Content diff">
      {rows.map((row, index) => (
        <div key={index} className={`diff-row diff-row-${row.type}`} role="row">
          <span className="diff-gutter">{row.type === "add" ? "" : row.beforeLine}</span>
          <span className="diff-gutter">{row.type === "del" ? "" : row.afterLine}</span>
          <span className="diff-sign" aria-hidden="true">
            {row.type === "add" ? "+" : row.type === "del" ? "−" : ""}
          </span>
          <code className="diff-text">{row.text || " "}</code>
        </div>
      ))}
    </div>
  );
}

export function DiffStat({ before, after }: { before: string; after: string }) {
  const { additions, deletions } = useMemo(() => diffStat(diffLines(before, after)), [before, after]);
  if (additions === 0 && deletions === 0) {
    return null;
  }
  return (
    <span className="diff-stat" aria-label={`${additions} additions, ${deletions} deletions`}>
      {additions > 0 ? <em className="diff-stat-add">+{additions}</em> : null}
      {deletions > 0 ? <em className="diff-stat-del">−{deletions}</em> : null}
    </span>
  );
}

export type DiffRowType = "unchanged" | "add" | "del";

export type DiffRow = {
  type: DiffRowType;
  text: string;
  beforeLine?: number;
  afterLine?: number;
};

// Line-level diff using a longest-common-subsequence walk, mirroring the
// gutter/+/- presentation found in code editors.
export function diffLines(before: string, after: string): DiffRow[] {
  const a = before.length ? before.split("\n") : [];
  const b = after.length ? after.split("\n") : [];
  const n = a.length;
  const m = b.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "unchanged", text: a[i], beforeLine: i + 1, afterLine: j + 1 });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ type: "del", text: a[i], beforeLine: i + 1 });
      i++;
    } else {
      rows.push({ type: "add", text: b[j], afterLine: j + 1 });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "del", text: a[i], beforeLine: i + 1 });
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", text: b[j], afterLine: j + 1 });
    j++;
  }
  return rows;
}

export function diffStat(rows: DiffRow[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const row of rows) {
    if (row.type === "add") additions++;
    else if (row.type === "del") deletions++;
  }
  return { additions, deletions };
}

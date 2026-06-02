export type WordSegmentType = "unchanged" | "add" | "del";

export type WordSegment = {
  type: WordSegmentType;
  text: string;
};

// Split into tokens of whitespace runs and non-whitespace runs so the original
// text reconstructs exactly by concatenation while words diff independently.
function tokenize(value: string): string[] {
  return value.match(/\s+|\S+/g) ?? [];
}

// Word-level diff using an LCS walk over tokens, so changing a single word only
// highlights that word instead of the whole line or paragraph.
export function diffWords(before: string, after: string): WordSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const raw: WordSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ type: "unchanged", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      raw.push({ type: "del", text: a[i] });
      i++;
    } else {
      raw.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) raw.push({ type: "del", text: a[i++] });
  while (j < m) raw.push({ type: "add", text: b[j++] });

  // Merge adjacent segments of the same type for fewer, cleaner spans.
  const merged: WordSegment[] = [];
  for (const segment of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === segment.type) {
      last.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

export function wordDiffStat(segments: WordSegment[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const segment of segments) {
    const trimmed = segment.text.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/\s+/).length;
    if (segment.type === "add") additions += words;
    else if (segment.type === "del") deletions += words;
  }
  return { additions, deletions };
}

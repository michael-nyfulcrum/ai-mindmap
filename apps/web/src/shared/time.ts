export function nowIso() {
  return new Date().toISOString();
}

/** Compact relative time like "just now", "5s ago", "3m ago", "2h ago". */
export function formatRelativeTime(fromMs: number, nowMs: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (seconds < 5) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

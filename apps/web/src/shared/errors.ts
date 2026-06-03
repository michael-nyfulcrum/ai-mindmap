/**
 * Extract a human-readable message from a caught value for use as toast detail.
 * Returns undefined for generic/empty errors so callers can fall back cleanly.
 */
export function errorDetail(error: unknown): string | undefined {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return undefined;
}

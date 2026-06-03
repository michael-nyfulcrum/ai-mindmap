/**
 * Whether an event target is a text-editing surface (input, textarea, or
 * contenteditable). Used to suppress canvas keyboard shortcuts while typing.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== "string") {
    return false;
  }
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
}

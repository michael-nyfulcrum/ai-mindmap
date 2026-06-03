import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Panel } from "../shared/ui/Panel";
import { useModalDismiss } from "../shared/useModalDismiss";

type ShortcutsOverlayProps = {
  onClose: () => void;
};

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["⌘/Ctrl", "K"], label: "Find a node" },
  { keys: ["⌘/Ctrl", "S"], label: "Save now" },
  { keys: ["⌘/Ctrl", "D"], label: "Duplicate selection" },
  { keys: ["⌘/Ctrl", "A"], label: "Select all nodes" },
  { keys: ["Arrows"], label: "Nudge selected nodes" },
  { keys: ["Shift", "click"], label: "Add to selection" },
  { keys: ["Double-click"], label: "Center a node" },
  { keys: ["Enter"], label: "Send a chat message" },
  { keys: ["Esc"], label: "Close dialogs" },
  { keys: ["?"], label: "Show this help" },
];

export function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="shortcuts-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onMouseDown={onClose}
    >
      <Panel className="shortcuts-dialog">
        <div className="shortcuts-inner" onMouseDown={(event) => event.stopPropagation()}>
          <header className="shortcuts-head">
            <strong>Keyboard shortcuts</strong>
            <button type="button" onClick={onClose} aria-label="Close" title="Close">
              <X size={16} />
            </button>
          </header>
          <ul className="shortcuts-list">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.label}>
                <span>{shortcut.label}</span>
                <span className="shortcuts-keys">
                  {shortcut.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>,
    document.body,
  );
}

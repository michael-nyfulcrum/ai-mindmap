import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, Download, FileJson, FileText, Image as ImageIcon, Upload } from "lucide-react";
import { IconButton } from "../shared/ui/IconButton";

type ExportMenuProps = {
  onExportImage: () => void;
  onExportMarkdown: () => void;
  onCopyMarkdown?: () => void;
  onExportJson?: () => void;
  onImportJson?: () => void;
};

export function ExportMenu({ onExportImage, onExportMarkdown, onCopyMarkdown, onExportJson, onImportJson }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="export-menu" ref={ref}>
      <IconButton
        icon={<Download size={18} />}
        label="Export / Import"
        active={open}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      />
      {open ? (
        <div className="export-menu-list" role="menu">
          <button type="button" role="menuitem" onClick={() => run(onExportImage)}>
            <ImageIcon size={15} /> Export PNG
          </button>
          <button type="button" role="menuitem" onClick={() => run(onExportMarkdown)}>
            <FileText size={15} /> Export Markdown
          </button>
          {onCopyMarkdown ? (
            <button type="button" role="menuitem" onClick={() => run(onCopyMarkdown)}>
              <ClipboardCopy size={15} /> Copy as Markdown
            </button>
          ) : null}
          {onExportJson ? (
            <button type="button" role="menuitem" onClick={() => run(onExportJson)}>
              <FileJson size={15} /> Export JSON
            </button>
          ) : null}
          {onImportJson ? (
            <button type="button" role="menuitem" onClick={() => run(onImportJson)}>
              <Upload size={15} /> Import JSON
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

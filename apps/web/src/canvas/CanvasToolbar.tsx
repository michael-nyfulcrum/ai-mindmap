import { memo } from "react";
import {
  Brain,
  CheckSquare,
  Database,
  FilePlus2,
  ImagePlus,
  Lightbulb,
  Link,
  NotebookPen,
  Save,
  Scan,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "../shared/ui/Button";
import { IconButton } from "../shared/ui/IconButton";
import { ExportMenu } from "./ExportMenu";
import type { CanvasNodeType } from "./canvasTypes";

type CanvasToolbarProps = {
  onAddNode: (type: CanvasNodeType) => void;
  onFitView: () => void;
  onAutoArrange: () => void;
  onExportImage: () => void;
  onExportMarkdown: () => void;
  onCopyMarkdown?: () => void;
  onExportJson?: () => void;
  onImportJson?: () => void;
  onSuggest: () => void;
  aiBusy: boolean;
  onSave: () => void;
  onLoadDemo: () => void;
  onDeleteItems: () => void;
  activeItemCount: number;
};

const nodeButtons: Array<{ type: CanvasNodeType; label: string; icon: React.ReactNode }> = [
  { type: "project_contract", label: "Project Contract", icon: <Brain size={18} /> },
  { type: "requirement", label: "Requirement", icon: <CheckSquare size={18} /> },
  { type: "source_snapshot", label: "Source", icon: <Database size={18} /> },
  { type: "link", label: "Link", icon: <Link size={18} /> },
  { type: "image", label: "Image", icon: <ImagePlus size={18} /> },
  { type: "note", label: "Note", icon: <NotebookPen size={18} /> },
];

export const CanvasToolbar = memo(function CanvasToolbar({
  onAddNode,
  onFitView,
  onAutoArrange,
  onExportImage,
  onExportMarkdown,
  onCopyMarkdown,
  onExportJson,
  onImportJson,
  onSuggest,
  aiBusy,
  onSave,
  onLoadDemo,
  onDeleteItems,
  activeItemCount,
}: CanvasToolbarProps) {
  return (
    <aside className="canvas-toolbar" aria-label="Canvas tools">
      <div className="toolbar-group">
        {nodeButtons.map((button) => (
          <IconButton
            key={button.type}
            icon={button.icon}
            label={`Add ${button.label}`}
            onClick={() => onAddNode(button.type)}
            className={`toolbar-node-btn-${button.type}`}
          />
        ))}
      </div>
      <div className="toolbar-sep" aria-hidden="true" />
      <div className="toolbar-group">
        <IconButton icon={<Scan size={18} />} label="Fit view" onClick={onFitView} />
        <IconButton icon={<Wand2 size={18} />} label="Auto-arrange" onClick={onAutoArrange} />
        <IconButton
          icon={<Lightbulb size={18} />}
          label="AI suggest changes"
          onClick={onSuggest}
          disabled={aiBusy}
          className="toolbar-suggest-btn"
        />
        <ExportMenu
          onExportImage={onExportImage}
          onExportMarkdown={onExportMarkdown}
          onCopyMarkdown={onCopyMarkdown}
          onExportJson={onExportJson}
          onImportJson={onImportJson}
        />
        <IconButton icon={<Save size={18} />} label="Save (⌘/Ctrl+S)" onClick={onSave} />
        <IconButton
          icon={<Trash2 size={18} />}
          label="Delete"
          onClick={onDeleteItems}
          disabled={activeItemCount === 0}
        />
      </div>
      <Button icon={<FilePlus2 size={16} />} onClick={onLoadDemo} variant="ghost">
        Demo
      </Button>
    </aside>
  );
});

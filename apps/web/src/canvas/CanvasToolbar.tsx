import {
  Brain,
  CheckSquare,
  Database,
  FilePlus2,
  ImagePlus,
  Link,
  NotebookPen,
  Save,
  Scan,
  Trash2,
} from "lucide-react";
import { Button } from "../shared/ui/Button";
import { IconButton } from "../shared/ui/IconButton";
import type { CanvasNodeType } from "./canvasTypes";

type CanvasToolbarProps = {
  onAddNode: (type: CanvasNodeType) => void;
  onFitView: () => void;
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

export function CanvasToolbar({
  onAddNode,
  onFitView,
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
          />
        ))}
      </div>
      <div className="toolbar-group">
        <IconButton icon={<Scan size={18} />} label="Fit view" onClick={onFitView} />
        <IconButton icon={<Save size={18} />} label="Save" onClick={onSave} />
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
}

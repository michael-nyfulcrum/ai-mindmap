import { X, FolderOpen, Brain, CheckSquare, Link2, Workflow, Bot, Code2 } from "lucide-react";

type Step = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: <FolderOpen size={18} />,
    title: "Projects",
    description: "Create a project to group your work. Each project is an independent mindmap.",
  },
  {
    icon: <Brain size={18} />,
    title: "Project Contract",
    description: "Add a Contract node to define scope, goals, and key decisions for the project.",
  },
  {
    icon: <CheckSquare size={18} />,
    title: "Requirements",
    description: "Add Requirement nodes to break down what needs to be built or delivered.",
  },
  {
    icon: <Link2 size={18} />,
    title: "Sources & Links",
    description: "Attach source snapshots, external links, images, and notes as supporting context.",
  },
  {
    icon: <Workflow size={18} />,
    title: "Connections",
    description: "Draw edges between nodes to show relationships and dependencies.",
  },
  {
    icon: <Bot size={18} />,
    title: "AI Chat",
    description: "Ask questions in the chat panel. The AI reads the full canvas and cites relevant nodes.",
  },
  {
    icon: <Code2 size={18} />,
    title: "Agent Handoff",
    description: "Export a prompt from Agent Handoff to give coding agents direct, structured context.",
  },
];

export function TutorialDialog({ onClose }: { onClose: () => void }) {
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div className="tutorial-backdrop" onClick={handleBackdropClick}>
      <div className="tutorial-dialog">
        <div className="tutorial-header">
          <h2>How it works</h2>
          <button onClick={onClose} aria-label="Close tutorial">
            <X size={18} />
          </button>
        </div>

        <ol className="tutorial-steps">
          {STEPS.map((step) => (
            <li key={step.title} className="tutorial-step">
              <span className="tutorial-step-icon">{step.icon}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="tutorial-footer">
          <button className="project-picker-cta" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

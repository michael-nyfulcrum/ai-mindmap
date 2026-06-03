import { useState } from "react";
import { Check, Copy, Plug, Terminal, X } from "lucide-react";
import type { CanvasProject } from "./canvasTypes";
import { Button } from "../shared/ui/Button";
import { Panel } from "../shared/ui/Panel";
import { copyText } from "../shared/clipboard";
import { toast } from "../shared/toast";
import { useModalDismiss } from "../shared/useModalDismiss";

type ConnectAgentModalProps = {
  project: CanvasProject;
  onClose: () => void;
};

type AgentTab = "claude-code" | "claude-desktop" | "codex";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}`;
const RAW_MCP_URL = import.meta.env.VITE_MCP_URL || `${window.location.origin}/mcp`;

const TABS: { id: AgentTab; label: string }[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "codex", label: "Codex" },
];

const MCP_TOOLS = [
  "list_canvas_projects",
  "get_canvas_context",
  "get_canvas_snapshot",
  "upsert_requirement_node",
  "upsert_source_snapshot_node",
];

export function ConnectAgentModal({ project, onClose }: ConnectAgentModalProps) {
  const [tab, setTab] = useState<AgentTab>("claude-code");
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);
  const mcpUrl = RAW_MCP_URL.startsWith("http") ? RAW_MCP_URL : `${window.location.origin}${RAW_MCP_URL}`;
  const canvasUrl = `${window.location.origin}/canvas/${project.id}`;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="connect-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Connect your coding agent"
      onMouseDown={onClose}
    >
      <Panel className="connect-modal">
        <div className="connect-inner" onMouseDown={(event) => event.stopPropagation()}>
          <header className="connect-head">
            <div className="connect-head-meta">
              <span className="connect-kicker">
                <Plug size={13} /> Connect an agent
              </span>
              <strong className="connect-title">Use this canvas as source of truth</strong>
              <p className="connect-sub">
                Point Claude or Codex at this project&apos;s MCP server so your coding agent reads the contract,
                requirements, and change history before it writes code.
              </p>
            </div>
            <Button icon={<X size={15} />} variant="ghost" onClick={onClose} aria-label="Close" title="Close" />
          </header>

          <div className="connect-endpoint-row">
            <div className="connect-endpoint">
              <span className="connect-label">MCP endpoint</span>
              <CopyField value={mcpUrl} mono oneLine />
            </div>
            <div className="connect-endpoint">
              <span className="connect-label">This canvas</span>
              <CopyField value={canvasUrl} mono oneLine />
            </div>
          </div>

          <nav className="connect-tabs" aria-label="Agent">
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={["connect-tab", tab === entry.id ? "is-active" : ""].filter(Boolean).join(" ")}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </nav>

          <div className="connect-body">
            {tab === "claude-code" ? (
              <ClaudeCodeSteps mcpUrl={mcpUrl} projectId={project.id} />
            ) : tab === "claude-desktop" ? (
              <ClaudeDesktopSteps mcpUrl={mcpUrl} />
            ) : (
              <CodexSteps mcpUrl={mcpUrl} />
            )}
          </div>

          <footer className="connect-foot">
            <div className="connect-tools">
              <span className="connect-label">Tools your agent gets</span>
              <div className="connect-tool-chips">
                {MCP_TOOLS.map((tool) => (
                  <code key={tool}>{tool}</code>
                ))}
              </div>
            </div>
            <span className="connect-foot-note">
              API: <code>{API_BASE_URL}</code>
            </span>
          </footer>
        </div>
      </Panel>
    </div>
  );
}

function ClaudeCodeSteps({ mcpUrl, projectId }: { mcpUrl: string; projectId: string }) {
  return (
    <ol className="connect-steps">
      <li>
        <span className="connect-step-text">Register the server from your project directory:</span>
        <CopyField value={`claude mcp add --transport http ai-mindmap ${mcpUrl}`} mono />
      </li>
      <li>
        <span className="connect-step-text">
          Launch Claude Code and confirm the connection with <code>/mcp</code> — you should see{" "}
          <strong>ai-mindmap</strong> listed.
        </span>
      </li>
      <li>
        <span className="connect-step-text">Hand it the project so it pulls live context:</span>
        <CopyField
          value={`Use the ai-mindmap MCP server: call get_canvas_context for project ${projectId} and treat the contract, requirements, and impact flags as source of truth.`}
        />
      </li>
    </ol>
  );
}

function ClaudeDesktopSteps({ mcpUrl }: { mcpUrl: string }) {
  const config = JSON.stringify(
    { mcpServers: { "ai-mindmap": { command: "npx", args: ["-y", "mcp-remote", mcpUrl] } } },
    null,
    2,
  );
  return (
    <ol className="connect-steps">
      <li>
        <span className="connect-step-text">
          Open <code>claude_desktop_config.json</code> (Settings → Developer → Edit Config), then merge in:
        </span>
        <CopyField value={config} mono />
      </li>
      <li>
        <span className="connect-step-text">
          Fully quit and reopen Claude Desktop. The <strong>ai-mindmap</strong> tools appear under the{" "}
          <Terminal size={12} /> tools menu.
        </span>
      </li>
    </ol>
  );
}

function CodexSteps({ mcpUrl }: { mcpUrl: string }) {
  const toml = `[mcp_servers.ai-mindmap]\ncommand = "npx"\nargs = ["-y", "mcp-remote", "${mcpUrl}"]`;
  return (
    <ol className="connect-steps">
      <li>
        <span className="connect-step-text">One-line setup with the Codex CLI:</span>
        <CopyField value={`codex mcp add ai-mindmap -- npx -y mcp-remote ${mcpUrl}`} mono />
      </li>
      <li>
        <span className="connect-step-text">
          …or add it to <code>~/.codex/config.toml</code> manually:
        </span>
        <CopyField value={toml} mono />
      </li>
      <li>
        <span className="connect-step-text">
          Start <code>codex</code> and ask it to call <code>get_canvas_context</code> before implementing.
        </span>
      </li>
    </ol>
  );
}

function CopyField({ value, mono = false, oneLine = false }: { value: string; mono?: boolean; oneLine?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void copyText(value).then((ok) => {
      if (!ok) {
        toast.error("Couldn't copy to clipboard", undefined, "Select the text and copy manually.");
        return;
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className={["copy-field", mono ? "is-mono" : "", oneLine ? "is-one-line" : ""].filter(Boolean).join(" ")}>
      <pre>
        <code>{value}</code>
      </pre>
      <button type="button" className="copy-field-button" onClick={handleCopy} aria-label="Copy" title="Copy">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

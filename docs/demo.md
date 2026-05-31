# ai-mindmap Demo

## Description

ai-mindmap is the single source of truth that finally closes the gap between business intent and engineering execution. Teams map their entire project — contracts, requirements, decisions, and source references — onto a living, collaborative canvas that both humans and AI agents read from in real time. Every change is tracked, every decision is logged, and when requirements evolve the platform automatically surfaces exactly which parts of the project are impacted, so nothing slips through the cracks and no one is working off stale context. Business and tech stay locked in through a shared visual layer that replaces scattered docs, lost Slack threads, and tribal knowledge — and the built-in MCP server plugs directly into any AI coding assistant, giving developers autonomous, context-aware AI that actually understands the project rather than guessing from the codebase. The result is tighter alignment, faster iteration, and a team that ships with confidence because everyone — human and AI — is always working from the same ground truth.

## Demo Flow

### 1. User Creates a Project

The user opens Context Canvas and creates a new project from a template or from scratch. They add nodes to the canvas: a project contract, requirement nodes, and source references (e.g. a Jira ticket, a Confluence page, a Figma link). They connect these nodes with labeled edges to express relationships — a requirement that "depends on" a source, or a spec that "implements" a contract. The canvas saves automatically after every change.

### 2. User Uses MCP While Coding

The user opens their AI coding assistant (e.g. Claude Code) and connects it to the Context Canvas MCP server using the endpoint shown in the canvas's Agent Handoff panel. The agent calls `get_canvas_context()` and receives the full project context — requirements, source nodes, relationships, and any active impact flags — formatted as structured Markdown. The agent uses this to answer questions, write code aligned to actual requirements, and cite specific nodes, all grounded in what the canvas says rather than what the codebase implies.

### 3. User Changes Requirements on the Canvas; Select Nodes Flag as Needing Update

The user returns to the canvas and edits the project contract or a requirement — changing scope, updating acceptance criteria, or revising wording. On save, the system detects the semantic change, identifies connected nodes that may be affected, and runs an AI-powered impact analysis. Only the nodes that are genuinely downstream of the change are flagged — not every node on the canvas. Each flagged node receives a visible badge ("Needs update", "Outdated", or "Conflict") directly on the canvas. The next time the coding agent calls `get_canvas_context()`, it receives the flagged nodes alongside a plain-English change summary and can factor them into its next task — prompting targeted, context-aware updates rather than a full re-review.

# ai-mindmap Demo

## Description

ai-mindmap is the single source of truth that finally closes the gap between business intent and engineering execution. Teams map their entire project — contracts, requirements, decisions, and source references — onto a living, collaborative canvas that both humans and AI agents read from in real time. Every change is tracked, every decision is logged, and when requirements evolve the platform automatically surfaces exactly which parts of the project are impacted, so nothing slips through the cracks and no one is working off stale context. Business and tech stay locked in through a shared visual layer that replaces scattered docs, lost Slack threads, and tribal knowledge — and the built-in MCP server plugs directly into any AI coding assistant, giving developers autonomous, context-aware AI that actually understands the project rather than guessing from the codebase. The result is tighter alignment, faster iteration, and a team that ships with confidence because everyone — human and AI — is always working from the same ground truth.

## Demo Positioning

This demo is intentionally portable. The stack is made from boring,
open-source building blocks: Vite/React, FastAPI, FastMCP, SQLite, Docker
Compose, and Caddy. It can run on a laptop, a cheap VPS, an EC2 instance, a
DigitalOcean droplet, or any server that can run Docker. There is no required
Vercel account, no Supabase project, no managed database contract, and no
product-specific deployment workflow to learn before the demo works.

That matters in a sales demo. A hosted-platform demo can look simple until it
depends on vendor dashboards, usage limits, pricing tiers, environment-specific
secrets, and platform support knowledge. Context Canvas keeps the operational
story direct: copy the repo or release package, set `.env`, run the Makefile
checks, and bring up the same containers everywhere. If a customer wants the
demo on their own infrastructure, the answer is "yes" without a migration plan
or a new cloud bill.

Use this when comparing against demos built around Supabase, Vercel, or similar
platform-specific stacks:

- No vendor lock-in: the app, API, MCP server, reverse proxy, SQLite database,
  and uploads run together under Docker Compose.
- No required paid platform account: the live demo needs a server, DNS, and an
  OpenAI API key for AI features, not a bundle of hosting products.
- No platform-specific ops knowledge: standard Linux, Docker, Caddy, and
  Makefile commands are enough to deploy, inspect logs, back up data, and
  restart the service.
- Easy customer handoff: the same package can be moved from a laptop to a
  server without rewriting the architecture around a vendor's deployment model.

## Live Demo Script

Use this flow when presenting the hosted demo. The goal is to show that Context
Canvas is both the project workspace and the context source that AI agents can
trust.

1. Open the live demo and start from the seeded project.
   - Say: "This is the shared project map. It keeps contracts, requirements,
     sources, and decisions connected instead of scattering them across docs and
     chat threads."
   - Point out the contract, requirement, source, note, link, and image nodes.

2. Create or inspect a requirement node.
   - Show that requirements are first-class project objects, not just text in a
     document.
   - Open the inspector and highlight the title, content, source metadata, and
     relationships.

3. Connect the requirement to a source or contract.
   - Say: "The edge matters because this tells the system what depends on what.
     When a requirement changes, the canvas knows where to look for downstream
     impact."

4. Edit a requirement or contract.
   - Make a small but meaningful wording change, such as changing acceptance
     criteria or scope.
   - Save the change and show the version history or before/after diff.

5. Show impact analysis and badges.
   - Point out that only affected nodes are flagged.
   - Say: "This is the difference between a smart project map and a pile of
     documents. The system narrows the review surface instead of asking the team
     to reread everything."

6. Use AI chat against the canvas.
   - Ask a question like: "Which requirements are affected by the latest
     contract change?"
   - Highlight that answers cite saved canvas context rather than guessing from
     loose prompt text.

7. Open the Developer Handoff panel.
   - Show the MCP endpoint and setup instructions.
   - Say: "The same context a product person sees here is what an AI coding
     agent can read through MCP. The agent starts from the current project truth,
     not from stale assumptions in the codebase."

8. Close with the deployment point.
   - Say: "This is not glued to a proprietary hosting workflow. The demo runs as
     standard Docker services with Caddy, SQLite, and a normal Linux server."

## Objection Handling

Use these answers to keep the demo credible and direct.

- Do we need Supabase?
  No. The demo stores SQLite data and uploads in a Docker volume. Supabase could
  be integrated later if a customer wants managed Postgres/auth, but it is not
  required for this demo to run.

- Do we need Vercel?
  No. Caddy serves the built Vite frontend and reverse-proxies `/api`, `/health`,
  and `/mcp` to the backend services. A normal server is enough.

- Can this run on our own infrastructure?
  Yes. The intended handoff is a repo checkout or release package plus `.env`,
  Docker Compose, and Makefile commands. It can run on a laptop, a private VPS,
  or a customer-controlled Linux host.

- What paid dependency exists?
  AI features require an OpenAI API key. The hosting stack itself does not
  require paid Supabase, Vercel, or managed database accounts.

- Is SQLite enough?
  For a focused demo and simple single-server deployment, yes. The important
  architectural point is that the app owns its persistence behind the API and MCP
  layers, so the demo is not designed around a specific database vendor.

- Is this just another project board?
  No. The differentiator is the connected context graph plus MCP access. Humans
  update the same project map that coding agents use as structured, current
  context.

- Is auth included?
  Not in the current demo. The live demo is intentionally open and no-login so
  prospects can see the workflow quickly.

## Known Limits

Be explicit about these limits if they come up. Owning the boundaries makes the
demo stronger.

- Auth and permissions are not implemented in the current demo.
- SQLite is the current persistence layer for the portable demo stack.
- Uploads are stored with the app data volume and should be backed up with
  `make live-backup-data`.
- AI chat and AI impact analysis require a configured `OPENAI_API_KEY`.
- Jira, Confluence, Slack, Figma, and GitHub workflows are not the core demo
  gate; some source metadata is present, but deep integrations are deferred or
  experimental.
- Frontend interaction testing is currently manual.
- The live demo should be treated as a focused product proof, not a hardened
  multi-tenant SaaS deployment.

## Demo Flow

### 1. User Creates a Project

The user opens Context Canvas and creates a new project from a template or from scratch. They add nodes to the canvas: a project contract, requirement nodes, and source references (e.g. a Jira ticket, a Confluence page, a Figma link). They connect these nodes with labeled edges to express relationships — a requirement that "depends on" a source, or a spec that "implements" a contract. The canvas saves automatically after every change.

### 2. User Uses MCP While Coding

The user opens their AI coding assistant (e.g. Claude Code) and connects it to the Context Canvas MCP server using the endpoint shown in the canvas's Agent Handoff panel. The agent calls `get_canvas_context()` and receives the full project context — requirements, source nodes, relationships, and any active impact flags — formatted as structured Markdown. The agent uses this to answer questions, write code aligned to actual requirements, and cite specific nodes, all grounded in what the canvas says rather than what the codebase implies.

### 3. User Changes Requirements on the Canvas; Select Nodes Flag as Needing Update

The user returns to the canvas and edits the project contract or a requirement — changing scope, updating acceptance criteria, or revising wording. On save, the system detects the semantic change, identifies connected nodes that may be affected, and runs an AI-powered impact analysis. Only the nodes that are genuinely downstream of the change are flagged — not every node on the canvas. Each flagged node receives a visible badge ("Needs update", "Outdated", or "Conflict") directly on the canvas. The next time the coding agent calls `get_canvas_context()`, it receives the flagged nodes alongside a plain-English change summary and can factor them into its next task — prompting targeted, context-aware updates rather than a full re-review.

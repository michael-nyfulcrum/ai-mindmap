# mindmap Demo

mindmap is the single source of truth that closes the gap between
business intent, engineering execution, and AI-assisted development. Teams map
contracts, requirements, source references, decisions, and specs onto one living
canvas that PMs can maintain, developers can trust, and coding agents can read
through MCP.

The sales story is simple: most AI productivity tooling starts at the codebase.
mindmap starts earlier, where the intent is born. It turns requirements
into structured execution context, then turns that context into spec-driven
delivery.

## Five-Minute Pitch

Use these as Google Slides copy. Keep the visible slide text minimal and put the
talk track in speaker notes.

### Slide 1: Intro

Visible slide:

```text
mindmap
One truth for PMs, developers, and AI
```

Speaker notes:

Every software team has the same expensive problem: product intent lives in one
place, developer execution lives somewhere else, and AI tools are forced to
guess from whatever context we paste into them. mindmap closes that gap.
It turns contracts, requirements, decisions, sources, and specs into one living
project map that PMs can maintain, developers can trust, and AI agents can read
directly.

### Slide 2: The Problem

Visible slide:

```text
AI is only as good as its context
```

Speaker notes:

AI coding is not blocked by model capability anymore. It is blocked by context
quality. If the source of truth is scattered across Jira, docs, Slack, Figma,
old tickets, and tribal memory, the agent starts from stale assumptions. For
senior developers and CTOs, that means rework, review risk, brittle handoffs,
and no reliable trace from business change to engineering change.

### Slide 3: The Product

Visible slide:

```text
A living requirements graph
for humans and agents
```

Speaker notes:

mindmap is not another project board. It is a connected graph of
contracts, requirements, source snapshots, notes, links, images, decisions, and
now implementation specs. The relationships are the differentiator. When a
requirement changes, the system understands what depends on it. That gives the
team a smaller, smarter review surface and gives AI agents structured context
instead of loose prompt soup.

### Slide 4: Spec-Driven Design

Visible slide:

```text
Specs are the new handoff
```

Speaker notes:

Spec-driven design is the future of development because AI agents need clear,
testable execution contracts, not vague tickets or long chat threads. The
winning teams will not be the ones that simply ask AI to write more code. They
will be the ones that turn product intent into structured specs, keep those
specs connected to source evidence, and let developers and agents build from the
same verified truth. mindmap makes that workflow practical: visual intent
becomes a spec, the spec becomes the delivery contract, and the agent implements
against requirements that are traceable, reviewable, and change-aware.

### Slide 5: What It Does

Visible slide:

```text
Map
Track
Analyze
Spec
Handoff
```

Speaker notes:

First, we map the project visually. Second, every meaningful requirement and
contract edit is versioned. Third, AI impact analysis flags only the nodes that
are genuinely affected. Fourth, the new spec-driven design flow turns a canvas
node into a GitHub Spec Kit-style feature spec with functional requirements,
acceptance criteria, development requirements, and traceability back to the
canvas. Fifth, MCP hands that spec to the coding agent as the implementation
contract.

### Slide 6: Demo Flow

Visible slide:

```text
Canvas to spec
Spec to code
Change to update
```

Speaker notes:

I will keep the demo tight. We create a project from a template, inspect the
connected project map, generate a spec from one requirement, and hand that spec
to a coding agent through MCP. Then we change the contract, show targeted impact
badges, regenerate or resync the spec, and ask the agent to update only what
changed. The wow moment is that the canvas stays the source of truth from
product intent to executable delivery.

### Slide 7: Why This Wins

Visible slide:

```text
Less guessing
Less rework
More throughput
No platform lock-in
```

Speaker notes:

This wins because it solves the real enterprise AI problem: trusted context.
PMs get a visual product brain. Developers get traceable, testable requirements.
CTOs get a repeatable spec-driven delivery layer that boosts productivity
without turning the stack into a vendor science project. AI agents get current
context through MCP, not screenshots, stale docs, or vibes. It is portable,
auditable, and built on boring infrastructure: React, FastAPI, FastMCP, SQLite,
Docker Compose, and Caddy.

### Slide 8: Close

Visible slide:

```text
Context becomes execution
```

Speaker notes:

The future is not just AI writing more code. The future is AI executing the
right spec from the right context. mindmap turns project knowledge into
an execution layer. It keeps humans and AI aligned on the same live truth, then
pushes that truth forward into spec-driven design, implementation, and change
management.

## Demo Positioning

The demo should feel like the future of product delivery: a lightweight command
center where product intent becomes structured engineering output, then becomes
AI-executable implementation context.

Use these framing points:

- mindmap is the project brain: contracts, requirements, decisions,
  source evidence, and specs stay connected.
- Spec-driven design is the accelerator: the canvas generates implementation
  specs with `FR-###` functional requirements, acceptance criteria, development
  requirements, and traceability to canvas node IDs.
- MCP is the execution bridge: coding agents can fetch current context and specs
  directly instead of relying on copy-pasted prompts.
- Impact analysis is the governance layer: when intent changes, only genuinely
  affected nodes are flagged for review.
- The deployment is portable: the demo runs with Vite/React, FastAPI, FastMCP,
  SQLite, Docker Compose, and Caddy.

The competitive angle should be confident but defensible. This is not glued to
Vercel, Supabase, or a proprietary platform workflow. A normal Linux server,
Docker, DNS, and an OpenAI API key are enough for the live AI demo. Customers can
run it on their own infrastructure without buying into a managed-hosting maze.

## Executive Value Proposition

Use this language when the room wants the bigger vision.

mindmap is an AI-native delivery layer for modern software teams. It creates a
context fabric across product, engineering, and agentic workflows so teams can
move from business intent to implementation-ready specs without losing
traceability. The canvas becomes the control plane for requirements, the spec
becomes the execution contract, and MCP becomes the bridge into autonomous
development.

The productivity promise is not "AI writes code faster" in isolation. The
promise is higher-throughput delivery with less context loss, tighter feedback
loops, cleaner governance, and a repeatable product-to-code pipeline. It is
spec-driven design, impact-aware change management, and agent-ready execution
context in one operating model.

## Live Demo Story

The story: a PM captures intent on the canvas, the canvas turns that intent into
a spec, a coding agent implements from the spec through MCP, then a stakeholder
changes scope and the system narrows the update path.

Recommended timebox:

- Slides: 60-75 seconds.
- Canvas project creation and inspection: 45 seconds.
- Spec generation and agent handoff: 75-90 seconds.
- Requirement change and impact badges: 45-60 seconds.
- Agent update / close: 60-90 seconds.

## Current Live URLs

- App: `https://7865420.xyz`
- API: `https://7865420.xyz/api`
- MCP: `https://7865420.xyz/mcp`

## Before The Demo

Reset the live data to an empty project list on the live server, or through a
Docker context that points at it:

```sh
make demo-reset
```

This backs up current data to `dist/backups/`, wipes the SQLite DB and uploads,
restarts the stack, and verifies `/api/projects` is empty. To skip the
confirmation prompt during a rehearsed run:

```sh
FORCE=1 make demo-reset
```

Confirm the app loads clean at `https://7865420.xyz`. The project picker should
show no saved projects.

Wire the coding agent to the MCP server in the scratch directory where the demo
app will be generated:

```sh
mkdir -p ~/demo-app && cd ~/demo-app
claude mcp add --transport http context-canvas https://7865420.xyz/mcp
```

Verify the tools are visible in the coding agent. The important ones for the
demo are `list_canvas_projects`, `get_canvas_context`, and `get_canvas_spec`.

## Demo Script

### 1. Create A Project

In the app, create a project from a template. Recommended: **Sales E-commerce
App**. One click populates the canvas with a contract, source snapshots, and
requirement nodes connected by `implements` edges.

Talk track:

> This is the shared project map: the contract, the requirements, and the
> sources that back them, all connected. This is what both the team and the AI
> agent read from. We are not starting from a blank prompt; we are starting from
> structured product truth.

### 2. Inspect The Requirement Graph

Open the contract and one requirement node. Point out:

- Requirement text.
- Source relationships.
- Version history.
- AI actions.
- The new **Create spec** action.

Talk track:

> Requirements are first-class product assets here. They are not buried in a
> meeting note or converted into a ticket that loses half the context. The graph
> keeps the business source, requirement, and delivery path connected.

### 3. Generate A Spec

Select a focused requirement such as **Cart And Checkout** and click **Create
spec**. Optionally steer the spec with a short instruction:

```text
Make this implementation-ready for an AI coding agent. Emphasize checkout
behavior, validation, and testable acceptance criteria.
```

Open the generated spec node and show that it contains a structured GitHub Spec
Kit-style spec: overview, functional requirements, acceptance criteria,
development requirements, source IDs, and open questions only when needed.

Talk track:

> This is the spec-driven design moment. We are moving from conversational AI to
> executable product architecture. The PM still works visually, the developer
> gets a precise implementation contract, and the AI agent gets functional
> requirements with acceptance criteria instead of a vague task.

### 4. Hand The Spec To The Coding Agent

Copy the spec handoff prompt from the spec node, or paste this version:

```text
Use the context-canvas MCP server as the source of truth.

1. Call list_canvas_projects and pick the most recently updated project.
2. Call get_canvas_spec with that project_id and omit spec_id to use the latest
   spec node.
3. Build a single self-contained index.html with inline CSS and vanilla JS that
   implements exactly the functional requirements in the spec.
4. Cite each FR-### and canvas node ID in an HTML comment above the section that
   implements it.

Do not invent scope. If the spec marks anything [NEEDS CLARIFICATION], ask
before implementing it. After writing the file, list which FRs you implemented
and where.
```

Open the generated `index.html` in a browser and walk through the feature.

Talk track:

> The agent did not need a product manager to rewrite the requirement into a
> perfect prompt. It pulled the live spec over MCP and built against the same
> source of truth the team sees. This is how we turn AI from a clever autocomplete
> into a delivery accelerator.

### 5. Change The Contract

Back in the canvas, make a meaningful scope change. Recommended for the Sales
E-commerce template:

- Open the **Sales E-commerce App Contract** node.
- Bring previously excluded work into scope by changing the out-of-scope line so
  **discount codes / coupons at checkout** are now in scope for the first
  release.
- Save.

On save, impact analysis runs and connected requirement nodes, such as **Cart
And Checkout**, receive "Needs update" / "Outdated" badges.

Talk track:

> This is where the graph pays off. We changed the contract, but the system did
> not panic and flag the whole project. It narrowed the blast radius to the
> requirements that actually depend on the change. That is product governance,
> developer focus, and AI context hygiene in one workflow.

Alternative quick edit: update **Cart And Checkout** directly to add:

```text
Customers can apply a discount code before payment, and the order summary shows
the discounted total before checkout is confirmed.
```

### 6. Regenerate Or Resync The Spec

Select the impacted requirement and use **Create spec** again, or open the
existing spec and explain that the coding agent can re-sync current canvas
context and active impact flags.

Paste this into the coding agent:

```text
The canvas changed. Re-sync from the context-canvas MCP server and update the
app.

1. Call get_canvas_context with task "apply the latest checkout requirement
   changes". Read the active impact flags and recent change summary.
2. Call get_canvas_spec with that project_id and omit spec_id to use the latest
   relevant spec if one exists.
3. Update index.html so it matches the changed requirement and spec.
4. Tell me exactly what changed and which canvas node, impact flag, or FR drove
   the change.

Only change what the updated canvas requires. Do not redo unaffected sections.
```

Reload `index.html` to show the new behavior, such as a discount-code field at
checkout.

Talk track:

> Same agent, no new hand-written spec from me. It read the changed context, the
> impact flags, and the implementation spec over MCP, then made the targeted
> update. The canvas stayed the single source of truth from idea to spec to code
> to change.

### 7. Optional Write-Back Moment

If there is time, show that MCP can write back to the canvas:

```text
Using the context-canvas MCP server, call upsert_requirement_node on the same
project to add a requirement titled "Discount Codes" describing the discount
code behavior we just implemented, tagged ["checkout", "payments"]. Then confirm
it by calling get_canvas_context.
```

Refresh the canvas to show the agent-authored requirement node, with
`context_canvas_mcp` recorded as the actor in its history.

Talk track:

> This is a closed-loop delivery system. Humans shape intent, AI accelerates
> execution, and the project brain keeps the trace.

## Objection Handling

- Is this just another project board?
  No. The differentiator is the connected context graph plus spec generation and
  MCP access. Humans update the same project map that coding agents use as
  structured, current context.

- Why is spec-driven design important?
  It turns fuzzy requirements into an implementation-ready contract. The spec
  gives developers and AI agents concrete `FR-###` requirements, acceptance
  criteria, dependency hints, and traceability back to the canvas.

- Does this replace senior developers?
  No. It gives senior developers a better control plane. They still review
  architecture, edge cases, and implementation quality, but the repetitive
  translation from product prose to buildable tasks is accelerated.

- Do we need Supabase?
  No. The demo stores SQLite data and uploads in a Docker volume. Supabase could
  be integrated later if a customer wants managed Postgres or auth, but it is
  not required for this demo to run.

- Do we need Vercel?
  No. Caddy serves the built Vite frontend and reverse-proxies `/api`, `/health`,
  and `/mcp` to the backend services. A normal server is enough.

- Can this run on our own infrastructure?
  Yes. The intended handoff is a repo checkout or release package plus `.env`,
  Docker Compose, and Makefile commands. It can run on a laptop, private VPS, or
  customer-controlled Linux host.

- What paid dependency exists?
  AI features require an OpenAI API key. The hosting stack itself does not
  require paid Supabase, Vercel, or managed database accounts.

- Is SQLite enough?
  For a focused demo and simple single-server deployment, yes. The important
  architectural point is that the app owns its persistence behind the API and
  MCP layers, so the demo is not designed around a specific database vendor.

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
- AI chat, AI impact analysis, and AI spec generation require a configured
  `OPENAI_API_KEY`. Spec generation has a deterministic fallback for tests.
- Jira, Confluence, Slack, Figma, and GitHub workflows are not the core demo
  gate; some source metadata is present, but deep integrations are deferred or
  experimental.
- Frontend interaction testing is currently manual.
- The live demo should be treated as a focused product proof, not a hardened
  multi-tenant SaaS deployment.

## After The Demo

Reset again so the next session starts clean:

```sh
make demo-reset
```

Backups from each reset are in `dist/backups/` if you need to recover a session.

## Optional Variant: AI Seeds The Canvas

If you would rather have the agent populate the canvas instead of using a
template, create an empty project in the app first, note its name, then paste:

```text
Use the context-canvas MCP server. Call list_canvas_projects and find the
project named "<your empty project name>". For that project, call
upsert_source_snapshot_node once to add a short client brief, then call
upsert_requirement_node 3-4 times to add the core requirements for a small
<your app idea> app. Keep each requirement one short paragraph. Then call
get_canvas_context and summarize what you created.
```

MCP can create requirement and source-snapshot nodes, but not the project itself
or the `project_contract` node. Create the project in the app first, refresh the
canvas to show the agent-authored nodes, then continue with the spec-driven demo
flow.

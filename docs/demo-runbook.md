# Live Demo Runbook

Step-by-step script for the "canvas is the source of truth for AI" demo. The
story: a coding agent builds an app from the canvas, a stakeholder changes a
requirement on the canvas, and the same agent updates the app to match — all
through the MCP server, with no copy-pasting of requirements.

URLs (current live server):

- App: `https://7865420.xyz`
- API: `https://7865420.xyz/api`
- MCP: `https://7865420.xyz/mcp`

## 0. Before the demo (prep)

1. **Reset the live data to an empty project list.** Run on the live server
   (or through a Docker context that points at it):

   ```sh
   make demo-reset
   ```

   This backs up current data to `dist/backups/`, wipes the SQLite DB and
   uploads, restarts the stack, and verifies `/api/projects` is empty. To skip
   the confirmation prompt during a rehearsed run, use `FORCE=1 make demo-reset`.

2. **Confirm the app loads clean.** Open `https://7865420.xyz` — the project
   picker should show no saved projects.

3. **Wire the coding agent to the MCP server.** In the scratch directory you
   will build the app in (e.g. `~/demo-app`), connect Claude Code to the live
   MCP endpoint:

   ```sh
   mkdir -p ~/demo-app && cd ~/demo-app
   claude mcp add --transport http context-canvas https://7865420.xyz/mcp
   ```

   Verify the tools are visible (`/mcp` inside Claude Code lists
   `list_canvas_projects`, `get_canvas_context`, `upsert_requirement_node`,
   `upsert_source_snapshot_node`, ...).

4. **Keep this runbook open** for the copy-paste prompts below.

## 1. Create the project on the canvas

In the app, create a project from a template — recommended: **Sales
E-commerce App** (small storefront: catalog, cart/checkout, orders). One click
populates the canvas with a contract, source snapshots, and four requirement
nodes connected by `implements` edges.

Talk track: "This is the shared project map — the contract, the requirements,
and the sources that back them, all connected. This is what both the team and
the AI agent read from."

## 2. Build the app from the canvas (AI + MCP)

Switch to Claude Code in `~/demo-app` and paste:

```
Use the context-canvas MCP server as the source of truth for this project.

1. Call list_canvas_projects and pick the most recently updated project.
2. Call get_canvas_context for that project id with task "build a working
   prototype from the requirements".
3. Build a single self-contained index.html (inline CSS + vanilla JS, no build
   step, no external dependencies) that implements every requirement node on
   the canvas. Use in-memory sample data. It must open directly in a browser.
4. Cite each requirement node title in an HTML comment above the section that
   implements it, so we can trace code back to the canvas.

Do not invent requirements that are not on the canvas. After writing the file,
list which requirement nodes you implemented and where.
```

Open the generated `index.html` in a browser and walk through it.

Talk track: "The agent never saw a spec doc. It pulled the live canvas context
over MCP and built directly against the requirements — and it cited which node
each part came from."

## 3. Change a requirement on the canvas

Back in the app, make one meaningful change so impact analysis has something to
flag. Recommended edit for the Sales E-commerce template:

- Open the **Sales E-commerce App Contract** node.
- Bring previously-excluded work into scope — for example change the
  out-of-scope line so it reads that **discount codes / coupons at checkout**
  are now in scope for the first release.
- Save.

On save, impact analysis runs and connected requirement nodes (e.g. **Cart And
Checkout**) get "Needs update" / "Outdated" badges. Point at the badges.

Talk track: "We changed the contract. The system didn't flag the whole canvas —
only the requirements genuinely downstream of this change. That's the review
surface the team — and the agent — should focus on."

(Alternative: edit the **Cart And Checkout** requirement directly to add "apply
a discount code before payment; the order shows the discounted total".)

## 4. Update the app to the new requirement (AI + MCP)

Back in Claude Code in `~/demo-app`, paste:

```
The canvas changed. Re-sync from the context-canvas MCP server and update the app.

1. Call get_canvas_context again with task "apply the latest requirement
   changes". Read the active impact flags and the recent change summary.
2. For each flagged / changed requirement, update index.html so the app matches
   the new requirement text. Keep it a single self-contained file.
3. Tell me exactly what you changed and which canvas node drove each change.

Only change what the updated canvas requires. Do not redo unaffected sections.
```

Reload `index.html` to show the new behavior (e.g. a discount-code field at
checkout).

Talk track: "Same agent, no new instructions from me. It read the changed
context and the impact flags over MCP and made the targeted update. The canvas
stayed the single source of truth from build to change."

## 5. (Optional) Show the write-back path

If you want to show the agent writing to the canvas too, paste:

```
Using the context-canvas MCP server, call upsert_requirement_node on the same
project to add a requirement titled "Discount Codes" describing the discount
code behavior we just implemented, tagged ["checkout", "payments"]. Then confirm
it by calling get_canvas_context.
```

Refresh the canvas in the app to show the agent-authored requirement node, with
`context_canvas_mcp` recorded as the actor in its history.

## After the demo (teardown)

Reset again so the next session starts clean:

```sh
make demo-reset
```

Backups from each reset are in `dist/backups/` if you need to recover a session.

## Optional variant: AI seeds the canvas instead of a template

If you would rather have the agent populate the canvas instead of using a
template, create an empty project in the app first (note its name), then paste
this before Step 2:

```
Use the context-canvas MCP server. Call list_canvas_projects and find the
project named "<your empty project name>". For that project, call
upsert_source_snapshot_node once to add a short client brief, then call
upsert_requirement_node 3-4 times to add the core requirements for a small
<your app idea> app. Keep each requirement one short paragraph. Then call
get_canvas_context and summarize what you created.
```

Note: MCP can create requirement and source-snapshot nodes, but not the
project itself or the `project_contract` node — create the project in the app
first. Refresh the canvas to show the agent-authored nodes before continuing
with Step 2.

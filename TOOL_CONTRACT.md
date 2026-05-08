# Tool Contract Reference — ix-opencode-plugin

API reference for all 7 Ix tools. Each tool calls the `ix` CLI and returns a formatted markdown string.

---

## Contract rules (all tools)

1. **Input:** structured JSON parameters validated by OpenCode's parameter schema
2. **Output:** formatted markdown string — never raw JSON, never structured objects
3. **Fallback:** if `ix` is unavailable, return a helpful error with recovery steps rather than throwing
4. **Depth scaling:** heavier analysis phases run only when lighter phases indicate they're needed
5. **Directory:** all `ix` CLI calls run in `context.worktree ?? context.directory`

The string-only output constraint comes from the OpenCode runtime. Returning objects from tools has caused runtime issues in practice.

---

## Tools

### `ix-query`

**Purpose:** Look up a symbol, class, file, or subsystem in the Ix graph. Returns role, connections, and importance without reading source code.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `symbol` | string | yes | Symbol name, file path, or subsystem to look up |
| `kind` | enum | no | Narrow to: `function`, `class`, `file`, `module` |
| `path` | string | no | Narrow results to a specific directory path |

**Behavior:**
1. Runs `ix locate <symbol>` — resolves the entity
2. Runs `ix explain <entity>` — gets role, importance, caller/callee counts
3. Returns formatted summary

If `ix locate` returns multiple matches, returns the first result plus a note to narrow with `--kind` or `--path`.

**Example output:**
```
## ix-query: UserService

**Name:** `UserService`
**Kind:** class
**File:** src/services/user.ts
**Subsystem:** auth
**Role:** orchestrator
**Importance:** high
**Callers:** 14
**Callees:** 7

Manages user lifecycle — creation, authentication state, and session binding. Central to the auth subsystem.
```

**Fallback (ix unavailable):**
```
## ix-query: UserService

**ix unavailable.** The Ix graph service is not running or not installed.

command -v ix   # check installation
ix status       # check connection
ix map          # build graph if needed

Error: <error message>
```

---

### `ix-neighbors`

**Purpose:** Get the neighborhood of a symbol: who calls it, what it calls, and what depends on it. Purely graph-based.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `symbol` | string | yes | — | Symbol, class, or file to get neighbors for |
| `direction` | enum | no | `all` | `callers`, `callees`, `depends`, `imported-by`, `all` |
| `limit` | number | no | `15` | Max results per direction (capped at 30) |
| `depth` | number | no | `2` | Traversal depth for `depends` (max 3) |

**Behavior:**
- Runs the appropriate `ix callers`, `ix callees`, `ix depends`, or `ix imported-by` commands
- `direction: "all"` runs callers + callees in parallel
- Results grouped by direction with counts

**Example output:**
```
## ix-neighbors: AuthController

**Callers** (3 total, showing 3):
- `UserRouter` (class) [api] — src/api/user_router.ts
- `SessionRouter` (class) [api] — src/api/session_router.ts
- `AdminRouter` (class) [api] — src/api/admin_router.ts

**Callees** (8 total, showing 8):
- `UserService` (class) [auth] — src/services/user.ts
- `SessionManager` (class) [auth] — src/services/session.ts
- `TokenValidator` (function) [auth] — src/auth/tokens.ts
...
```

---

### `ix-impact`

**Purpose:** Analyze the blast radius and change risk for a symbol or file. Depth scales with detected risk level.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `target` | string | yes | Symbol name or file path to assess |

**Behavior:**
1. Runs `ix impact <target>` — gets risk level and dependent count
2. **Low risk + < 3 dependents:** stops here, returns safe-to-proceed verdict
3. **Medium/high/critical:** also runs `ix callers <target> --limit 20` for key callers
4. Returns risk report with verdict and recommended action

Risk levels: `low` → `SAFE TO PROCEED`, `medium` → `REVIEW CALLERS FIRST`, `high`/`critical` → `NEEDS CHANGE PLAN`

**Example output:**
```
## Impact: PaymentProcessor

**Risk level:** HIGH
**Verdict:** NEEDS CHANGE PLAN

**Blast radius:**
- Direct dependents: 18
- Transitive (depth 2): 42
- Subsystems affected: billing, api, webhooks

**Key callers:**
- `CheckoutService` [billing]
- `RefundHandler` [billing]
- `WebhookDispatcher` [webhooks]
- `PaymentRouter` [api]
- `AdminBillingController` [api]

**At-risk behaviors:**
- payment state transitions
- idempotency key validation

**Recommended action:**
- Run `/ix-plan PaymentProcessor` before editing. This change needs a sequenced plan.
```

---

### `ix-map`

**Purpose:** Get the architectural map of the codebase: all subsystems, cohesion/coupling scores, and codebase stats. Use for orientation before deeper exploration.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `scope` | string | no | — | Scope to a specific subsystem name or path prefix |
| `include_stats` | boolean | no | `true` | Include codebase stats (file count, nodes, edges) |

**Behavior:**
- Runs `ix subsystems`, `ix subsystems --list`, and `ix stats` in parallel
- Builds a subsystem table with cohesion/coupling scores
- Flags subsystems with low cohesion (< 0.4) or high coupling (> 0.5) with ⚠

**Example output:**
```
## ix-map

**Codebase:** 312 files · 4,821 nodes · 18,432 edges · TypeScript

**Subsystems** (6):

| Subsystem | Path | Files | Cohesion | Coupling |
|-----------|------|-------|----------|----------|
| auth      | src/auth | 48 | 0.71 | 0.22 |
| api       | src/api  | 61 | 0.68 | 0.31 |
| models ⚠  | src/models | 82 | 0.34 | 0.58 |
| services  | src/services | 55 | 0.62 | 0.28 |
| utils     | src/utils | 33 | 0.81 | 0.09 |
| billing   | src/billing | 33 | 0.74 | 0.35 |

**Subsystem names:** auth, api, models, services, utils, billing
```

---

### `ix-ingest`

**Purpose:** Check the Ix graph ingestion status. Can optionally trigger a graph rebuild.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `refresh` | boolean | no | `false` | If true, trigger `ix map` to rebuild the graph |
| `silent` | boolean | no | `true` | If refreshing: use `ix map --silent` |

**Behavior (status check):**
- Runs `ix status --format json` if available
- Falls back to probing `ix subsystems --list` if `ix status` is unavailable
- Reports connectivity, graph presence, file count, and freshness

**Behavior (refresh):**
- Runs `ix map` (or `ix map --silent`)
- Returns confirmation when complete

**Example output (status):**
```
## ix-ingest: status

**Connected:** yes
**Graph present:** yes
**Files indexed:** 312
**Last updated:** 2026-04-09T14:32:00Z
**Freshness:** current
```

**Example output (refresh):**
```
## ix-ingest: graph refresh

**Status:** Graph refresh complete.
The Ix graph has been rebuilt. Graph data is now current.
```

**Example output (ix unavailable):**
```
## ix-ingest: status

**ix CLI not found.** Install Ix to enable graph-aware features.

command -v ix   # check if installed
ix connect      # connect to workspace
ix map          # build initial graph
```

---

### `ix-history`

**Purpose:** Get change history, recorded decisions, and known bugs for a symbol or workspace. Requires Ix Pro. Returns empty results gracefully if Pro is unavailable.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `topic` | string | no | — | Symbol or topic to filter history/decisions to |
| `include` | array | no | `["briefing"]` | What to fetch: `decisions`, `bugs`, `changes`, `briefing` |

**Behavior:**
- Runs `ix briefing --format json` to check Pro availability
- If Pro is unavailable, returns a graceful message explaining what requires Pro
- If Pro is available, fetches the requested data sections
- With `topic`, runs `ix decisions --topic <topic>` for filtered decisions

**Pro features:**
- `decisions` — recorded architectural decisions
- `bugs` — open bug reports
- `changes` — recent code changes
- `briefing` — all of the above plus active goals and plans

**Example output (Pro available):**
```
## ix-history: AuthService

**Revision:** rev-4821

**Recent decisions** (2):
- Move session storage to Redis — 2026-03-15
  Motivated by horizontal scaling requirements; sessions now must be stateless.
- Deprecate legacy token format — 2026-02-28
  New tokens use JWT; legacy tokens still accepted until v3.0.

**Open bugs** (1):
- Session expires early on mobile [high] — affects `SessionManager`
```

**Example output (Pro unavailable):**
```
## ix-history

**Ix Pro not available.** History, decisions, and bug tracking require Ix Pro.

Graph-based features (ix-query, ix-neighbors, ix-impact, ix-map) work without Pro.
```

---

### `ix-docs-tool`

**Purpose:** Get a condensed architectural context summary for a symbol, subsystem, or file. Use to inject graph context before making changes — not the same as the `/ix-docs` skill (which writes full documentation).

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `target` | string | yes | — | Symbol name, file path, or subsystem to summarize |
| `depth` | enum | no | `standard` | `brief`, `standard`, `full` |

**Depth behavior:**

| Depth | What runs |
|---|---|
| `brief` | `ix locate` + `ix overview` only |
| `standard` | above + `ix explain` for top 5 key components |
| `full` | above + `ix impact` for change risk context |

**Example output (standard):**
```
## Context: billing

_33 files · TypeScript_

**Kind:** subsystem
**Path:** src/billing
**Files:** 33
**Members:** 12

Handles payment processing, subscription management, and invoice generation. Depends on the Stripe API adapter and the models subsystem.

**Key Components:**

- `PaymentProcessor` (14 callers) — orchestrates payment flow
- `SubscriptionManager` (9 callers) — manages plan lifecycle
- `InvoiceBuilder` (6 callers) — generates and formats invoices
- `StripeAdapter` (11 callers) — Stripe API boundary
- `BillingRepository` (8 callers) — persistence layer
```

---

---

### `ix-locate`

**Purpose:** Text/pattern search across the indexed codebase. Use when you have a keyword or pattern rather than an exact symbol name.

**Parameters:** `pattern` (required), `limit` (default 20, max 100), `path` (optional), `language` (optional)

**CLI:** `ix text <pattern> --limit <n> [--path P] [--language L] --format json`

**Runtime:** `POST /v2/ix_query` mode `"locate"` → `preview_markdown` shortcut

---

### `ix-explain`

**Purpose:** Full symbol explanation — role, importance level, caller/callee counts, top dependents, and a plain-English description.

**Parameters:** `symbol` (required)

**CLI:** `ix explain <symbol> --format json`

**Runtime:** `POST /v2/ix_query` mode `"investigate"` → `preview_markdown` shortcut

---

### `ix-rank`

**Purpose:** Rank symbols by a graph metric to surface hotspots and high-centrality components.

**Parameters:** `by` (default `dependents`; `callers`, `importers`, `members`), `kind` (default `class`), `top` (default 10, max 50), `path` (optional)

**CLI:** `ix rank --by <by> --kind <kind> --top <n> [--path P] --format json`

**Runtime:** `POST /v2/insights/derive` type `"centrality"` → `preview_markdown` shortcut

---

### `ix-stats`

**Purpose:** Graph-wide node/edge counts, file count, and health status. Verify the graph is indexed before running expensive queries.

**Parameters:** none

**CLI:** `ix stats --format json`

**Runtime:** `GET /v2/status` → `preview_markdown` shortcut

---

### `ix-subsystems`

**Purpose:** Detailed subsystem listing with file counts, hierarchy levels, confidence signals, and interface counts.

**Parameters:** none

**CLI:** `ix subsystems --format json`

**Runtime:** `POST /v2/graph/query` op `"subgraph"` → `preview_markdown` shortcut

---

### `ix-inventory`

**Purpose:** Enumerate files or symbols within a directory path scope from the graph.

**Parameters:** `path` (required), `kind` (default `file`; `class`, `function`, `interface`, `module`)

**CLI:** `ix inventory --kind <kind> --path <path> --format json`

**Runtime:** `POST /v2/graph/query` op `"neighbors"` → `preview_markdown` shortcut

---

### `ix-trace`

**Purpose:** Trace full execution paths through a symbol — upstream callers and downstream callees. Use for complete call chains, not just immediate neighbors.

**Parameters:** `symbol` (required), `to` (optional target for path tracing)

**CLI:** `ix trace <symbol> [--to <target>] --format json`

**Runtime:** `POST /v2/graph/query` op `"paths"` → `preview_markdown` shortcut

---

### `ix-decide`

**Purpose:** Pre-edit policy verdict (ALLOW / REVIEW / BLOCK) with required actions and blast radius evidence.

**Parameters:** `touched_paths` (required array), `intent` (default `edit`), `risk_tolerance` (default `medium`)

**CLI fallback:** `ix impact <path>` per touched file — synthesizes a conservative verdict from impact scores when runtime unavailable.

**Runtime:** `POST /v2/ix_decide` → formatted verdict string (no `preview_markdown` — full response parsed)

---

### `ix-health`

**Purpose:** Check CLI availability, graph index state, and runtime reachability.

**Parameters:** none

**CLI:** `ix status --format json` (with `ix --version` fallback)

**Runtime:** `GET /v2/status` — runtime reachability reported in output

---

### `ix-smells`

**Purpose:** Detect architecture smells — orphan files, high coupling, low cohesion, dead code, and other structural issues.

**Parameters:** `path` (optional), `limit` (default 50, max 200)

**CLI:** `ix smells [--path P] --format json`

**Runtime:** `POST /v2/insights/derive` type `"smells"` → `preview_markdown` shortcut

---

## Runtime API routing

All tools now try the Ix Core Runtime API first via `runtime/client.ts`. When the runtime returns a response with `preview_markdown`, that string is used directly as the tool output. If the runtime is unavailable (expected until the 2026-07-15 alpha), tools fall back to the ix CLI.

The runtime base URL defaults to `http://127.0.0.1:7743` and can be overridden via the `IX_RUNTIME_URL` environment variable.

Secret redaction is applied to all outbound payloads (via `runtime/secrets.ts`) and to all `preview_markdown` fields in responses.

---

## Adding a new tool

To add a tool to the plugin:

1. Create `tools/<name>.ts` following this template:
   ```typescript
   import { $ } from "bun";

   export const name = "ix-<name>";
   export const description = "...";
   export const parameters = { type: "object", properties: { ... }, required: [...] } as const;

   type Params = { ... };
   type Context = { directory: string; worktree?: string };

   export async function execute(params: Params, context: Context): Promise<string> {
     const dir = context.worktree ?? context.directory;
     // call ix CLI, format output as markdown string
     // always return a string — never throw on ix errors
   }
   ```

2. Import and register in `plugins/ix-plugin.ts`:
   ```typescript
   import * as ixNewTool from "../tools/ix-new-tool";
   // Add to plugin.tools array
   ```

3. Follow the contract:
   - Always return a string
   - Handle `ix` unavailability gracefully
   - Use `context.worktree ?? context.directory` as the working directory
   - Format output as structured markdown (headers, bullets, tables)
   - Include the tool name and target in the first heading: `## ix-<name>: <target>`

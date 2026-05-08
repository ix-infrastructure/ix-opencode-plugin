# Architecture — ix-opencode-plugin

How the plugin is designed, why it's built this way, and how all the pieces connect.

---

## Design goal

Bring Ix Memory's graph-first reasoning into OpenCode as a **native cognitive layer** — not a thin CLI wrapper. The plugin should change how OpenCode thinks, not just give it new commands.

> Skills are cognitive capabilities, not command aliases. They reason in phases, use cheap signals before expensive ones, and stop early when the question is answered.

---

## Three-layer model

```
Ix Graph      = structured memory (code relationships, history, decisions)
OpenCode      = reasoning engine (infers, synthesizes, decides)
Skills/Agents = cognition layer (task abstractions over the graph)
```

OpenCode is not a command wrapper. It uses the Ix graph as memory and synthesizes answers. The graph provides facts; OpenCode provides understanding.

---

## File structure

```
ix-opencode-plugin/
  opencode.json              # plugin manifest — wires everything together
  AGENTS.md                  # always-on context — injected into every session
  plugins/
    ix-plugin.ts             # plugin entry: registers tools and hooks
  tools/
    ix-query.ts              # graph entity lookup (locate + explain)
    ix-neighbors.ts          # neighborhood traversal (callers, callees, depends)
    ix-impact.ts             # blast radius analysis
    ix-map.ts                # architectural map and subsystem overview
    ix-ingest.ts             # ingest status and graph refresh trigger
    ix-history.ts            # revision, decisions, bugs (Ix Pro)
    ix-docs-tool.ts          # condensed context summary for injection
  commands/
    ix-understand.md         # /ix-understand — architectural mental model
    ix-investigate.md        # /ix-investigate — symbol deep dive
    ix-impact.md             # /ix-impact — blast radius analysis
    ix-plan.md               # /ix-plan — risk-ordered change plan
    ix-debug.md              # /ix-debug — root cause analysis
    ix-architecture.md       # /ix-architecture — structural health audit
    ix-docs.md               # /ix-docs — narrative-first documentation
  agents/
    ix-explorer.json         # general-purpose exploration
    ix-system-explorer.json  # full architectural model building
    ix-bug-investigator.json # autonomous debugging
    ix-safe-refactor-planner.json # blast radius + safe change sequencing
    ix-architecture-auditor.json  # structural health audit
```

---

## Component roles

### `opencode.json` — manifest

Wires the plugin together. References:
- `plugin` → `plugins/ix-plugin.ts` (tool and hook registration)
- `agent` → agent JSON files (custom agent definitions)
- `command` → command markdown files (slash command skill files)
- `instructions` → `AGENTS.md` (always-on context injection)

### `AGENTS.md` — always-on context

Injected into every OpenCode session via the `instructions` field. Contains:
- The three-layer cognitive model
- Behavioral rules (always/never)
- The seven-step reasoning strategy
- Token budget rules
- Quick reference tables for skills, agents, and ix CLI commands

This is the primary mechanism for changing OpenCode's default behavior. It doesn't require the user to invoke anything — it works passively.

### `plugins/ix-plugin.ts` — entry point

Registers all 7 tools and 5 hooks with the OpenCode runtime. Also runs `onInit` to check graph availability and trigger initial ingest if the graph is empty.

Key design decisions:
- Tools are imported from `tools/` and wrapped with the OpenCode tool interface
- All tool `execute` functions are async and return strings (see Tool contract below)
- Hooks are advisory, not blocking — they inject context but always allow the action
- The post-edit hook fires `ix map --silent` as fire-and-forget (non-blocking)

### `tools/*.ts` — CLI-backed tools

Each tool calls the `ix` CLI using Bun's `$` shell API and returns a formatted markdown string. Tools are the primitive operations; skills and agents compose them.

See [TOOL_CONTRACT.md](./TOOL_CONTRACT.md) for the full API contract.

### `commands/*.md` — slash command skills

Markdown files that define phased reasoning protocols. When a user types `/ix-understand`, OpenCode loads this file and follows the instructions.

Each skill:
- Starts with cheap graph signals (subsystems, explain, locate)
- Escalates to more expensive operations only if needed
- Has explicit stop conditions at each phase
- Produces structured output (summary, evidence, next step)

These are ported from `ix-claude-plugin/skills/` with adaptation for OpenCode's model (no Claude-specific `Agent tool` references).

### `agents/*.json` — custom agent configs

JSON files defining OpenCode custom agents. Each agent has:
- `name` — identifier used to invoke the agent
- `description` — shown in the agent picker
- `permission` — tool access (`allow`, `ask`, `deny`)
- `prompt` — full system prompt defining the agent's reasoning loop

Agents are higher-level than slash commands — they operate autonomously over multiple tool calls. Slash commands guide the current context; agents are delegated subagents for complex tasks.

---

## Hook design

Five hooks are registered in `ix-plugin.ts`:

| Hook | Event | Trigger | Behavior |
|---|---|---|---|
| `ix-pre-edit` | `tool.execute.before` | write, edit | Impact check on target file; injects risk note for medium/high/critical |
| `ix-read` | `tool.execute.before` | read | Hints to use ix-query first for broad (non-targeted) reads |
| `ix-intercept` | `tool.execute.before` | bash | Suggests `ix text` when bash command looks like grep/rg |
| `ix-ingest` | `tool.execute.after` | write, edit | Fires `ix map --silent` in background after source edits |
| `ix-errors` | `tool.execute.after` | ix-* tools | Detects stale graph signals in tool output and suggests refresh |

**Design principle: advisory, not blocking.** All hooks return `{ action: "allow" }`. The goal is to inject context that nudges behavior, not to block actions. Blocking would make the plugin feel hostile.

**Known limitation:** `tool.execute.before` may not reliably intercept subagent tool calls (open OpenCode issue). The hooks provide best-effort coverage for top-level agent actions.

---

## Tool contract

All tools follow this contract:

1. **Input:** structured JSON parameters (validated by OpenCode's parameter schema)
2. **Output:** formatted markdown string — never raw JSON, never structured objects
3. **Fallback:** if `ix` is unavailable, return a helpful error message with recovery steps
4. **Depth scaling:** heavier analysis phases only run when lighter phases indicate it's needed

Example output shape:
```
## ix-impact: UserService

**Risk level:** HIGH
**Verdict:** NEEDS CHANGE PLAN

**Blast radius:**
- Direct dependents: 14
- Transitive (depth 2): 31
- Subsystems affected: auth, api, models

**Key callers:**
- `AuthController` [auth]
- `SessionManager` [auth]
- `UserRouter` [api]
...
```

This string output constraint comes from the OpenCode runtime — returning objects or non-strings from tools has caused runtime issues.

---

## Slash command design

Skills are phased reasoning protocols, not CLI aliases. Each command file follows this structure:

```
Phase 1 — Cheap orient (subsystems, stats, locate)
           ↓ stop if answer is clear
Phase 2 — Explain / overview
           ↓ stop if sufficient
Phase 3 — Connections (callers, callees) — only if needed
           ↓ stop if sufficient
Phase 4 — Trace — only if execution flow unclear
           ↓ stop if sufficient
Phase 5 — Code read — last resort, hard limit 2 reads
```

Stop conditions at every phase prevent over-querying. The skill succeeds when it answers the question — not when it exhausts all available data.

---

## Agent design

Agents are autonomous reasoning loops. Each agent:

1. Builds its own context from graph data before acting
2. Has explicit stop conditions ("stop when you have 1–3 candidates with evidence")
3. Is scoped to appropriate tools (`bash`, `read`, `grep`, `glob`)
4. Follows the graph-before-code principle throughout

The five agents cover distinct use cases:

| Agent | Use case | Stop condition |
|---|---|---|
| `ix-explorer` | Open-ended questions | Can answer the question |
| `ix-system-explorer` | Full architectural model | All major systems documented |
| `ix-bug-investigator` | Root cause analysis | 1–3 candidates with evidence |
| `ix-safe-refactor-planner` | Change sequencing | Full plan with test checkpoints |
| `ix-architecture-auditor` | Structural health | Ranked list with metric evidence |

---

## Context injection strategy

OpenCode V1 has no clean pre-task hidden context injection hook. The plugin uses two mechanisms instead:

1. **`AGENTS.md` via `instructions` field** — always-on, injected into every session. Covers behavioral rules, reasoning strategy, and reference tables.

2. **Hook `context` return field** — hooks can return `{ action: "allow", context: "..." }` to inject context into the current tool call. Used by `ix-pre-edit` (risk notes) and `ix-intercept` (search hints).

When OpenCode adds a proper pre-task hook, the briefing logic can move there. For now, `AGENTS.md` handles the always-on case and hooks handle the event-driven case.

---

## V1 constraints and workarounds

| Constraint | Workaround |
|---|---|
| Tool returns must be strings | Format all ix JSON output as structured markdown before returning |
| No pre-task context injection hook | Behavioral rules in `AGENTS.md` + advisory hooks |
| No rich UI (no tables, cards, trees) | Return structured markdown with headers, bullets, code blocks |
| `tool.execute.before` may miss subagent tool calls | Accept partial coverage; document the gap |
| No first-class plugin KV store | Use `.opencode/ix-cache/` for any file-based state |

---

## Bun runtime requirement

**Bun is required.** All tool files use `import { $ } from "bun"` for shell execution. The `$` tagged template literal is Bun's shell API and has no Node.js equivalent. The plugin cannot run on plain Node.js — Bun must be the runtime.

Bun-specific APIs used:
- `$\`command\`` — shell execution with structured result and `.text()` / `.quiet()` methods
- Standard `fetch` (Bun ships fetch natively; used in `runtime/client.ts`)

No Bun-specific APIs beyond these are required. `import { $ } from "bun"` is the only non-portable call.

## MCP support

**MCP is not currently supported by OpenCode.** The plugin uses OpenCode's native tool/hook model instead. The `opencode.json` manifest has no MCP section, and the OpenCode runtime does not currently expose an MCP registration surface.

If OpenCode adds MCP support, the implementation path is:
- Register an MCP server in `opencode.json`
- Create `mcp/server.ts` with the same 17 tools, calling the runtime API
- This would mirror the `ix-cursor-plugin/mcp/` structure

Until then, all tools are registered as native OpenCode plugin tools via `plugins/ix-plugin.ts`.

## Ix Core Runtime client

`runtime/client.ts` provides `callRuntime()` and `isRuntimeAvailable()` for when the Ix Core Runtime API comes online (target: 2026-07-15 local alpha). The `ix-decide` tool uses this client today, falling back to `ix impact` when the runtime is unreachable. All other tools still call the CLI directly; they will migrate to the runtime client in Phase 2.

The runtime base URL defaults to `http://127.0.0.1:7743` and can be overridden via the `IX_RUNTIME_URL` environment variable.

## Phase 2 roadmap

When OpenCode adds the following capabilities, the plugin will upgrade:

| Capability | Planned improvement |
|---|---|
| Pre-task hook | Move briefing from `AGENTS.md` to per-task injected context |
| Reliable subagent hook interception | Enforce `ix-pre-edit` and `ix-intercept` for all agents |
| Structured tool return types | Return typed JSON from tools instead of markdown strings |
| MCP support | Register Ix as an MCP server with 17 tools (`mcp/server.ts`) |
| Ix Core Runtime v2 | Migrate all tools from CLI subprocess calls to runtime HTTP API |
| Post-task summary hook | Add `ix-map` and `ix-report` hooks |
